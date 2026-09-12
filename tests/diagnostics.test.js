const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDiagnosticReport } = require('../src/diagnostics');

test('builds useful diagnostics without account data or raw errors', () => {
  const report = buildDiagnosticReport({
    usage: { kind: 'ready', account: { email: 'private@example.com' } },
    settings: {
      displayLocation: 'both',
      indicators: { fiveHour: { enabled: true }, weekly: { enabled: false } },
    },
    taskbarAttachment: 'attached',
    taskbarPlacement: { note: 'Placed beside Windows controls', internalPath: 'C:\\private' },
    error: 'raw secret output',
    errorCode: 'offline',
    diagnostics: { retryFailures: 2, lastSuccessfulRefreshAt: 1000 },
  }, {
    version: '0.1.0',
    platform: 'win32',
    arch: 'x64',
    generatedAt: '2026-09-13T00:00:00.000Z',
  });

  const serialized = JSON.stringify(report);
  assert.deepEqual(report.enabledMeters, ['fiveHour']);
  assert.equal(report.system, 'win32 x64');
  assert.equal(report.retryFailures, 2);
  assert.equal(serialized.includes('private@example.com'), false);
  assert.equal(serialized.includes('raw secret output'), false);
  assert.equal(serialized.includes('C:\\private'), false);
});
