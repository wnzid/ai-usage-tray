# Changelog

All notable changes to AI Usage Tray are documented here.

## [0.1.1] - 2026-09-13

### Changed

- Licensed new releases and source changes under the Mozilla Public License 2.0.
- Added in-app source and license information plus bundled third-party notices.

### License history

- Version 0.1.0 remains available under the MIT License under which it was originally released.
- Version 0.1.1 and later contributions are distributed under MPL-2.0.

## [0.1.0] - 2026-09-13

### Added

- Native Windows taskbar widget with taskbar, tray, and combined placement modes.
- OpenAI browser sign-in through the bundled Codex app-server.
- Five-hour and weekly Work & Codex remaining-usage meters with reset countdowns.
- Gauge, compact-percentage, and progress-bar layouts.
- Independent colors, sizing, labels, surface, placement, and offset controls.
- Low-remaining and empty states, with an optional reduced-motion-aware breathing warning.
- Windows 11 Fluent settings dashboard and first-run setup.
- Light/dark themes, Windows accent colors, keyboard support, high contrast, and reduced motion.
- Saved-data fallback, bounded refresh retries, resume refresh, and privacy-safe diagnostics.
- Claude Desktop/Code detection and shortcuts, explicitly labeled WIP.
- Gemini manual shortcut, explicitly labeled WIP.

### Known limitations

- Claude and Gemini do not expose supported consumer usage sources used by AIU, so no automatic meters are shown for them.
- Regular ChatGPT conversation limits and OpenAI API billing are outside this release’s scope.
- Windows binaries are not code-signed and may trigger SmartScreen.
