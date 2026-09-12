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

function render() {
  if (!currentState) return;
  renderStatus();
  renderAccount();
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
