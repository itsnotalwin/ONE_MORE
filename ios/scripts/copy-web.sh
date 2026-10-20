#!/bin/sh
# Bundle the original web game without duplicating its sources.
set -eu
: "$SRCROOT" "$TARGET_BUILD_DIR" "$UNLOCALIZED_RESOURCES_FOLDER_PATH"
ROOT="$SRCROOT/.."
DEST="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/Web"
mkdir -p "$DEST"
rm -rf "$DEST/css" "$DEST/js"
cp "$ROOT/index.html" "$DEST/index.html"
cp "$ROOT/manifest.webmanifest" "$DEST/manifest.webmanifest"
cp -R "$ROOT/css" "$DEST/css"
cp -R "$ROOT/js" "$DEST/js"
