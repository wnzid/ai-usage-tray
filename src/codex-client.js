const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

function platformPackage() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32' && arch === 'x64') return ['@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'];
  if (platform === 'win32' && arch === 'arm64') return ['@openai', 'codex-win32-arm64', 'vendor', 'aarch64-pc-windows-msvc', 'bin', 'codex.exe'];
  throw new Error(`This release does not include Codex for ${platform}/${arch}.`);
}

function resolveCodexBinary(app) {
  if (process.env.CODEX_USAGE_CODEX_PATH && fs.existsSync(process.env.CODEX_USAGE_CODEX_PATH)) {
    return process.env.CODEX_USAGE_CODEX_PATH;
  }

  const parts = platformPackage();
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
    : path.join(app.getAppPath(), 'node_modules');
  const bundled = path.join(base, ...parts);
  if (fs.existsSync(bundled)) return bundled;

  throw new Error('The bundled Codex runtime could not be found. Reinstall AI Usage Tray.');
}

class CodexClient extends EventEmitter {
  constructor(app) {
    super();
    this.app = app;
    this.child = null;
    this.nextId = 1;
    this.pending = new Map();
    this.ready = null;
    this.lastError = '';
  }

  async start() {
    if (this.ready) return this.ready;
    this.ready = this.launch();
    return this.ready;
  }

  async launch() {
    const binary = resolveCodexBinary(this.app);
    this.child = spawn(binary, ['app-server'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, RUST_LOG: 'error' },
    });

    this.child.on('exit', (code) => {
      const message = this.lastError || `Codex app-server stopped (${code ?? 'unknown'}).`;
      for (const { reject } of this.pending.values()) reject(new Error(message));
      this.pending.clear();
      this.child = null;
      this.ready = null;
      this.emit('exit', message);
    });
    this.child.on('error', (error) => this.emit('error', error));
    this.child.stderr.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) this.lastError = line.split(/\r?\n/).at(-1);
    });

    const lines = readline.createInterface({ input: this.child.stdout });
    lines.on('line', (line) => this.handleLine(line));

    await this.request('initialize', {
      clientInfo: { name: 'ai_usage_tray', title: 'AI Usage Tray', version: this.app.getVersion() },
      capabilities: { experimentalApi: true },
    });
    this.notify('initialized', {});
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(message, 'id')) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || 'Codex request failed.'));
      else pending.resolve(message.result);
      return;
    }

    if (message.method) this.emit('notification', message);
  }

  request(method, params = {}, timeoutMs = 20_000) {
    if (!this.child?.stdin?.writable) return Promise.reject(new Error('Codex is not running.'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  notify(method, params = {}) {
    if (this.child?.stdin?.writable) {
      this.child.stdin.write(`${JSON.stringify({ method, params })}\n`);
    }
  }

  async readUsage() {
    await this.start();
    const account = await this.request('account/read', { refreshToken: false });
    if (!account?.account) return { account, rateLimits: null };
    const rateLimits = await this.request('account/rateLimits/read', {});
    return { account, rateLimits };
  }

  async startLogin() {
    await this.start();
    return this.request('account/login/start', {
      type: 'chatgpt',
      useHostedLoginSuccessPage: true,
      appBrand: 'codex',
    });
  }

  stop() {
    if (this.child && !this.child.killed) this.child.kill();
  }
}

module.exports = { CodexClient, resolveCodexBinary };
