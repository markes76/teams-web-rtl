# Contributing

Use Node.js 22 or later on macOS for development. Run `npm ci`, then `npm test`. The Electron dependency supplies a local Chromium test harness only. It is not a supported Teams login client.

`preload.cjs` owns the direction engine and sidebar code. After changing it, run `npm run extension` to copy it into `extension/direction.js`. Commit both. The service worker is `extension/windows.js`, with popup settings in `extension/popup.*`.

Keep permissions narrow and avoid any new data collection. Test caret/selection preservation, paragraph changes, sidebar dismissal, extension reload lifecycle and companion-window reuse when those paths change. Use synthetic text and your own self-chat for manual verification, not another person's conversation. Do not initiate calls or send messages through tests.

Run `npm run screenshots` after UI changes. It renders the real controls on a synthetic fixture, and regenerates original PNG icons. To rebuild `assets/app.icns`, create a standard iconset from `assets/icon.png` with macOS `sips`, then run `iconutil -c icns`.

For a release on macOS: align versions in package.json, package-lock.json, the manifest and the sidebar version marker; update the changelog, install instructions and download filenames; run all tests; run `npm run extension` and `npm run release`. Release ZIPs use an explicit file allowlist. Inspect them for private files and confirm SHA256SUMS before uploading. Downloaded installers are unsigned scripts; locally generated app bundles are ad hoc signed, not notarized.

Report reproducible UI breakage with browser/extension versions and redacted screenshots. Do not upload secrets, chats, cookies or Chrome profiles.
