const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const project = path.resolve(__dirname, '..');
  const svg = fs.readFileSync(path.join(project, 'assets', 'provider-mark.svg'), 'utf8');
  const window = new BrowserWindow({ width: 512, height: 512, show: true, frame: false, backgroundColor: '#000000', skipTaskbar: true });
  const document = `<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}svg{display:block;width:100%;height:100%;fill:#fff}</style>${svg}`;
  await window.loadURL(`data:text/html;base64,${Buffer.from(document).toString('base64')}`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const captured = await window.webContents.capturePage();
  fs.writeFileSync(path.join(project, 'assets', 'provider-mark.png'), captured.toPNG());
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
