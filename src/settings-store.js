const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  indicators: {
    fiveHour: { enabled: true, center: 'logo' },
    weekly: { enabled: true, center: 'percentage' },
  },
  refreshMinutes: 2,
  launchAtLogin: false,
});

function indicator(value, fallback) {
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : fallback.enabled,
    center: value?.center === 'percentage' || value?.center === 'logo' ? value.center : fallback.center,
  };
}

function sanitizeSettings(value = {}) {
  const allowedRefresh = [1, 2, 5, 15];
  return {
    indicators: {
      fiveHour: indicator(value.indicators?.fiveHour, DEFAULT_SETTINGS.indicators.fiveHour),
      weekly: indicator(value.indicators?.weekly, DEFAULT_SETTINGS.indicators.weekly),
    },
    refreshMinutes: allowedRefresh.includes(Number(value.refreshMinutes))
      ? Number(value.refreshMinutes)
      : DEFAULT_SETTINGS.refreshMinutes,
    launchAtLogin: Boolean(value.launchAtLogin),
  };
}

class SettingsStore {
  constructor(userDataPath) {
    this.file = path.join(userDataPath, 'settings.json');
    this.value = this.read();
  }

  read() {
    try {
      return sanitizeSettings(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch {
      return sanitizeSettings();
    }
  }

  update(next) {
    this.value = sanitizeSettings(next);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(this.value, null, 2)}\n`, 'utf8');
    return this.value;
  }
}

module.exports = { DEFAULT_SETTINGS, SettingsStore, sanitizeSettings };
