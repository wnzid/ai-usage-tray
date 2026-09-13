const PROVIDER_URLS = Object.freeze({
  claudeHelp: 'https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan',
  claudeUsage: 'https://claude.ai/settings/usage',
  geminiUsage: 'https://gemini.google.com/',
});

function openAiStatus(usage, service = {}) {
  if (service.lastError) {
    return {
      state: 'error',
      label: usage.kind === 'ready' ? 'Showing saved data' : 'Needs attention',
      detail: usage.kind === 'ready' ? 'The latest refresh failed · retry scheduled' : 'The OpenAI usage service is unavailable',
      action: 'Try again',
    };
  }
  if (usage.kind === 'ready') {
    return {
      state: 'connected',
      label: 'Connected',
      detail: `${usage.account?.plan || 'OpenAI'} plan · Work & Codex limits`,
      action: 'Refresh',
    };
  }
  if (usage.kind === 'signedOut') {
    return {
      state: 'available',
      label: 'Not connected',
      detail: 'Sign in through OpenAI to read Work & Codex limits',
      action: 'Connect',
    };
  }
  if (usage.kind === 'error') {
    return {
      state: 'error',
      label: 'Needs attention',
      detail: 'The OpenAI usage service is unavailable',
      action: 'Try again',
    };
  }
  return {
    state: 'checking',
    label: 'Checking',
    detail: 'Reading the local OpenAI connection',
    action: 'Refresh',
  };
}

function claudeStatus(codeDetection = { kind: 'checking' }, desktopDetection = { kind: 'checking' }, preferences = {}) {
  const preferCode = preferences.preferredClient === 'code';
  if (!preferCode && desktopDetection.kind === 'detected') {
    const version = desktopDetection.version ? ` · version ${desktopDetection.version}` : '';
    return {
      state: 'connected',
      label: 'Claude Desktop detected',
      detail: `${desktopDetection.running ? 'Running' : 'Installed'}${version}`,
      action: 'View',
      client: 'desktop',
    };
  }
  if (codeDetection.kind === 'detected') {
    return {
      state: 'available',
      label: 'Claude Code detected',
      detail: 'Command-line client found · Desktop was not detected',
      action: 'View',
      client: 'code',
    };
  }
  if (desktopDetection.kind === 'detected') {
    const version = desktopDetection.version ? ` · version ${desktopDetection.version}` : '';
    return {
      state: 'connected',
      label: 'Claude Desktop detected',
      detail: `${desktopDetection.running ? 'Running' : 'Installed'}${version}`,
      action: 'View',
      client: 'desktop',
    };
  }
  if (desktopDetection.kind === 'disabled' || codeDetection.kind === 'disabled') {
    return {
      state: 'inactive',
      label: 'Automatic detection is off',
      detail: 'Use Check now or enable detection in Claude settings',
      action: 'Check now',
      client: null,
    };
  }
  if (desktopDetection.kind === 'missing' && codeDetection.kind === 'missing') {
    return {
      state: 'inactive',
      label: 'Claude not detected',
      detail: preferences.preferredClient === 'code'
        ? 'Claude Code is not available in PATH'
        : 'Install Claude Desktop or Claude Code, then check again',
      action: 'Check again',
      client: null,
    };
  }
  return {
    state: 'checking',
    label: 'Checking this PC',
    detail: 'Looking for Claude Desktop and Claude Code',
    action: 'Checking…',
    client: null,
  };
}

function buildProviderSnapshot(usage, claudeCodeDetection, claudeDesktopDetection, service = {}, preferences = {}) {
  const claude = claudeStatus(claudeCodeDetection, claudeDesktopDetection, preferences.claude);
  return {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      capability: 'Supported',
      source: 'Official local app-server',
      ...openAiStatus(usage, service),
    },
    claude: {
      id: 'claude',
      name: 'Claude',
      capability: 'WIP',
      source: claude.client === 'desktop'
        ? 'Claude Desktop for Windows'
        : claude.client === 'code' ? 'Claude Code' : 'Claude Desktop or Claude Code',
      supportsUsageMeters: false,
      desktop: {
        detected: claudeDesktopDetection?.kind === 'detected',
        running: Boolean(claudeDesktopDetection?.running),
        version: claudeDesktopDetection?.version || null,
      },
      code: { detected: claudeCodeDetection?.kind === 'detected' },
      ...claude,
    },
    gemini: {
      id: 'gemini',
      name: 'Gemini',
      capability: 'WIP',
      source: 'Browser companion required',
      state: 'inactive',
      label: 'Web-only for now',
      detail: 'Google shows usage in Gemini Settings but provides no consumer usage API',
      action: 'Open Gemini',
    },
  };
}

function detectClaudeDesktop(execFile, platform = process.platform, environment = process.env) {
  if (platform !== 'win32') return Promise.resolve({ kind: 'unsupported' });
  const powershell = `${environment.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$running = Get-Process -Name Claude | Where-Object { $_.Path -like '*\\app\\Claude.exe' -or $_.Path -like '*\\Claude.exe' } | Select-Object -First 1",
    '$candidate = if ($running) { $running.Path } else {',
    "  @($env:LOCALAPPDATA + '\\AnthropicClaude\\claude.exe', $env:LOCALAPPDATA + '\\Programs\\Claude\\Claude.exe', $env:LOCALAPPDATA + '\\Claude\\Claude.exe') | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1",
    '}',
    '$candidate = if ($candidate) { $candidate } else { Get-Item -Path ($env:ProgramFiles + \'\\WindowsApps\\Claude_*\\app\\Claude.exe\') | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName }',
    "if (-not $candidate) { '{\"kind\":\"missing\"}' } else {",
    '  $item = Get-Item -LiteralPath $candidate',
    "  [pscustomobject]@{ kind = 'detected'; running = [bool]$running; version = $item.VersionInfo.ProductVersion; executablePath = $item.FullName } | ConvertTo-Json -Compress",
    '}',
  ].join('; ');

  return new Promise((resolve) => {
    execFile(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000 }, (error, stdout) => {
      if (error) return resolve({ kind: 'missing' });
      try {
        const result = JSON.parse(String(stdout || '').trim());
        if (result.kind !== 'detected') return resolve({ kind: 'missing' });
        return resolve({
          kind: 'detected',
          running: Boolean(result.running),
          version: typeof result.version === 'string' ? result.version : null,
          executablePath: typeof result.executablePath === 'string' ? result.executablePath : null,
        });
      } catch {
        return resolve({ kind: 'missing' });
      }
    });
  });
}

function detectExecutable(execFile, executable = 'claude', platform = process.platform) {
  const command = platform === 'win32' ? 'where.exe' : 'which';
  return new Promise((resolve) => {
    execFile(command, [executable], { windowsHide: true, timeout: 3000 }, (error, stdout) => {
      const detected = !error && Boolean(String(stdout || '').trim());
      resolve({ kind: detected ? 'detected' : 'missing' });
    });
  });
}

module.exports = { PROVIDER_URLS, buildProviderSnapshot, detectClaudeDesktop, detectExecutable };
