# Privacy

Teams RTL is a local browser extension. It has no project server, analytics SDK, message archive, credential export or data-upload logic.

## Access

The content script runs only on HTTPS pages at `teams.microsoft.com` and `teams.cloud.microsoft`. Chrome’s site-access warning correctly means the extension can read and change content on those sites. The implementation reads editor text to choose paragraph direction and inspects controls to detect call actions. It writes direction attributes/styles and its own sidebar UI. It does not match Microsoft login pages.

The only named extension permission is `storage`. Browser window APIs open/focus a fixed Teams URL for the chat companion. The extension does not request cookies, browser history, clipboard, microphone or camera access. Chrome and Teams handle their own media and account permissions independently.

## Stored data

- Chrome local storage: sidebar visibility and automatic call-companion preference.
- Chrome session storage: owner-tab and companion-window identifiers for window reuse. Cleared when the browser session ends.
- Memory only: paragraph overrides and editor selections while the page is open.

Message text and account details are not saved by this project. Microsoft Teams and Chrome still perform their normal network activity and storage under their own policies. Loading a web app does not make Microsoft’s service offline or remove organizational controls.

The Mac installer copies extension files into your Application Support folder and builds a small launcher in your home Applications folder. It does not read passwords, copy Chrome profiles, enable extensions silently, or change Chrome/macOS security policies.

For issues, share the extension version, Chrome/macOS version, reproduction steps and a **redacted** screenshot. Never post tokens, cookies, tenant-specific URLs, confidential chats or exported browser profiles in a public issue.
