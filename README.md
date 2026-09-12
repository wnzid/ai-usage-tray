# AI Usage Tray

A minimalist Windows taskbar app that shows how much ChatGPT-backed Codex usage you have left. The project is currently in its design and development stage; release executables will be produced after the interface is approved.

![Settings preview](docs/settings-preview.png)

## What it does

- Shows independent taskbar gauges for the **5-hour** and **weekly** usage windows.
- Can live directly inside the Windows taskbar, in the system tray, or in both places.
- Supports start, center, and end taskbar placement with a fine-position slider.
- Includes circular, compact-number, and progress-bar layouts with adjustable sizing, labels, and backgrounds.
- Lets you enable either gauge, both, or neither.
- Lets you put the OpenAI knot or the remaining percentage in the center of each ring.
- Drains the ring clockwise as usage is consumed.
- Opens a compact usage popup when you click a gauge.
- Supports optional launch at Windows sign-in and configurable refresh intervals.
- Uses a browser-based ChatGPT sign-in. No API key or copied browser cookie is required.

The app reports Codex usage limits associated with the signed-in ChatGPT account. It does not report API billing credits or general ChatGPT message caps.

## Development

Requires Node.js 22 or newer on Windows 10/11.

```powershell
npm install
npm start
```

Run the tests:

```powershell
npm test
```

When the design is finalized, `npm run dist` will produce the installer and portable Windows release.

The official `@openai/codex` package is bundled so end users do not need to install the Codex CLI separately.

## Privacy

Authentication and usage requests are handled by the local Codex app-server. Credentials remain in Codex's local credential store. AI Usage Tray stores only display preferences in its Electron user-data folder.

## License

MIT. Bundled third-party components retain their respective licenses; Codex is distributed under Apache-2.0.
