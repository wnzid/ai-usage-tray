const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, powerMonitor, screen, shell, systemPreferences, Tray } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { CodexClient } = require('./codex-client');
const { buildDiagnosticReport } = require('./diagnostics');
const { publicError } = require('./errors');
const { PROVIDER_URLS, buildProviderSnapshot, detectExecutable } = require('./providers');
const { normalDelay, retryDelay } = require('./refresh-policy');
const { buildUsageSnapshot } = require('./usage');
const { SettingsStore } = require('./settings-store');
const { createGaugeImage } = require('./tray-gauge');

const isDemo = process.argv.includes('--demo');
const captureArgument = process.argv.find((argument) => argument.startsWith('--capture-preview='));
const capturePath = captureArgument?.slice('--capture-preview='.length);
const capturePageArgument = process.argv.find((argument) => argument.startsWith('--capture-page='));
const capturePage = ['overview', 'connections', 'taskbar', 'meters', 'preferences'].includes(capturePageArgument?.slice('--capture-page='.length))
  ? capturePageArgument.slice('--capture-page='.length)
  : 'overview';
const backgroundLaunch = process.argv.includes('--background');
const captureOnboarding = process.argv.includes('--capture-onboarding');
const captureOnboardingStepArgument = process.argv.find((argument) => argument.startsWith('--capture-onboarding-step='));
const captureOnboardingStep = Math.min(3, Math.max(1, Number(captureOnboardingStepArgument?.split('=')[1]) || 1));

if (capturePath) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
}

// Electron's single-instance lock is scoped by userData. During development,
// give each checkout its own profile so a preview/staging copy cannot make the
// real checkout appear to open and immediately close.
if (!app.isPackaged) {
  const checkout = path.resolve(__dirname, '..');
  const profile = capturePath ? 'capture' : 'profile';
  app.setPath('userData', path.join(checkout, '.dev-data', profile));
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
}

let settingsStore;
let codex;
let settingsWindow;
let detailsWindow;
let taskbarWindow;
let pollTimer;
let retryFailures = 0;
let lastRefreshAttemptAt = null;
let lastSuccessfulRefreshAt = isDemo ? Date.now() : null;
let nextRefreshAt = null;
let taskbarAttachTimer;
let refreshing = false;
let quitting = false;
let taskbarAttachment = 'off';
let taskbarPlacement = null;
let taskbarAttachRunning = false;
let systemAccent = '#60CDFF';
let claudeDetection = isDemo ? { kind: 'missing' } : { kind: 'checking' };
const trays = new Map();
const trayFingerprints = new Map();

let usage = isDemo
  ? {
      kind: 'ready',
      account: { email: 'you@example.com', plan: 'Plus' },
      windows: [
        { key: 'fiveHour', label: '5-hour window', remainingPercent: 68, usedPercent: 32, resetsAt: Math.floor(Date.now() / 1000) + 4980 },
        { key: 'weekly', label: 'Weekly window', remainingPercent: 24, usedPercent: 76, resetsAt: Math.floor(Date.now() / 1000) + 302400 },
      ],
      resetCredits: 1,
      updatedAt: Date.now(),
    }
  : { kind: 'loading', account: null, windows: [], resetCredits: null, updatedAt: null };
let lastError = null;

function publicState() {
  const visibleError = publicError(lastError);
  return {
    usage,
    providers: buildProviderSnapshot(usage, claudeDetection, { lastError }),
    settings: settingsStore.value,
    refreshing,
    error: visibleError?.message || null,
    errorCode: visibleError?.code || null,
    taskbarAttachment,
    taskbarPlacement,
    systemAccent,
    onboardingRequired: captureOnboarding || (!capturePath && !settingsStore.value.onboardingComplete),
    appVersion: app.getVersion(),
    diagnostics: { lastRefreshAttemptAt, lastSuccessfulRefreshAt, nextRefreshAt, retryFailures },
  };
}

function diagnosticReport() {
  return buildDiagnosticReport(publicState(), { version: app.getVersion() });
}

function copyDiagnostics() {
  clipboard.writeText(JSON.stringify(diagnosticReport(), null, 2));
  return { ok: true };
}

function readSystemAccent(value) {
  try {
    const accent = value || systemPreferences.getAccentColor();
    return typeof accent === 'string' && /^[0-9a-f]{8}$/i.test(accent) ? `#${accent.slice(0, 6)}` : '#60CDFF';
  } catch {
    return '#60CDFF';
  }
}

function updateSettingsWindowChrome() {
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  settingsWindow.setTitleBarOverlay({
    color: '#00000000',
    symbolColor: nativeTheme.shouldUseDarkColors ? '#FFFFFF' : '#000000',
    height: 48,
  });
}

function broadcast() {
  const state = publicState();
  for (const window of [settingsWindow, detailsWindow, taskbarWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('state:changed', state);
  }
}

function formatReset(epochSeconds) {
  if (!epochSeconds) return 'Reset time unavailable';
  const date = new Date(epochSeconds * 1000);
  return `Resets ${date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

function windowFor(key) {
  return usage.windows.find((item) => item.key === key);
}

function trayTooltip(key, item) {
  if (key === 'app' || key === 'fallback') return 'AI Usage Tray — click for usage';
  if (usage.kind === 'signedOut') return 'AI Usage Tray — sign in required';
  if (usage.kind === 'loading') return 'AI Usage Tray — loading usage';
  if (!item) return `${key === 'fiveHour' ? '5-hour' : 'Weekly'} usage unavailable`;
  return `${item.label}: ${Math.round(item.remainingPercent)}% remaining\n${formatReset(item.resetsAt)}`;
}

function openSettings() {
  if (!app.isReady()) {
    app.whenReady().then(openSettings);
    return;
  }
  if (!settingsWindow || settingsWindow.isDestroyed()) createSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

function hideDetails() {
  if (detailsWindow && !detailsWindow.isDestroyed()) detailsWindow.hide();
}

function toggleDetails(tray) {
  if (!detailsWindow || detailsWindow.isDestroyed()) createDetailsWindow();
  if (detailsWindow.isVisible()) return detailsWindow.hide();

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const windowBounds = detailsWindow.getBounds();
  const area = display.workArea;
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  let y = trayBounds.y - windowBounds.height - 10;
  if (y < area.y) y = trayBounds.y + trayBounds.height + 10;
  x = Math.max(area.x + 8, Math.min(x, area.x + area.width - windowBounds.width - 8));
  y = Math.max(area.y + 8, Math.min(y, area.y + area.height - windowBounds.height - 8));
  detailsWindow.setPosition(x, y, false);
  detailsWindow.show();
  detailsWindow.focus();
}

function toggleDetailsAtCursor() {
  if (!detailsWindow || detailsWindow.isDestroyed()) createDetailsWindow();
  if (detailsWindow.isVisible()) return detailsWindow.hide();
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const windowBounds = detailsWindow.getBounds();
  const area = display.workArea;
  const x = Math.max(area.x + 8, Math.min(point.x - windowBounds.width / 2, area.x + area.width - windowBounds.width - 8));
  const y = Math.max(area.y + 8, area.y + area.height - windowBounds.height - 8);
  detailsWindow.setPosition(Math.round(x), Math.round(y), false);
  detailsWindow.show();
  detailsWindow.focus();
}

function trayMenu() {
  const enabled = settingsStore.value.indicators;
  return Menu.buildFromTemplate([
    { label: 'AI Usage Tray', enabled: false },
    { type: 'separator' },
    {
      label: 'Show 5-hour gauge',
      type: 'checkbox',
      checked: enabled.fiveHour.enabled,
      click: (item) => saveSettings({
        ...settingsStore.value,
        indicators: { ...enabled, fiveHour: { ...enabled.fiveHour, enabled: item.checked } },
      }),
    },
    {
      label: 'Show weekly gauge',
      type: 'checkbox',
      checked: enabled.weekly.enabled,
      click: (item) => saveSettings({
        ...settingsStore.value,
        indicators: { ...enabled, weekly: { ...enabled.weekly, enabled: item.checked } },
      }),
    },
    { type: 'separator' },
    { label: 'Refresh now', click: () => refreshUsage() },
    { label: 'Settings', click: openSettings },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
}

function makeTray(key, item, center, connected) {
  const isAppIcon = key === 'app' || key === 'fallback';
  const indicator = settingsStore.value.indicators[key];
  const critical = settingsStore.value.taskbar.lowRemainingAlert
    && (item?.remainingPercent ?? 100) > 0
    && (item?.remainingPercent ?? 100) <= 5;
  const fingerprint = isAppIcon
    ? 'aiu-wordmark-v2'
    : JSON.stringify([Math.round(item?.remainingPercent ?? 0), center, indicator?.color, critical, connected, nativeTheme.shouldUseDarkColors]);
  let tray = trays.get(key);
  if (tray && trayFingerprints.get(key) === fingerprint) {
    tray.setToolTip(trayTooltip(key, item));
    return;
  }
  const image = isAppIcon
    ? nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', 'icon.png')).resize({ width: 18, height: 18 })
    : createGaugeImage(require('electron'), {
        app,
        remaining: item?.remainingPercent ?? 0,
        center,
        color: indicator?.color,
        critical,
        dark: nativeTheme.shouldUseDarkColors,
        connected,
      });
  if (!tray) {
    tray = new Tray(image);
    tray.setIgnoreDoubleClickEvents(true);
    tray.on('click', () => toggleDetails(tray));
    tray.on('right-click', () => tray.popUpContextMenu(trayMenu()));
    trays.set(key, tray);
  } else {
    tray.setImage(image);
  }
  trayFingerprints.set(key, fingerprint);
  tray.setToolTip(trayTooltip(key, item));
}

function rebuildTrays() {
  const wanted = [];
  const location = settingsStore.value.displayLocation;
  const trayEnabled = location === 'tray' || location === 'both';
  if (trayEnabled) {
    for (const key of ['fiveHour', 'weekly']) {
      const config = settingsStore.value.indicators[key];
      if (config.enabled) wanted.push(key);
    }
  }
  if (settingsStore.value.alwaysShowTrayIcon && !wanted.includes('app')) wanted.push('app');
  const anyIndicator = Object.values(settingsStore.value.indicators).some((indicator) => indicator.enabled);
  if (wanted.length === 0 && (!anyIndicator || location === 'tray' || taskbarAttachment === 'error')) wanted.push('fallback');

  for (const [key, tray] of trays) {
    if (!wanted.includes(key)) {
      tray.destroy();
      trays.delete(key);
      trayFingerprints.delete(key);
    }
  }

  for (const key of wanted) {
    const item = key === 'fallback' || key === 'app' ? null : windowFor(key);
    const center = key === 'fallback' || key === 'app' ? 'logo' : settingsStore.value.indicators[key].center;
    makeTray(key, item, center, usage.kind === 'ready');
  }
}

function taskbarModeEnabled() {
  const location = settingsStore.value.displayLocation;
  const anyIndicator = Object.values(settingsStore.value.indicators).some((indicator) => indicator.enabled);
  return anyIndicator && (location === 'taskbar' || location === 'both');
}

function taskbarWidgetSize() {
  const config = settingsStore.value.taskbar;
  const count = Math.max(1, Object.values(settingsStore.value.indicators).filter((indicator) => indicator.enabled).length);
  const padding = config.background === 'none' ? 0 : 8;
  if (config.layout === 'compact') {
    return { width: Math.round(count * (config.showLabels ? 64 + config.fontSize : 44 + config.fontSize) + padding), height: config.size };
  }
  if (config.layout === 'bars') {
    return { width: Math.round(config.size * (config.showLabels ? 5.2 : 4.2) + config.fontSize * 1.5 + padding), height: Math.max(30, config.size) };
  }
  return {
    width: Math.round(count * (config.size + (config.showLabels ? 31 : 0)) + Math.max(0, count - 1) * 5 + padding),
    height: config.size,
  };
}

function taskbarScriptPath() {
  if (!app.isPackaged) return path.join(app.getAppPath(), 'scripts', 'attach-taskbar.ps1');
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'attach-taskbar.ps1');
}

function attachTaskbarWidget() {
  if (!taskbarWindow || taskbarWindow.isDestroyed() || taskbarAttachRunning) return;
  taskbarAttachRunning = true;
  const handle = taskbarWindow.getNativeWindowHandle();
  const hwnd = process.arch === 'x64' ? handle.readBigUInt64LE(0).toString() : String(handle.readUInt32LE(0));
  const size = taskbarWidgetSize();
  const config = settingsStore.value.taskbar;
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const args = [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', taskbarScriptPath(),
    '-WidgetHwnd', hwnd,
    '-Position', config.position,
    '-Width', String(size.width),
    '-Height', String(size.height),
    '-Offset', String(config.offset),
  ];

  if (taskbarAttachment !== 'attached') {
    taskbarAttachment = 'attaching';
    broadcast();
  }
  execFile(powershell, args, { windowsHide: true, timeout: 5000 }, (error, stdout) => {
    taskbarAttachRunning = false;
    const nextStatus = error ? 'error' : 'attached';
    const previousPlacement = JSON.stringify(taskbarPlacement);
    if (!error) {
      try { taskbarPlacement = JSON.parse(stdout.trim()); } catch { taskbarPlacement = null; }
    } else {
      taskbarPlacement = null;
    }
    if (taskbarAttachment !== nextStatus || previousPlacement !== JSON.stringify(taskbarPlacement)) {
      taskbarAttachment = nextStatus;
      if (error) lastError = `Taskbar attachment failed: ${error.message}`;
      rebuildTrays();
      broadcast();
    }
  });
}

function createTaskbarWindow() {
  const size = taskbarWidgetSize();
  taskbarWindow = createWindow('taskbar.html', {
    width: size.width,
    height: size.height,
    x: -32000,
    y: -32000,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
  });
  taskbarWindow.setMenu(null);
  taskbarWindow.once('ready-to-show', () => {
    taskbarWindow.showInactive();
    attachTaskbarWidget();
  });
  taskbarWindow.on('closed', () => {
    taskbarWindow = null;
    taskbarAttachment = 'off';
  });
}

function rebuildTaskbarWidget() {
  clearInterval(taskbarAttachTimer);
  if (!taskbarModeEnabled()) {
    taskbarAttachment = 'off';
    taskbarPlacement = null;
    if (taskbarWindow && !taskbarWindow.isDestroyed()) taskbarWindow.destroy();
    taskbarWindow = null;
    broadcast();
    return;
  }
  if (!taskbarWindow || taskbarWindow.isDestroyed()) createTaskbarWindow();
  else attachTaskbarWidget();
  // The script is a no-op when Explorer and the requested bounds are unchanged.
  // A slow health check still recovers gracefully after an Explorer restart.
  taskbarAttachTimer = setInterval(attachTaskbarWidget, 15_000);
}

function createWindow(html, options) {
  const window = new BrowserWindow({
    show: false,
    backgroundColor: '#0a0a0b',
    icon: path.join(app.getAppPath(), 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    ...options,
  });
  window.loadFile(path.join(app.getAppPath(), 'renderer', html));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return window;
}

function createSettingsWindow() {
  settingsWindow = createWindow('settings.html', {
    title: 'AI Usage Tray',
    width: 1080,
    height: 760,
    minWidth: 860,
    minHeight: 680,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    backgroundMaterial: 'mica',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#FFFFFF' : '#000000',
      height: 48,
    },
  });
  settingsWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
  settingsWindow.on('closed', () => { settingsWindow = null; });
  settingsWindow.once('ready-to-show', async () => {
    if (!backgroundLaunch || capturePath) settingsWindow.show();
    if (capturePath) {
      if (capturePage !== 'overview') await settingsWindow.webContents.executeJavaScript(`activatePage(${JSON.stringify(capturePage)})`);
      if (captureOnboarding) {
        await settingsWindow.webContents.executeJavaScript(`onboardingStep = ${captureOnboardingStep}; renderOnboarding()`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const image = await settingsWindow.webContents.capturePage();
      fs.writeFileSync(capturePath, image.toPNG());
      await new Promise((resolve) => setTimeout(resolve, 250));
      quitting = true;
      app.exit(0);
    }
  });
}

function createDetailsWindow() {
  detailsWindow = createWindow('details.html', {
    width: 370,
    height: 330,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    roundedCorners: true,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
  });
  detailsWindow.on('blur', hideDetails);
  detailsWindow.on('closed', () => { detailsWindow = null; });
}

function setPolling() {
  scheduleNextRefresh(normalDelay(settingsStore.value.refreshMinutes));
}

function scheduleNextRefresh(delayMs) {
  clearTimeout(pollTimer);
  if (quitting || isDemo) {
    nextRefreshAt = null;
    return;
  }
  nextRefreshAt = Date.now() + delayMs;
  pollTimer = setTimeout(() => refreshUsage(), delayMs);
}

function refreshIfStale() {
  if (!lastRefreshAttemptAt || Date.now() - lastRefreshAttemptAt > 60_000) refreshUsage();
}

function applyLoginSetting() {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: settingsStore.value.launchAtLogin,
    args: ['--background'],
  });
}

function saveSettings(next) {
  const saved = settingsStore.update(next);
  applyLoginSetting();
  setPolling();
  rebuildTrays();
  rebuildTaskbarWidget();
  broadcast();
  return saved;
}

async function refreshUsage() {
  if (refreshing || isDemo) return publicState();
  refreshing = true;
  lastRefreshAttemptAt = Date.now();
  lastError = null;
  broadcast();
  try {
    const result = await codex.readUsage();
    usage = buildUsageSnapshot(result.account, result.rateLimits);
    retryFailures = 0;
    lastSuccessfulRefreshAt = Date.now();
  } catch (error) {
    lastError = error.message;
    retryFailures += 1;
    if (usage.kind === 'loading') usage = { ...usage, kind: 'error' };
  } finally {
    refreshing = false;
    scheduleNextRefresh(lastError ? retryDelay(retryFailures) : normalDelay(settingsStore.value.refreshMinutes));
    rebuildTrays();
    broadcast();
  }
  return publicState();
}

async function beginLogin() {
  try {
    lastError = null;
    const result = await codex.startLogin();
    const url = result?.authUrl || result?.auth_url || result?.url;
    if (!url) throw new Error('Codex did not return a sign-in URL.');
    await shell.openExternal(url);
    return { ok: true };
  } catch (error) {
    lastError = error.message;
    broadcast();
    return { ok: false, error: publicError(error).message };
  }
}

async function disconnectOpenAI() {
  const options = {
    type: 'warning',
    title: 'Disconnect OpenAI?',
    message: 'Disconnect this OpenAI account from AI Usage Tray?',
    detail: 'This signs out the local Codex session shared with other Codex tools. Usage meters will be unavailable until you sign in again.',
    buttons: ['Disconnect', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  };
  const result = settingsWindow && !settingsWindow.isDestroyed()
    ? await dialog.showMessageBox(settingsWindow, options)
    : await dialog.showMessageBox(options);
  if (result.response !== 0) return { ok: false, cancelled: true };

  try {
    await codex.logout();
    usage = { kind: 'signedOut', account: null, windows: [], resetCredits: null, updatedAt: Date.now() };
    lastError = null;
    rebuildTrays();
    broadcast();
    return { ok: true };
  } catch (error) {
    lastError = error.message;
    broadcast();
    return { ok: false, error: publicError(error).message };
  }
}

async function checkClaudeCode() {
  if (isDemo) return publicState();
  claudeDetection = { kind: 'checking' };
  broadcast();
  claudeDetection = await detectExecutable(execFile);
  broadcast();
  return publicState();
}

async function providerAction(action) {
  if (action === 'openai') {
    return usage.kind === 'signedOut' ? beginLogin() : refreshUsage();
  }
  if (action === 'openai-disconnect') return disconnectOpenAI();
  if (action === 'claude-detect') return checkClaudeCode();
  if (action === 'claude-help') {
    await shell.openExternal(PROVIDER_URLS.claudeHelp);
    return { ok: true };
  }
  if (action === 'gemini-open') {
    await shell.openExternal(PROVIDER_URLS.geminiUsage);
    return { ok: true };
  }
  return { ok: false, error: 'Unknown provider action.' };
}

function registerIpc() {
  ipcMain.handle('state:get', () => publicState());
  ipcMain.handle('settings:update', (_event, next) => saveSettings(next));
  ipcMain.handle('usage:refresh', () => refreshUsage());
  ipcMain.handle('account:login', () => beginLogin());
  ipcMain.handle('provider:action', (_event, action) => providerAction(action));
  ipcMain.handle('diagnostics:copy', () => copyDiagnostics());
  ipcMain.handle('window:openSettings', () => { openSettings(); return true; });
  ipcMain.handle('window:openDetails', () => { toggleDetailsAtCursor(); return true; });
  ipcMain.handle('window:hideDetails', () => { hideDetails(); return true; });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', openSettings);
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    systemAccent = readSystemAccent();
    settingsStore = new SettingsStore(app.getPath('userData'));
    codex = new CodexClient(app);
    codex.on('notification', (message) => {
      if (['account/login/completed', 'account/updated', 'account/rateLimits/updated'].includes(message.method)) {
        refreshUsage();
      }
    });
    codex.on('exit', (message) => {
      lastError = message;
      if (!refreshing) {
        retryFailures += 1;
        scheduleNextRefresh(retryDelay(retryFailures));
      }
      rebuildTrays();
      broadcast();
    });
    registerIpc();
    createSettingsWindow();
    createDetailsWindow();
    applyLoginSetting();
    setPolling();
    rebuildTrays();
    if (capturePath) {
      taskbarAttachment = 'attached';
      taskbarPlacement = { note: 'Placed beside Windows controls' };
      broadcast();
    } else {
      rebuildTaskbarWidget();
    }
    refreshUsage();
    checkClaudeCode();
    nativeTheme.on('updated', () => { updateSettingsWindowChrome(); rebuildTrays(); broadcast(); });
    systemPreferences.on('accent-color-changed', (_event, color) => {
      systemAccent = readSystemAccent(color);
      broadcast();
    });
    screen.on('display-metrics-changed', attachTaskbarWidget);
    powerMonitor.on('resume', refreshIfStale);
    app.on('browser-window-focus', refreshIfStale);
  });
}

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  quitting = true;
  clearTimeout(pollTimer);
  clearInterval(taskbarAttachTimer);
  codex?.stop();
  if (taskbarWindow && !taskbarWindow.isDestroyed()) taskbarWindow.destroy();
  taskbarWindow = null;
  for (const tray of trays.values()) tray.destroy();
  trays.clear();
  trayFingerprints.clear();
});
