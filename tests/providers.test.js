const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProviderSnapshot, detectExecutable } = require('../src/providers');

test('reports a connected OpenAI provider for ready usage', () => {
  const providers = buildProviderSnapshot(
    { kind: 'ready', account: { plan: 'Plus' } },
    { kind: 'missing' },
  );
  assert.equal(providers.openai.state, 'connected');
  assert.equal(providers.openai.action, 'Refresh');
  assert.equal(providers.claude.state, 'inactive');
  assert.equal(providers.gemini.source, 'Browser companion required');
});

test('offers OpenAI connection when signed out', () => {
  const providers = buildProviderSnapshot({ kind: 'signedOut' }, { kind: 'detected' });
  assert.equal(providers.openai.action, 'Connect');
  assert.equal(providers.claude.label, 'Claude Code detected');
});

test('detects a local provider executable without exposing its path', async () => {
  const fakeExec = (_command, _args, _options, callback) => callback(null, 'C:\\Tools\\claude.exe\r\n');
  assert.deepEqual(await detectExecutable(fakeExec), { kind: 'detected' });
});

test('handles a missing local provider executable', async () => {
  const fakeExec = (_command, _args, _options, callback) => callback(new Error('missing'), '');
  assert.deepEqual(await detectExecutable(fakeExec), { kind: 'missing' });
});
