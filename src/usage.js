const FIVE_HOURS = 5 * 60;
const WEEK = 7 * 24 * 60;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function normalizeWindow(raw, bucketId, position = 0) {
  if (!raw) return null;

  const durationMinutes = firstNumber(
    raw.windowDurationMins,
    raw.window_duration_mins,
    raw.windowDurationMinutes,
    raw.window_minutes,
  );
  const usedPercent = clamp(firstNumber(raw.usedPercent, raw.used_percent, raw.percentUsed, 0), 0, 100);
  const resetsAt = firstNumber(raw.resetsAt, raw.resets_at, raw.resetAt);

  let key = `window-${position + 1}`;
  let label = raw.label || raw.name || bucketId || `Usage window ${position + 1}`;
  if (durationMinutes === FIVE_HOURS) {
    key = 'fiveHour';
    label = '5-hour window';
  } else if (durationMinutes === WEEK) {
    key = 'weekly';
    label = 'Weekly window';
  }

  return {
    key,
    bucketId: bucketId || null,
    label,
    usedPercent,
    remainingPercent: Math.round((100 - usedPercent) * 10) / 10,
    durationMinutes,
    resetsAt,
  };
}

function extractRateLimitEntries(rateLimitsResult) {
  if (!rateLimitsResult) return [];
  const root = rateLimitsResult.rateLimits || rateLimitsResult;
  const buckets = root.rateLimitsByLimitId || rateLimitsResult.rateLimitsByLimitId;

  if (buckets && typeof buckets === 'object') {
    return Object.entries(buckets).flatMap(([bucketId, bucket]) => {
      const windows = [bucket.primary, bucket.secondary].filter(Boolean);
      return windows.map((window, index) => normalizeWindow(window, bucketId, index));
    });
  }

  return [root.primary, root.secondary]
    .filter(Boolean)
    .map((window, index) => normalizeWindow(window, null, index));
}

function dedupeAndOrder(windows) {
  const byKey = new Map();
  for (const window of windows.filter(Boolean)) {
    if (!byKey.has(window.key)) byKey.set(window.key, window);
  }
  const weight = { fiveHour: 0, weekly: 1 };
  return [...byKey.values()].sort((a, b) =>
    (weight[a.key] ?? 10) - (weight[b.key] ?? 10),
  );
}

function accountSummary(accountResult) {
  const account = accountResult?.account || accountResult;
  if (!account || accountResult?.account === null) return null;
  return {
    email: account.email || account.name || 'ChatGPT account',
    plan: account.planType || account.plan_type || account.plan || null,
  };
}

function buildUsageSnapshot(accountResult, rateLimitsResult) {
  const account = accountSummary(accountResult);
  if (!account) {
    return { kind: 'signedOut', account: null, windows: [], resetCredits: null, updatedAt: Date.now() };
  }

  const resetCredits =
    rateLimitsResult?.resetCredits ??
    rateLimitsResult?.rateLimits?.resetCredits ??
    rateLimitsResult?.rate_limits?.reset_credits ??
    null;

  return {
    kind: 'ready',
    account,
    windows: dedupeAndOrder(extractRateLimitEntries(rateLimitsResult)),
    resetCredits,
    updatedAt: Date.now(),
  };
}

module.exports = {
  FIVE_HOURS,
  WEEK,
  buildUsageSnapshot,
  extractRateLimitEntries,
  normalizeWindow,
};
