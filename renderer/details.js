let state;
const list = document.querySelector('#usage-list');

function formatReset(epochSeconds) {
  if (!epochSeconds) return 'Reset time unavailable';
  return `Resets ${new Date(epochSeconds * 1000).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

function usageWindow(key) {
  return state.usage.windows.find((item) => item.key === key);
}

function usageRow(key) {
  const item = usageWindow(key);
  const config = state.settings.indicators[key];
  if (!config.enabled) return null;
  const remaining = Math.round(item?.remainingPercent ?? 0);

  const row = document.createElement('article');
  row.className = 'usage-row';
  const gauge = document.createElement('div');
  gauge.className = 'gauge';
  gauge.style.setProperty('--value', remaining);
  const center = document.createElement('span');
  center.className = `gauge-center${config.center === 'logo' ? ' logo-mask' : ''}`;
  if (config.center === 'percentage') center.textContent = remaining;
  gauge.append(center);

  const copy = document.createElement('div');
  copy.className = 'usage-copy';
  const title = document.createElement('strong');
  title.textContent = key === 'fiveHour' ? '5-hour window' : 'Weekly window';
  const value = document.createElement('span');
  value.className = 'remaining';
  value.textContent = item ? `${remaining}% remaining` : 'Usage unavailable';
  const reset = document.createElement('small');
  reset.textContent = formatReset(item?.resetsAt);
  copy.append(title, value, reset);
  row.append(gauge, copy);
  return row;
}

function render() {
  if (!state) return;
  list.replaceChildren();
  const rows = ['fiveHour', 'weekly'].map(usageRow).filter(Boolean);
  if (rows.length) list.append(...rows);
  else {
    const empty = document.createElement('div');
    empty.className = 'details-empty';
    empty.textContent = state.usage.kind === 'signedOut'
      ? 'Open Settings to sign in to ChatGPT.'
      : 'No taskbar indicators are enabled.';
    list.append(empty);
  }

  const status = document.querySelector('#details-status');
  status.textContent = state.refreshing
    ? 'Refreshing…'
    : state.usage.account?.plan
      ? `${state.usage.account.plan} plan`
      : state.usage.kind === 'signedOut'
        ? 'Sign in required'
        : state.error || 'ChatGPT';
  document.querySelector('#details-refresh').disabled = state.refreshing;
}

document.querySelector('#close-button').addEventListener('click', () => window.usageTray.hideDetails());
document.querySelector('#details-refresh').addEventListener('click', () => window.usageTray.refresh());
document.querySelector('#details-settings').addEventListener('click', () => {
  window.usageTray.openSettings();
  window.usageTray.hideDetails();
});
window.usageTray.onState((next) => { state = next; render(); });
window.usageTray.getState().then((next) => { state = next; render(); });
