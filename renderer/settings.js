let currentState;
let saving = false;

const $ = (selector) => document.querySelector(selector);

function usageWindow(key) {
  return currentState?.usage?.windows?.find((item) => item.key === key);
}

function remainingFor(key) {
  return Math.max(0, Math.min(100, Math.round(usageWindow(key)?.remainingPercent ?? 0)));
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function applySystemAccent() {
  const accent = /^#[0-9a-f]{6}$/i.test(currentState.systemAccent || '') ? currentState.systemAccent : '#60CDFF';
  const channels = [1, 3, 5].map((offset) => Number.parseInt(accent.slice(offset, offset + 2), 16) / 255);
  const chroma = Math.max(...channels) - Math.min(...channels);
  if (chroma < .12) {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-foreground');
    return;
  }
  const luminance = channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-foreground', luminance > .56 ? '#111111' : '#FFFFFF');
}

function activatePage(name) {
  const target = document.querySelector(`[data-page-content="${name}"]`);
  if (!target) return;
  for (const page of document.querySelectorAll('[data-page-content]')) page.classList.toggle('active', page === target);
  for (const item of document.querySelectorAll('[data-page]')) item.classList.toggle('active', item.dataset.page === name);
  document.querySelector('.page-region').scrollTop = 0;
}

function meterClass(remaining, settings) {
  if (remaining === 0) return ' is-empty';
  if (settings.taskbar.lowRemainingAlert && remaining <= 5) return ' is-critical';
  return '';
}

function renderStatus() {
  const pill = $('#status-pill');
  const label = pill.querySelector('span');
  pill.classList.remove('ready', 'error', 'working');
  if (currentState.refreshing) {
    pill.classList.add('working');
    label.textContent = 'Refreshing';
  } else if (currentState.usage.kind === 'ready') {
    pill.classList.add('ready');
    label.textContent = 'Live';
  } else if (currentState.usage.kind === 'signedOut') {
    pill.classList.add('error');
    label.textContent = 'Sign in needed';
  } else if (currentState.error) {
    pill.classList.add('error');
    label.textContent = 'Needs attention';
  } else {
    label.textContent = 'Connecting';
  }
}

function renderAccount() {
  const account = currentState.usage.account;
  const signedOut = currentState.usage.kind === 'signedOut';
  $('#signin-button').classList.toggle('hidden', !signedOut);
  $('#refresh-button').classList.toggle('hidden', signedOut);
  $('#refresh-button').disabled = currentState.refreshing;

  if (account) {
    $('#account-name').textContent = account.email;
    $('#account-plan').textContent = `${account.plan || 'ChatGPT'} plan · auto-updating`;
  } else if (signedOut) {
    $('#account-name').textContent = 'ChatGPT is not connected';
    $('#account-plan').textContent = 'Sign in securely through Codex';
  } else if (currentState.error) {
    $('#account-name').textContent = 'Usage unavailable';
    $('#account-plan').textContent = currentState.error;
  } else {
    $('#account-name').textContent = 'Checking account…';
    $('#account-plan').textContent = 'Connecting through Codex';
  }
}

function applyPreviewMeter(element, key, settings) {
  const remaining = remainingFor(key);
  const indicator = settings.indicators[key];
  element.className += meterClass(remaining, settings);
  element.style.setProperty('--value', remaining);
  element.style.setProperty('--meter-color', indicator.color);
}

function renderTaskbarPreview(settings = currentState.settings) {
  const preview = $('#taskbar-preview-widget');
  const config = settings.taskbar;
  preview.className = `taskbar-preview-widget position-${config.position} preview-background-${config.background}${config.breathing ? ' effects-breathing' : ''}`;
  preview.style.setProperty('--preview-size', `${config.size}px`);
  preview.style.setProperty('--preview-font', `${config.fontSize}px`);
  preview.replaceChildren();

  const enabledKeys = ['fiveHour', 'weekly'].filter((key) => settings.indicators[key].enabled);
  if (config.layout === 'bars') {
    const set = document.createElement('div');
    set.className = 'preview-bar-set';
    for (const key of enabledKeys) {
      const remaining = remainingFor(key);
      const row = document.createElement('div');
      row.className = 'preview-bar-row';
      applyPreviewMeter(row, key, settings);
      row.append(createTextElement('span', '', config.showLabels ? (key === 'fiveHour' ? '5H' : '7D') : ''));
      const track = document.createElement('span');
      track.className = 'preview-bar-track';
      track.append(document.createElement('i'));
      row.append(track, createTextElement('strong', '', remaining === 0 ? 'EMPTY' : `${remaining}%`));
      set.append(row);
    }
    preview.append(set);
    return;
  }

  for (const key of enabledKeys) {
    const remaining = remainingFor(key);
    const chip = document.createElement('div');
    chip.className = 'preview-chip';
    applyPreviewMeter(chip, key, settings);
    if (config.layout === 'compact') {
      chip.append(createTextElement('i', 'compact-ring', ''));
      if (config.showLabels) chip.append(createTextElement('em', '', key === 'fiveHour' ? '5H' : '7D'));
      chip.append(createTextElement('strong', '', remaining === 0 ? 'EMPTY' : `${remaining}%`));
    } else {
      const ring = document.createElement('span');
      ring.className = 'preview-mini-ring';
      const center = document.createElement('span');
      if (settings.indicators[key].center === 'logo') center.className = 'logo-mask';
      else center.textContent = remaining;
      ring.append(center);
      chip.append(ring);
      if (config.showLabels) chip.append(createTextElement('em', '', key === 'fiveHour' ? '5H' : '7D'));
    }
    preview.append(chip);
  }
}

function renderAttachment() {
  const settings = currentState.settings;
  const attachment = $('#taskbar-attach-state');
  attachment.classList.remove('attached', 'error');
  if (settings.displayLocation === 'tray') {
    attachment.querySelector('span').textContent = 'Taskbar widget is off · tray remains available';
  } else if (currentState.taskbarAttachment === 'attached') {
    attachment.classList.add('attached');
    attachment.querySelector('span').textContent = currentState.taskbarPlacement?.note || 'Attached without overlapping the notification area';
  } else if (currentState.taskbarAttachment === 'error') {
    attachment.classList.add('error');
    attachment.querySelector('span').textContent = 'Could not attach · tray fallback is active';
  } else {
    attachment.querySelector('span').textContent = 'Finding a safe taskbar position…';
  }
}

function setSnapshot(key, settings) {
  const element = $(`#preview-${key === 'fiveHour' ? 'five' : 'weekly'}`);
  const remaining = remainingFor(key);
  element.classList.toggle('disabled', !settings.indicators[key].enabled);
  element.classList.toggle('critical', settings.taskbar.lowRemainingAlert && remaining > 0 && remaining <= 5);
  element.classList.toggle('empty', remaining === 0);
  element.style.setProperty('--meter-color', settings.indicators[key].color);
  element.querySelector('.preview-value').textContent = usageWindow(key) ? (remaining === 0 ? 'EMPTY' : `${remaining}% left`) : 'Waiting';
}

function render() {
  if (!currentState) return;
  const settings = currentState.settings;
  applySystemAccent();
  renderStatus();
  renderAccount();

  document.querySelector(`input[name="display-location"][value="${settings.displayLocation}"]`).checked = true;
  $('#taskbar-position').value = settings.taskbar.position;
  $('#taskbar-layout').value = settings.taskbar.layout;
  $('#taskbar-background').value = settings.taskbar.background;
  $('#taskbar-labels').checked = settings.taskbar.showLabels;
  $('#always-show-tray-icon').checked = settings.alwaysShowTrayIcon;
  $('#low-remaining-alert').checked = settings.taskbar.lowRemainingAlert;
  $('#breathing-effect').checked = settings.taskbar.breathing;
  $('#breathing-effect').disabled = !settings.taskbar.lowRemainingAlert;
  $('#taskbar-size').value = settings.taskbar.size;
  $('#taskbar-font-size').value = settings.taskbar.fontSize;
  $('#taskbar-offset').value = settings.taskbar.offset;
  $('#taskbar-size-value').textContent = `${settings.taskbar.size} px`;
  $('#taskbar-font-size-value').textContent = `${settings.taskbar.fontSize} px`;
  $('#taskbar-offset-value').textContent = `${settings.taskbar.offset > 0 ? '+' : ''}${settings.taskbar.offset} px`;
  $('#taskbar-options').classList.toggle('disabled', settings.displayLocation === 'tray');

  for (const key of ['fiveHour', 'weekly']) {
    const indicator = settings.indicators[key];
    $(`#${key}-enabled`).checked = indicator.enabled;
    $(`#${key}-color`).value = indicator.color;
    $(`#${key}-color`).parentElement.style.setProperty('--swatch', indicator.color);
    document.querySelector(`input[name="${key}-center"][value="${indicator.center}"]`).checked = true;
    $(`#${key}-card`).classList.toggle('disabled', !indicator.enabled);
    for (const radio of document.querySelectorAll(`input[name="${key}-center"]`)) radio.disabled = !indicator.enabled;
  }

  $('#refresh-minutes').value = String(settings.refreshMinutes);
  $('#launch-at-login').checked = settings.launchAtLogin;
  setSnapshot('fiveHour', settings);
  setSnapshot('weekly', settings);
  renderTaskbarPreview(settings);
  renderAttachment();
}

function settingsFromForm() {
  return {
    paletteVersion: currentState.settings.paletteVersion,
    displayLocation: document.querySelector('input[name="display-location"]:checked').value,
    alwaysShowTrayIcon: $('#always-show-tray-icon').checked,
    indicators: {
      fiveHour: {
        enabled: $('#fiveHour-enabled').checked,
        center: document.querySelector('input[name="fiveHour-center"]:checked').value,
        color: $('#fiveHour-color').value,
      },
      weekly: {
        enabled: $('#weekly-enabled').checked,
        center: document.querySelector('input[name="weekly-center"]:checked').value,
        color: $('#weekly-color').value,
      },
    },
    refreshMinutes: Number($('#refresh-minutes').value),
    launchAtLogin: $('#launch-at-login').checked,
    taskbar: {
      position: $('#taskbar-position').value,
      layout: $('#taskbar-layout').value,
      size: Number($('#taskbar-size').value),
      fontSize: Number($('#taskbar-font-size').value),
      background: $('#taskbar-background').value,
      showLabels: $('#taskbar-labels').checked,
      lowRemainingAlert: $('#low-remaining-alert').checked,
      breathing: $('#breathing-effect').checked,
      offset: Number($('#taskbar-offset').value),
    },
  };
}

async function save() {
  if (saving) return;
  saving = true;
  try {
    currentState.settings = await window.usageTray.updateSettings(settingsFromForm());
    render();
  } finally {
    saving = false;
  }
}

document.addEventListener('change', (event) => {
  if (event.target.matches('input, select')) save();
});
document.addEventListener('input', (event) => {
  if (event.target.matches('input[type="color"]')) {
    event.target.parentElement.style.setProperty('--swatch', event.target.value);
    renderTaskbarPreview(settingsFromForm());
  }
  if (!event.target.matches('input[type="range"]')) return;
  $('#taskbar-size-value').textContent = `${$('#taskbar-size').value} px`;
  $('#taskbar-font-size-value').textContent = `${$('#taskbar-font-size').value} px`;
  const offset = Number($('#taskbar-offset').value);
  $('#taskbar-offset-value').textContent = `${offset > 0 ? '+' : ''}${offset} px`;
  renderTaskbarPreview(settingsFromForm());
});
$('#refresh-button').addEventListener('click', () => window.usageTray.refresh());
$('#signin-button').addEventListener('click', () => window.usageTray.signIn());
document.addEventListener('click', (event) => {
  const navigation = event.target.closest('[data-page], [data-navigate]');
  if (navigation) activatePage(navigation.dataset.page || navigation.dataset.navigate);
});

window.usageTray.onState((state) => { currentState = state; render(); });
window.usageTray.getState().then((state) => { currentState = state; render(); });
