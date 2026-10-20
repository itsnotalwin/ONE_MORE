# ONE MORE iPhone app wrapper

The native shell displays the existing HTML/Canvas game, with no alternate
game engine. The normal web/PWA build continues to work unchanged.

## Install with Xcode

1. On a Mac with Xcode 15+, open ios/ONE_MORE.xcodeproj.
2. Select the ONE_MORE target and choose an Apple Development Team under
   Signing & Capabilities. Change the bundle identifier if needed.
3. Connect your iPhone, select it as the destination and press Run.
   Enable Developer Mode on the iPhone if prompted.

The Xcode Copy Game Web Assets phase bundles the current root index.html,
css, js, and manifest without duplicating gameplay code in source control.
No external game server is required once the app is installed.

## Full screen

A native WKWebView fills the physical screen behind the Dynamic Island.
The iOS status bar is hidden. Only the DOM HUD, menus and skip control are
offset below device-safe insets. Canvas, camera, animations, enemies,
controls and weapons retain their existing logic.

The hardware island stays visible. Final acceptance requires a real phone
check of safe-area layout, joystick touch, sound, save persistence and
offline startup. The simulator build runs without Apple signing in CI.
