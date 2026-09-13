const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProviderSnapshot, detectClaudeDesktop, detectExecutable } = require('../src/providers');

test('reports a connected OpenAI provider for ready usage', () => {
  const providers = buildProviderSnapshot(
    { kind: 'ready', account: { plan: 'Plus' } },
    { kind: 'missing' },
    { kind: 'missing' },
  );
  assert.equal(providers.openai.state, 'connected');
  assert.equal(providers.openai.action, 'Refresh');
  assert.equal(providers.claude.state, 'inactive');
  assert.equal(providers.claude.capability, 'WIP');
  assert.equal(providers.gemini.source, 'Browser companion required');
  assert.equal(providers.gemini.capability, 'WIP');
});

test('offers OpenAI connection when signed out', () => {
  const providers = buildProviderSnapshot({ kind: 'signedOut' }, { kind: 'detected' }, { kind: 'missing' });
  assert.equal(providers.openai.action, 'Connect');
  assert.equal(providers.claude.label, 'Claude Code detected');
});

test('reports saved data when the latest OpenAI refresh failed', () => {
  const providers = buildProviderSnapshot(
    { kind: 'ready', account: { plan: 'Plus' } },
    { kind: 'missing' },
    { kind: 'missing' },
    { lastError: 'offline' },
  );
  assert.equal(providers.openai.state, 'error');
  assert.equal(providers.openai.label, 'Showing saved data');
});

test('detects a local provider executable without exposing its path', async () => {
  const fakeExec = (_command, _args, _options, callback) => callback(null, 'C:\\Tools\\claude.exe\r\n');
  assert.deepEqual(await detectExecutable(fakeExec), { kind: 'detected' });
});

test('handles a missing local provider executable', async () => {
  const fakeExec = (_command, _args, _options, callback) => callback(new Error('missing'), '');
  assert.deepEqual(await detectExecutable(fakeExec), { kind: 'missing' });
});

test('reports a detected Claude Desktop installation without exposing its path', () => {
  const providers = buildProviderSnapshot(
    { kind: 'ready', account: { plan: 'Plus' } },
    { kind: 'missing' },
    { kind: 'detected', running: true, version: '1.2.3', executablePath: 'C:\\private\\Claude.exe' },
  );
  assert.equal(providers.claude.state, 'connected');
  assert.equal(providers.claude.action, 'View');
  assert.equal(providers.claude.desktop.version, '1.2.3');
  assert.equal(JSON.stringify(providers.claude).includes('C:\\private'), false);
});

test('parses Claude Desktop detection output', async () => {
  const fakeExec = (_command, _args, _options, callback) => callback(null, JSON.stringify({
    kind: 'detected',
    running: false,
    version: '1.2.3',
    executablePath: 'C:\\Program Files\\Claude.exe',
  }));
  assert.deepEqual(await detectClaudeDesktop(fakeExec, 'win32', { SystemRoot: 'C:\\Windows' }), {
    kind: 'detected',
    running: false,
    version: '1.2.3',
    executablePath: 'C:\\Program Files\\Claude.exe',
  });
});
