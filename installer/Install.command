#!/bin/bash
# Local installer: no downloads, administrator access, or Chrome profile changes.
set -euo pipefail
SOURCE_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
DEST_ROOT="${TEAMS_WEB_DEST:-$HOME}"
SUPPORT_DIR="$DEST_ROOT/Library/Application Support/teams-web"
APP_PATH="$DEST_ROOT/Applications/teams-web.app"
CHROME_SYSTEM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME_USER="$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'The Mac installer needs macOS. Use the extension folder directly on other platforms.' >&2; exit 1
fi
for item in extension/manifest.json launcher.applescript assets/app.icns START-HERE.html; do
  [[ -f "$SOURCE_DIR/$item" ]] || { echo "Missing installer file: $item" >&2; exit 1; }
done
if [[ ! -x "$CHROME_SYSTEM" && ! -x "$CHROME_USER" ]]; then
  echo 'Google Chrome was not found. Install it before opening teams-web: https://www.google.com/chrome/'
fi
if [[ -L "$APP_PATH" || -L "$SUPPORT_DIR" || -L "$SUPPORT_DIR/extension" ]]; then
  echo 'A destination is a symbolic link. Choose a normal install directory.' >&2; exit 1
fi
if [[ -e "$APP_PATH" ]]; then
  EXISTING_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Contents/Info.plist" 2>/dev/null || true)"
  [[ "$EXISTING_ID" == 'io.github.markes76.teams-web-rtl' ]] || {
    echo "An unrelated app already exists at $APP_PATH. Move it before installing." >&2; exit 1;
  }
fi
mkdir -p "$SUPPORT_DIR" "$(dirname "$APP_PATH")"
STAGE_DIR="$(mktemp -d "$SUPPORT_DIR/.install.XXXXXX")"
APP_BACKUP="$STAGE_DIR/previous-app"
EXT_BACKUP="$STAGE_DIR/previous-extension"
CHANGED_APP=0
CHANGED_EXTENSION=0
SUCCESS=0
cleanup() {
  if [[ "$SUCCESS" == 0 ]]; then
    if [[ "$CHANGED_APP" == 1 ]]; then
      rm -rf -- "$APP_PATH"
      [[ ! -e "$APP_BACKUP" ]] || mv -- "$APP_BACKUP" "$APP_PATH"
    fi
    if [[ "$CHANGED_EXTENSION" == 1 ]]; then
      rm -rf -- "$SUPPORT_DIR/extension"
      [[ ! -e "$EXT_BACKUP" ]] || mv -- "$EXT_BACKUP" "$SUPPORT_DIR/extension"
    fi
  fi
  rm -rf -- "$STAGE_DIR"
}
trap cleanup EXIT
echo 'Installing teams-web and preparing the Teams RTL extension…'
/usr/bin/osacompile -o "$STAGE_DIR/teams-web.app" "$SOURCE_DIR/launcher.applescript"
PLIST="$STAGE_DIR/teams-web.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleName teams-web' "$PLIST"
/usr/libexec/PlistBuddy -c 'Add :CFBundleDisplayName string teams-web' "$PLIST"
/usr/libexec/PlistBuddy -c 'Add :CFBundleIdentifier string io.github.markes76.teams-web-rtl' "$PLIST"
/usr/libexec/PlistBuddy -c 'Set :CFBundleIconFile app' "$PLIST"
cp "$SOURCE_DIR/assets/app.icns" "$STAGE_DIR/teams-web.app/Contents/Resources/app.icns"
/usr/bin/codesign --force --sign - "$STAGE_DIR/teams-web.app"
/usr/bin/codesign --verify --strict "$STAGE_DIR/teams-web.app"
/usr/bin/ditto "$SOURCE_DIR/extension" "$STAGE_DIR/extension"
if [[ -e "$APP_PATH" ]]; then mv -- "$APP_PATH" "$APP_BACKUP"; fi
CHANGED_APP=1
mv -- "$STAGE_DIR/teams-web.app" "$APP_PATH"
if [[ -e "$SUPPORT_DIR/extension" ]]; then mv -- "$SUPPORT_DIR/extension" "$EXT_BACKUP"; fi
CHANGED_EXTENSION=1
mv -- "$STAGE_DIR/extension" "$SUPPORT_DIR/extension"
cp "$SOURCE_DIR/START-HERE.html" "$SUPPORT_DIR/START-HERE.html"
SUCCESS=1
echo
echo "App: $APP_PATH"
echo "Extension: $SUPPORT_DIR/extension"
echo
echo 'Finish in Chrome, in the profile you use for Teams:'
echo '  1. Type chrome://extensions into the address bar.'
echo '  2. Enable Developer mode and click Load unpacked.'
echo "  3. Select: $SUPPORT_DIR/extension"
echo '  4. Open teams-web and sign in normally.'
echo 'For an update: click Reload on Teams RTL, then refresh Teams after any call/draft.'
if [[ "${TEAMS_WEB_NO_OPEN:-0}" != 1 ]]; then
  /usr/bin/open -R "$SUPPORT_DIR/extension/manifest.json" || true
  /usr/bin/open "$SUPPORT_DIR/START-HERE.html" || true
fi
