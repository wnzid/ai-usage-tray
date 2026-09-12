let state;
const widget = document.querySelector('#taskbar-widget');

function currentWindow(key) {
  return state.usage.windows.find((item) => item.key === key);
}

function gaugeItem(key, item, config, showLabels) {
  const remaining = Math.round(item?.remainingPercent ?? 0);
  const element = document.createElement('div');
  element.className = 'task-item';
  const gauge = document.createElement('div');
  gauge.className = 'task-gauge';
  gauge.style.setProperty('--value', remaining);
  const center = document.createElement('span');
  center.className = `task-gauge-center${config.center === 'logo' ? ' provider-mark' : ''}`;
  if (config.center === 'percentage') center.textContent = remaining;
  gauge.append(center);
  element.append(gauge);
  if (showLabels) {
    const caption = document.createElement('span');
    caption.className = 'task-caption';
    const title = document.createElement('strong');
    title.textContent = key === 'fiveHour' ? '5H' : '7D';
    const value = document.createElement('span');
    value.textContent = `${remaining}%`;
    caption.append(title, value);
    element.append(caption);
  }
  return element;
}

function compactItem(key, item, showLabels) {
  const remaining = Math.round(item?.remainingPercent ?? 0);
  const element = document.createElement('div');
  element.className = 'task-item';
  const ring = document.createElement('i');
  ring.className = 'compact-ring';
  ring.style.setProperty('--value', remaining);
  const label = document.createElement('span');
  label.className = 'compact-key';
  label.textContent = key === 'fiveHour' ? '5H' : '7D';
  const value = document.createElement('strong');
  value.className = 'compact-value';
  value.textContent = `${remaining}%`;
  element.append(ring);
  if (showLabels) element.append(label);
  element.append(value);
  return element;
}

function barItem(key, item, showLabels) {
  const remaining = Math.round(item?.remainingPercent ?? 0);
  const element = document.createElement('div');
  element.className = 'task-item';
  const label = document.createElement('span');
  label.className = 'bar-key';
  label.textContent = showLabels ? (key === 'fiveHour' ? '5H' : '7D') : '';
  const track = document.createElement('span');
  track.className = 'bar-track';
  const fill = document.createElement('i');
  fill.className = 'bar-fill';
  fill.style.setProperty('--value', remaining);
  track.append(fill);
  const value = document.createElement('strong');
  value.className = 'bar-value';
  value.textContent = `${remaining}%`;
  element.append(label, track, value);
  return element;
}

function render() {
  if (!state) return;
  const config = state.settings.taskbar;
  widget.className = `taskbar-widget layout-${config.layout} background-${config.background}`;
  widget.style.setProperty('--size', `${config.size}px`);
  widget.replaceChildren();

  for (const key of ['fiveHour', 'weekly']) {
    const indicator = state.settings.indicators[key];
    if (!indicator.enabled) continue;
    const item = currentWindow(key);
    if (config.layout === 'compact') widget.append(compactItem(key, item, config.showLabels));
    else if (config.layout === 'bars') widget.append(barItem(key, item, config.showLabels));
    else widget.append(gaugeItem(key, item, indicator, config.showLabels));
  }
}

widget.addEventListener('click', () => window.usageTray.openDetails());
widget.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.usageTray.openSettings();
});
window.usageTray.onState((next) => { state = next; render(); });
window.usageTray.getState().then((next) => { state = next; render(); });
