# Product requirement: English Teams with natural Hebrew composition

## User need

A person working in Microsoft Teams wants English menus and navigation while writing Hebrew and English naturally. In the observed setup, Hebrew composition was easier after switching the entire Teams interface to Hebrew, but that did not match the desired workflow. This is the motivating observation from one setup, not a claim about all Teams versions or tenants.

## Requirements and acceptance criteria

| Requirement | Expected behavior | Evidence / limit |
| --- | --- | --- |
| Preserve English UI | Direction changes affect editor paragraphs, not the whole application layout. | Locally tested and manually checked in Teams on one Mac. |
| Automatic Hebrew/English direction | Each paragraph follows its first strong letter. Leading digits/punctuation do not pick the direction. | Node and Chromium regression tests; live mixed-language composition checked. This is a first-letter heuristic, not full Unicode bidi classification. |
| Manual Auto / RTL / LTR | Apply a choice to the caret paragraph or selected paragraphs without replacing text or losing selection. | Chromium regression tests and manual Teams checks. Overrides are tied to current paragraph DOM nodes. |
| Clear composer | Controls live beneath the left sidebar’s ellipsis, with an adjacent dismissible panel. | User confirmed working in Teams. Synthetic screenshots below. |
| Optional visibility | Hide the shortcut while Auto continues. Save the preference locally. | Implemented; tested during development. |
| Chat while calling | Opening a call requests a separate chat companion; reuse/focus it on later triggers. A manual button is available. | User confirmed one outgoing-call flow. Incoming calls, localization and all meeting types are not comprehensively tested. |
| Simple public install | Download a ZIP, run a local Mac setup script, then load the extension using Chrome’s standard manual flow. | Installer regression checks and release archive verification. Manual Chrome approval remains necessary. |
| Keep Microsoft authentication in Chrome | Reuse Chrome’s normal account/session flow, without copying cookies or credentials into another browser runtime. | Chrome-hosted approach used successfully. Tenant policies still apply. |
| Minimal project data handling | No project backend, analytics, message collection or upload logic. | Source inspection; see PRIVACY.md. |

## Screenshots

![Auto direction in the synthetic local composer with sidebar menu](images/auto-direction.png)

![Extension settings for visibility and call companion](images/settings.png)

These are actual extension controls rendered in a local test fixture with synthetic content. They do not expose a real account or chat.

## Boundaries

- **Local composition, not guaranteed message serialization.** A live self-chat test lost paragraph-specific direction after sending/reloading. Recipient-side direction is outside this extension’s guarantee.
- **Companion chat, not call relocation.** The call stays in its original window. No automatic join/hang-up or media control.
- **Chrome extension plus optional launcher, not a replacement Teams implementation.** Microsoft still provides the application and services.
- **Manual beta distribution.** No Chrome Web Store listing, automatic updater, signed/notarized downloadable Mac binary or enterprise deployment package is included.
- **Teams UI can change.** Keep selectors and lifecycle behavior covered by tests and verify reported breakage on the affected UI.

## Release checklist

Run `npm test`, build the extension, regenerate synthetic screenshots if UI changes, inspect source/assets for personal information, build release archives, and verify checksums/archive contents. Preserve the permission restriction to the two Teams origins. Do not include live chat screenshots or account/profile directories in releases.
