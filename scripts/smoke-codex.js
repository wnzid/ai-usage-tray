const path = require('node:path');
const { CodexClient } = require('../src/codex-client');

const app = {
  isPackaged: false,
  getAppPath: () => path.resolve(__dirname, '..'),
  getVersion: () => '0.1.0',
};

async function main() {
  const client = new CodexClient(app);
  try {
    const result = await client.readUsage();
    console.log(result.account?.account ? 'Codex app-server responded with an authenticated account.' : 'Codex app-server responded; account is signed out.');
  } finally {
    client.stop();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
