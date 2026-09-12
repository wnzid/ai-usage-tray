const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUsageSnapshot, extractRateLimitEntries, normalizeWindow } = require('../src/usage');
const { sanitizeSettings } = require('../src/settings-store');

test('classifies five-hour and weekly windows and converts used to remaining', () => {
  const windows = extractRateLimitEntries({
    rateLimits: {
      primary: { usedPercent: 31.2, windowDurationMins: 300, resetsAt: 123 },
      secondary: { usedPercent: 76, windowDurationMins: 10080, resetsAt: 456 },
    },
  });

  assert.deepEqual(windows.map((window) => window.key), ['fiveHour', 'weekly']);
  assert.equal(windows[0].remainingPercent, 68.8);
  assert.equal(windows[1].remainingPercent, 24);
});

test('supports multiple named rate-limit buckets without duplicating known windows', () => {
  const snapshot = buildUsageSnapshot(
    { account: { email: 'person@example.com', planType: 'plus' } },
    {
      rateLimitsByLimitId: {
        codex: {
          primary: { usedPercent: 10, windowDurationMins: 300 },
          secondary: { usedPercent: 20, windowDurationMins: 10080 },
        },
        fallback: { primary: { usedPercent: 99, windowDurationMins: 300 } },
      },
    },
  );

  assert.equal(snapshot.kind, 'ready');
  assert.equal(snapshot.account.email, 'person@example.com');
  assert.deepEqual(snapshot.windows.map((window) => window.remainingPercent), [90, 80]);
});

test('returns signed-out state for a null account', () => {
  assert.equal(buildUsageSnapshot({ account: null }, null).kind, 'signedOut');
});

test('clamps malformed usage percentages', () => {
  assert.equal(normalizeWindow({ usedPercent: 140 }, null).remainingPercent, 0);
  assert.equal(normalizeWindow({ usedPercent: -5 }, null).remainingPercent, 100);
});

test('sanitizes settings and preserves safe choices', () => {
  const value = sanitizeSettings({
    indicators: {
      fiveHour: { enabled: false, center: 'percentage', color: '#123456' },
      weekly: { enabled: true, center: 'anything', color: 'unsafe' },
    },
    refreshMinutes: 15,
    launchAtLogin: true,
  });

  assert.deepEqual(value, {
    displayLocation: 'taskbar',
    alwaysShowTrayIcon: true,
    indicators: {
      fiveHour: { enabled: false, center: 'percentage', color: '#123456' },
      weekly: { enabled: true, center: 'percentage', color: '#E5A878' },
    },
    refreshMinutes: 15,
    launchAtLogin: true,
    taskbar: {
      position: 'start',
      layout: 'gauges',
      size: 34,
      background: 'subtle',
      showLabels: true,
      fontSize: 10,
      lowRemainingAlert: true,
      breathing: true,
      offset: 0,
    },
  });
});

test('uses the intended default center displays', () => {
  const value = sanitizeSettings();
  assert.equal(value.indicators.fiveHour.center, 'logo');
  assert.equal(value.indicators.weekly.center, 'percentage');
  assert.equal(value.displayLocation, 'taskbar');
  assert.equal(value.taskbar.position, 'start');
});

test('sanitizes taskbar customization controls', () => {
  const value = sanitizeSettings({
    displayLocation: 'both',
    taskbar: {
      position: 'end',
      layout: 'bars',
      size: 99,
      background: 'solid',
      showLabels: false,
      fontSize: 30,
      lowRemainingAlert: false,
      breathing: false,
      offset: -999,
    },
  });
  assert.equal(value.displayLocation, 'both');
  assert.deepEqual(value.taskbar, {
    position: 'end',
    layout: 'bars',
    size: 44,
    background: 'solid',
    showLabels: false,
    fontSize: 16,
    lowRemainingAlert: false,
    breathing: false,
    offset: -240,
  });
});
