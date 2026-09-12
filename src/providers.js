const PROVIDER_URLS = Object.freeze({
  claudeHelp: 'https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan',
  geminiUsage: 'https://gemini.google.com/',
});

function openAiStatus(usage) {
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

function claudeStatus(detection = { kind: 'checking' }) {
  if (detection.kind === 'detected') {
    return {
      state: 'available',
      label: 'Claude Code detected',
      detail: 'Local client found · usage reader is not enabled yet',
      action: 'Check again',
    };
  }
  if (detection.kind === 'missing') {
    return {
      state: 'inactive',
      label: 'Claude Code not detected',
      detail: 'Install or add Claude Code to PATH to prepare this connection',
      action: 'Check again',
    };
  }
  return {
    state: 'checking',
    label: 'Checking this PC',
    detail: 'Looking for a local Claude Code installation',
    action: 'Checking…',
  };
}

function buildProviderSnapshot(usage, claudeDetection) {
  return {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      capability: 'Supported',
      source: 'Official local app-server',
      ...openAiStatus(usage),
    },
    claude: {
      id: 'claude',
      name: 'Claude',
      capability: 'Experimental',
      source: 'Local Claude Code',
      ...claudeStatus(claudeDetection),
    },
    gemini: {
      id: 'gemini',
      name: 'Gemini',
      capability: 'Experimental',
      source: 'Browser companion required',
      state: 'inactive',
      label: 'Web-only for now',
      detail: 'Google shows usage in Gemini Settings but provides no consumer usage API',
      action: 'Open Gemini',
    },
  };
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

module.exports = { PROVIDER_URLS, buildProviderSnapshot, detectExecutable };
