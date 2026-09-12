const fs = require('node:fs');
const path = require('node:path');
const { createGaugeBuffer } = require('../src/tray-gauge');

const project = path.resolve(__dirname, '..');
const app = { getAppPath: () => project };
const output = createGaugeBuffer({ app, remaining: 68, center: 'logo', dark: true, connected: true, size: 512 });
fs.writeFileSync(path.join(project, 'assets', 'icon.png'), output);
