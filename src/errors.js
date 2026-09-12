function errorText(error) {
  if (!error) return '';
  return String(error.message || error).replace(/\s+/g, ' ').trim();
}

function classifyError(error) {
  const text = errorText(error);
  const lower = text.toLowerCase();

  if (lower.includes('taskbar attachment failed')) {
    return {
      code: 'taskbar-attachment',
      message: 'The taskbar widget could not attach. Tray access is still available.',
    };
  }
  if (/econn|network|offline|dns|socket|fetch failed|connection (?:closed|refused|reset)/i.test(text)) {
    return { code: 'offline', message: 'You appear to be offline. Showing the latest available usage.' };
  }
  if (/timed? ?out|timeout/i.test(text)) {
    return { code: 'timeout', message: 'The OpenAI usage check timed out. AIU will try again.' };
  }
  if (/enoent|not found|could not start|failed to spawn|spawn .*codex/i.test(text)) {
    return { code: 'service-start', message: 'The OpenAI usage service could not start.' };
  }
  if (/unauth|sign.?in|signed out|login|token.*(?:expired|invalid)|401\b/i.test(text)) {
    return { code: 'authentication', message: 'Your OpenAI sign-in needs attention. Connect the account again.' };
  }
  return { code: 'service-unavailable', message: 'OpenAI usage is temporarily unavailable. AIU will try again.' };
}

function publicError(error) {
  if (!error) return null;
  return classifyError(error);
}

module.exports = { classifyError, errorText, publicError };
