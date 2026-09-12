let state;
let lastFingerprint = '';
const widget = document.querySelector('#taskbar-widget');

function currentWindow(key) {
  return state.usage.windows.find((item) => item.key === key);
}

function remainingFor(item) {
  return Math.max(0, Math.min(100, Math.round(item?.remainingPercent ?? 0)));
}

function applyMeterState(element, remaining, indicator, taskbar) {
  element.style.setProperty('--value', remaining);
  element.style.setProperty('--meter-color', indicator.color);
  element.classList.toggle('is-critical', taskbar.lowRemainingAlert && remaining > 0 && remaining <= 5);
  element.classList.toggle('is-empty', remaining === 0);
}

function gaugeItem(key, item, indicator, taskbar) {
  const remaining = remainingFor(item);
  const element = document.createElement('div');
  element.className = 'task-item';
  applyMeterState(element, remaining, indicator, taskbar);

  const gauge = document.createElement('div');
  gauge.className = 'task-gauge';
  const center = document.createElement('span');
  center.className = `task-gauge-center${indicator.center === 'logo' ? ' provider-mark' : ''}`;
  if (indicator.center === 'percentage') center.textContent = remaining;
  gauge.append(center);
  element.append(gauge);

  if (taskbar.showLabels) {
    const caption = document.createElement('span');
    caption.className = 'task-caption';
    const title = document.createElement('strong');
    title.textContent = key === 'fiveHour' ? '5H' : '7D';
    const value = document.createElement('span');
    value.textContent = remaining === 0 ? 'EMPTY' : `${remaining}%`;
    caption.append(title, value);
    element.append(caption);
  }
  return element;
}

function compactItem(key, item, indicator, taskbar) {
  const remaining = remainingFor(item);
  const element = document.createElement('div');
  element.className = 'task-item';
  applyMeterState(element, remaining, indicator, taskbar);
  const ring = document.createElement('i');
  ring.className = 'compact-ring';
  const label = document.createElement('span');
  label.className = 'compact-key';
  label.textContent = key === 'fiveHour' ? '5H' : '7D';
  const value = document.createElement('strong');
  value.className = 'compact-value';
  value.textContent = remaining === 0 ? 'EMPTY' : `${remaining}%`;
  element.append(ring);
  if (taskbar.showLabels) element.append(label);
  element.append(value);
  return element;
}

function barItem(key, item, indicator, taskbar) {
  const remaining = remainingFor(item);
  const element = document.createElement('div');
  element.className = 'task-item';
  applyMeterState(element, remaining, indicator, taskbar);
  const label = document.createElement('span');
  label.className = 'bar-key';
  label.textContent = taskbar.showLabels ? (key === 'fiveHour' ? '5H' : '7D') : '';
  const track = document.createElement('span');
  track.className = 'bar-track';
  const fill = document.createElement('i');
  fill.className = 'bar-fill';
  track.append(fill);
  const value = document.createElement('strong');
  value.className = 'bar-value';
  value.textContent = remaining === 0 ? 'EMPTY' : `${remaining}%`;
  element.append(label, track, value);
  return element;
}

function fingerprint() {
  const enabled = ['fiveHour', 'weekly']
    .filter((key) => state.settings.indicators[key].enabled)
    .map((key) => ({
      key,
      remaining: remainingFor(currentWindow(key)),
      ...state.settings.indicators[key],
    }));
  return JSON.stringify({ taskbar: state.settings.taskbar, enabled });
}

function render() {
  if (!state) return;
  const nextFingerprint = fingerprint();
  if (nextFingerprint === lastFingerprint) return;
  lastFingerprint = nextFingerprint;

  const taskbar = state.settings.taskbar;
  widget.className = `taskbar-widget layout-${taskbar.layout} background-${taskbar.background}${taskbar.breathing ? ' effects-breathing' : ''}`;
  widget.style.setProperty('--size', `${taskbar.size}px`);
  widget.style.setProperty('--font-size', `${taskbar.fontSize}px`);
  const fragment = document.createDocumentFragment();

  for (const key of ['fiveHour', 'weekly']) {
    const indicator = state.settings.indicators[key];
    if (!indicator.enabled) continue;
    const item = currentWindow(key);
    if (taskbar.layout === 'compact') fragment.append(compactItem(key, item, indicator, taskbar));
    else if (taskbar.layout === 'bars') fragment.append(barItem(key, item, indicator, taskbar));
    else fragment.append(gaugeItem(key, item, indicator, taskbar));
  }
  widget.replaceChildren(fragment);
}

widget.addEventListener('click', () => window.usageTray.openDetails());
widget.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.usageTray.openSettings();
});
window.usageTray.onState((next) => { state = next; render(); });
window.usageTray.getState().then((next) => { state = next; render(); });
