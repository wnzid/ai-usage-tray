const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyError, errorText, publicError } = require('../src/errors');

test('turns network failures into a helpful offline message', () => {
  assert.deepEqual(classifyError(new Error('read ECONNRESET')), {
    code: 'offline',
    message: 'You appear to be offline. Showing the latest available usage.',
  });
});

test('identifies sign-in and taskbar attachment failures', () => {
  assert.equal(classifyError('401 unauthorized').code, 'authentication');
  assert.equal(classifyError('Taskbar attachment failed: access denied').code, 'taskbar-attachment');
});

test('does not expose raw service output through the public error', () => {
  const result = publicError('spawn C:\\Users\\Someone\\secret\\codex.exe ENOENT');
  assert.equal(result.code, 'service-start');
  assert.equal(result.message.includes('Someone'), false);
});

test('normalizes multiline error text for internal handling', () => {
  assert.equal(errorText(new Error('first\n second')), 'first second');
  assert.equal(publicError(null), null);
});
