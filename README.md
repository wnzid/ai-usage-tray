<div align="center">
  <img src="assets/app-mark.svg" width="88" alt="AI Usage Tray logo" />
  <h1>AI Usage Tray</h1>
  <p><strong>OpenAI Work and Codex usage limits, visible beside the Windows clock.</strong></p>
  <p>
    <img alt="Windows 10 and 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows11&amp;logoColor=white" />
    <img alt="Release 0.1.1" src="https://img.shields.io/badge/release-v0.1.1-60CDFF" />
    <img alt="MPL 2.0 License" src="https://img.shields.io/badge/license-MPL--2.0-6ccb8e" />
  </p>
</div>

AI Usage Tray (AIU) turns usage windows normally buried in an account menu into a compact Windows taskbar widget. It shows remaining usage, reset times, and whether a reading is live or cached—without copying browser cookies or asking for an API key.

![AI Usage Tray settings dashboard](docs/settings-preview.png)

## Why AIU

- Independent 5-hour and weekly remaining-usage meters
- Native taskbar attachment with notification-area fallback
- Ring, percentage, and progress-bar layouts
- System accent color, light/dark mode, high contrast, and reduced motion
- Optional warning and breathing states at 5% remaining, plus a distinct `EMPTY` state
- Flicker-resistant refreshes that retain the last valid reading on temporary failures

## Provider support

| Provider | Status | Available today |
| --- | --- | --- |
| OpenAI Work & Codex | Supported | Sign-in, rate-limit windows, reset times, refresh, cached fallback, taskbar/tray meters |
| Claude | In progress | Desktop/Code detection and safe shortcuts; no automatic meter |
| Gemini | In progress | Manual web shortcut; no automatic meter |

![Connection settings with provider status](docs/connections-preview.png)

AIU reads metered Codex buckets associated with the signed-in ChatGPT account. It does not report ordinary ChatGPT message limits or OpenAI API billing credits.

## Install

Download a Windows build from [Releases](/releases/latest):

- `AI-Usage-Tray-0.1.1-x64.exe` — installer
- `AI-Usage-Tray-0.1.1-portable.exe` — portable build

The official `@openai/codex` runtime is bundled. The first community build is unsigned, so verify the published SHA-256 checksums before running it.

## How it works

```text
OpenAI browser sign-in
        ↓
Bundled Codex app-server
        ↓
Account and rate-limit events
        ↓
Normalized remaining usage
        ↓
Taskbar widget · tray gauges · settings dashboard
```

The app listens for account and rate-limit updates, converts `usedPercent` into remaining usage, and retries failed refreshes with bounded backoff.

## Privacy and security

- Authentication uses OpenAI's browser-based flow.
- Credentials remain in the Codex credential store.
- AIU stores display preferences, not copied cookies or passwords.
- Diagnostics omit account email, tokens, raw service errors, and executable paths.
- Claude detection reads installation/running metadata only; Gemini is not scraped.

## Development

Requirements: Windows 10/11 and Node.js 22 or newer.

```powershell
npm ci
npm start
```

```powershell
npm test       # Node test suite
npm run pack   # unpacked application
npm run dist   # installer and portable builds
```

## Project structure

```text
src/main.js             Electron lifecycle, windows, taskbar, tray, refresh
src/codex-client.js     Codex app-server JSON-RPC client
src/usage.js            Rate-limit normalization
src/settings-store.js   Validated local preferences
renderer/               Settings, widget, and details interfaces
scripts/                Packaging, smoke checks, taskbar helper
tests/                  Node test suite
```

## Troubleshooting

**The settings window closed.** AIU continues in the notification area; right-click the AIU icon to reopen settings or quit.

**The widget moved to the tray.** Check **Connections → Connection diagnostics**. Explorer restarts and display-scaling changes can temporarily interrupt taskbar attachment; AIU retries safely.

**The reading says “Saved data.”** The latest refresh failed and AIU is showing the last valid values while retrying.

## License and attribution

Licensed under [MPL-2.0](LICENSE). Bundled components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

AI Usage Tray is independent and is not affiliated with or endorsed by OpenAI, Anthropic, Google, or Microsoft.
