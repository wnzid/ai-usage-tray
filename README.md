# AI Usage Tray

A minimalist Windows taskbar app that shows how much ChatGPT-backed Codex usage you have left.

![Settings preview](docs/settings-preview.png)

## What it does

- Shows independent taskbar gauges for the **5-hour** and **weekly** usage windows.
- Lets you enable either gauge, both, or neither.
- Lets you put the OpenAI knot or the remaining percentage in the center of each ring.
- Drains the ring clockwise as usage is consumed.
- Opens a compact usage popup when you click a gauge.
- Supports optional launch at Windows sign-in and configurable refresh intervals.
- Uses a browser-based ChatGPT sign-in. No API key or copied browser cookie is required.

The app reports Codex usage limits associated with the signed-in ChatGPT account. It does not report API billing credits or general ChatGPT message caps.

## Install

Download either Windows release:

- `AI-Usage-Tray-0.1.0-x64.exe` — normal installer.
- `AI-Usage-Tray-0.1.0-portable.exe` — portable executable, no installation required.

On first launch, select **Sign in** and complete the ChatGPT authorization in your browser. Closing the settings window keeps the tray gauges running. Right-click a gauge to reopen settings, refresh, or quit.

This initial unsigned build may trigger a Windows SmartScreen warning. Production distribution should use an Authenticode code-signing certificate.

## Development

Requires Node.js 22 or newer on Windows 10/11.

```powershell
npm install
npm start
```

Run tests and create Windows releases:

```powershell
npm test
npm run dist
```

The official `@openai/codex` package is bundled so end users do not need to install the Codex CLI separately.

## Privacy

Authentication and usage requests are handled by the local Codex app-server. Credentials remain in Codex's local credential store. AI Usage Tray stores only display preferences in its Electron user-data folder.

## License

MIT. Bundled third-party components retain their respective licenses; Codex is distributed under Apache-2.0.
