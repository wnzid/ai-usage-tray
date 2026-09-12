function buildDiagnosticReport(state, environment = {}) {
  const version = environment.version || 'unknown';
  const platform = environment.platform || process.platform;
  const arch = environment.arch || process.arch;
  const generatedAt = environment.generatedAt || new Date().toISOString();
  const diagnostics = state.diagnostics || {};

  return {
    app: 'AI Usage Tray',
    version,
    generatedAt,
    system: `${platform} ${arch}`,
    usageState: state.usage?.kind || 'unknown',
    enabledMeters: Object.entries(state.settings?.indicators || {})
      .filter(([, value]) => value.enabled)
      .map(([key]) => key),
    displayLocation: state.settings?.displayLocation || 'unknown',
    taskbarAttachment: state.taskbarAttachment || 'unknown',
    taskbarPlacement: state.taskbarPlacement?.note || null,
    lastRefreshAttemptAt: diagnostics.lastRefreshAttemptAt || null,
    lastSuccessfulRefreshAt: diagnostics.lastSuccessfulRefreshAt || null,
    nextRefreshAt: diagnostics.nextRefreshAt || null,
    retryFailures: diagnostics.retryFailures || 0,
    errorCode: state.errorCode || null,
  };
}

module.exports = { buildDiagnosticReport };
