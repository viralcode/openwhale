#!/bin/bash
set -e

APP_NAME="OpenWhaleInstaller"
BUILD_DIR=".build"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
CONTENTS="$APP_BUNDLE/Contents"
MACOS="$CONTENTS/MacOS"

echo "🐋 Building OpenWhale Installer..."

swift build -c release 2>&1

echo "📦 Creating app bundle..."
rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS"
mkdir -p "$CONTENTS/Resources"

cp "$BUILD_DIR/release/OpenWhaleInstaller" "$MACOS/"

cp "Info.plist" "$CONTENTS/"

# Copy app icon from main app if available
ICON_SRC="../AppIcon.icns"
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$CONTENTS/Resources/AppIcon.icns"
    echo "🎨 App icon copied"
fi

# Sign (ad-hoc)
codesign --force --sign - "$APP_BUNDLE" 2>/dev/null || true

echo ""
echo "✅ Built: $APP_BUNDLE"
echo ""
echo "To run:  open $APP_BUNDLE"
