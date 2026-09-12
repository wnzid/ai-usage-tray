const RETRY_DELAYS_MS = Object.freeze([15_000, 30_000, 60_000, 120_000, 300_000]);

function retryDelay(failureCount) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, Number(failureCount || 1) - 1));
  return RETRY_DELAYS_MS[index];
}

function normalDelay(refreshMinutes) {
  return Math.max(1, Number(refreshMinutes) || 2) * 60_000;
}

module.exports = { RETRY_DELAYS_MS, normalDelay, retryDelay };
