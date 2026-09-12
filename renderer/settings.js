let currentState;
let saving = false;

const $ = (selector) => document.querySelector(selector);

function usageWindow(key) {
  return currentState?.usage?.windows?.find((item) => item.key === key);
}

function setGauge(container, item, center, enabled) {
  const gauge = container.querySelector('.gauge');
  const centerElement = gauge.querySelector('.gauge-center');
  const remaining = Math.round(item?.remainingPercent ?? 0);
  gauge.style.setProperty('--value', remaining);
  container.classList.toggle('disabled', !enabled);
  gauge.dataset.center = center;
  centerElement.className = `gauge-center${center === 'logo' ? ' logo-mask' : ''}`;
  centerElement.textContent = center === 'percentage' ? remaining : '';
  container.querySelector('.preview-value').textContent = item ? `${remaining}% left` : 'Waiting for data';
}

function renderStatus() {
  const pill = $('#status-pill');
  const label = pill.querySelector('span');
  pill.classList.remove('ready', 'error');
  if (currentState.refreshing) {
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
    $('#account-plan').textContent = `${account.plan || 'ChatGPT'} plan · Updated automatically`;
  } else if (signedOut) {
    $('#account-name').textContent = 'Connect your ChatGPT account';
    $('#account-plan').textContent = 'A browser window will open for secure sign-in.';
  } else if (currentState.error) {
    $('#account-name').textContent = 'Could not read usage';
    $('#account-plan').textContent = currentState.error;
  } else {
    $('#account-name').textContent = 'Checking your account…';
    $('#account-plan').textContent = 'Usage is read securely through Codex.';
  }
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderTaskbarPreview(settings = currentState.settings) {
  const preview = $('#taskbar-preview-widget');
  const config = settings.taskbar;
  preview.className = `taskbar-preview-widget position-${config.position} preview-background-${config.background}`;
  preview.style.setProperty('--preview-size', `${config.size}px`);
  preview.replaceChildren();

  const enabledKeys = ['fiveHour', 'weekly'].filter((key) => settings.indicators[key].enabled);
  if (config.layout === 'bars') {
    const set = document.createElement('div');
    set.className = 'preview-bar-set';
    for (const key of enabledKeys) {
      const remaining = Math.round(usageWindow(key)?.remainingPercent ?? 0);
      const row = document.createElement('div');
      row.className = 'preview-bar-row';
      row.append(createTextElement('span', '', config.showLabels ? (key === 'fiveHour' ? '5H' : '7D') : ''));
      const track = document.createElement('span');
      track.className = 'preview-bar-track';
      const fill = document.createElement('i');
      fill.style.setProperty('--value', remaining);
      track.append(fill);
      row.append(track, createTextElement('strong', '', `${remaining}%`));
      set.append(row);
    }
    preview.append(set);
    return;
  }

  for (const key of enabledKeys) {
    const remaining = Math.round(usageWindow(key)?.remainingPercent ?? 0);
    const chip = document.createElement('div');
    chip.className = 'preview-chip';
    if (config.layout === 'compact') {
      const ring = document.createElement('i');
      ring.className = 'compact-ring';
      ring.style.setProperty('--value', remaining);
      chip.append(ring);
      if (config.showLabels) chip.append(createTextElement('em', '', key === 'fiveHour' ? '5H' : '7D'));
      chip.append(createTextElement('strong', '', `${remaining}%`));
    } else {
      const ring = document.createElement('span');
      ring.className = 'preview-mini-ring';
      ring.style.setProperty('--value', remaining);
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

function renderTaskbarControls() {
  const settings = currentState.settings;
  document.querySelector(`input[name="display-location"][value="${settings.displayLocation}"]`).checked = true;
  document.querySelector(`input[name="taskbar-position"][value="${settings.taskbar.position}"]`).checked = true;
  $('#taskbar-layout').value = settings.taskbar.layout;
  $('#taskbar-background').value = settings.taskbar.background;
  $('#taskbar-labels').checked = settings.taskbar.showLabels;
  $('#taskbar-size').value = settings.taskbar.size;
  $('#taskbar-offset').value = settings.taskbar.offset;
  $('#taskbar-size-value').textContent = `${settings.taskbar.size} px`;
  $('#taskbar-offset-value').textContent = `${settings.taskbar.offset > 0 ? '+' : ''}${settings.taskbar.offset} px`;
  $('#taskbar-options').classList.toggle('disabled', settings.displayLocation === 'tray');

  const attachment = $('#taskbar-attach-state');
  attachment.classList.remove('attached', 'error');
  if (settings.displayLocation === 'tray') {
    attachment.querySelector('span').textContent = 'Taskbar widget is disabled';
  } else if (currentState.taskbarAttachment === 'attached') {
    attachment.classList.add('attached');
    attachment.querySelector('span').textContent = 'Attached to the Windows taskbar';
  } else if (currentState.taskbarAttachment === 'error') {
    attachment.classList.add('error');
    attachment.querySelector('span').textContent = 'Could not attach · tray fallback enabled';
  } else {
    attachment.querySelector('span').textContent = 'Attaching to the Windows taskbar…';
  }
  renderTaskbarPreview();
}

function render() {
  if (!currentState) return;
  renderStatus();
  renderAccount();
  renderTaskbarControls();
  const settings = currentState.settings;

  for (const key of ['fiveHour', 'weekly']) {
    const config = settings.indicators[key];
    $(`#${key}-enabled`).checked = config.enabled;
    document.querySelector(`input[name="${key}-center"][value="${config.center}"]`).checked = true;
    $(`#${key}-card`).classList.toggle('disabled', !config.enabled);
    for (const radio of document.querySelectorAll(`input[name="${key}-center"]`)) radio.disabled = !config.enabled;
  }

  $('#refresh-minutes').value = String(settings.refreshMinutes);
  $('#launch-at-login').checked = settings.launchAtLogin;
  setGauge($('#preview-five'), usageWindow('fiveHour'), settings.indicators.fiveHour.center, settings.indicators.fiveHour.enabled);
  setGauge($('#preview-weekly'), usageWindow('weekly'), settings.indicators.weekly.center, settings.indicators.weekly.enabled);
}

function settingsFromForm() {
  return {
    displayLocation: document.querySelector('input[name="display-location"]:checked').value,
    indicators: {
      fiveHour: {
        enabled: $('#fiveHour-enabled').checked,
        center: document.querySelector('input[name="fiveHour-center"]:checked').value,
      },
      weekly: {
        enabled: $('#weekly-enabled').checked,
        center: document.querySelector('input[name="weekly-center"]:checked').value,
      },
    },
    refreshMinutes: Number($('#refresh-minutes').value),
    launchAtLogin: $('#launch-at-login').checked,
    taskbar: {
      position: document.querySelector('input[name="taskbar-position"]:checked').value,
      layout: $('#taskbar-layout').value,
      size: Number($('#taskbar-size').value),
      background: $('#taskbar-background').value,
      showLabels: $('#taskbar-labels').checked,
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
  if (!event.target.matches('input[type="range"]')) return;
  $('#taskbar-size-value').textContent = `${$('#taskbar-size').value} px`;
  const offset = Number($('#taskbar-offset').value);
  $('#taskbar-offset-value').textContent = `${offset > 0 ? '+' : ''}${offset} px`;
  renderTaskbarPreview(settingsFromForm());
});
$('#refresh-button').addEventListener('click', () => window.usageTray.refresh());
$('#signin-button').addEventListener('click', () => window.usageTray.signIn());

window.usageTray.onState((state) => {
  currentState = state;
  render();
});
window.usageTray.getState().then((state) => {
  currentState = state;
  render();
});
