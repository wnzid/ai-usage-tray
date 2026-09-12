const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  displayLocation: 'taskbar',
  indicators: {
    fiveHour: { enabled: true, center: 'logo' },
    weekly: { enabled: true, center: 'percentage' },
  },
  refreshMinutes: 2,
  launchAtLogin: false,
  taskbar: {
    position: 'start',
    layout: 'gauges',
    size: 34,
    background: 'subtle',
    showLabels: true,
    offset: 0,
  },
});

function indicator(value, fallback) {
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : fallback.enabled,
    center: value?.center === 'percentage' || value?.center === 'logo' ? value.center : fallback.center,
  };
}

function sanitizeSettings(value = {}) {
  const allowedRefresh = [1, 2, 5, 15];
  const displayLocations = ['taskbar', 'tray', 'both'];
  const positions = ['start', 'center', 'end'];
  const layouts = ['gauges', 'compact', 'bars'];
  const backgrounds = ['none', 'subtle', 'solid'];
  return {
    displayLocation: displayLocations.includes(value.displayLocation)
      ? value.displayLocation
      : DEFAULT_SETTINGS.displayLocation,
    indicators: {
      fiveHour: indicator(value.indicators?.fiveHour, DEFAULT_SETTINGS.indicators.fiveHour),
      weekly: indicator(value.indicators?.weekly, DEFAULT_SETTINGS.indicators.weekly),
    },
    refreshMinutes: allowedRefresh.includes(Number(value.refreshMinutes))
      ? Number(value.refreshMinutes)
      : DEFAULT_SETTINGS.refreshMinutes,
    launchAtLogin: Boolean(value.launchAtLogin),
    taskbar: {
      position: positions.includes(value.taskbar?.position) ? value.taskbar.position : DEFAULT_SETTINGS.taskbar.position,
      layout: layouts.includes(value.taskbar?.layout) ? value.taskbar.layout : DEFAULT_SETTINGS.taskbar.layout,
      size: Math.round(Math.min(44, Math.max(24, Number(value.taskbar?.size) || DEFAULT_SETTINGS.taskbar.size))),
      background: backgrounds.includes(value.taskbar?.background) ? value.taskbar.background : DEFAULT_SETTINGS.taskbar.background,
      showLabels: typeof value.taskbar?.showLabels === 'boolean' ? value.taskbar.showLabels : DEFAULT_SETTINGS.taskbar.showLabels,
      offset: Math.round(Math.min(240, Math.max(-240, Number(value.taskbar?.offset) || 0))),
    },
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
