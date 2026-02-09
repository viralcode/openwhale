#!/bin/bash
set -e

# Build the OpenWhale Menu Bar app
APP_NAME="OpenWhale"
BUILD_DIR=".build"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
CONTENTS="$APP_BUNDLE/Contents"
MACOS="$CONTENTS/MacOS"

echo "🐋 Building OpenWhale Menu Bar..."

# Build with SwiftPM
swift build -c release 2>&1

# Create app bundle
echo "📦 Creating app bundle..."
rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS"
mkdir -p "$CONTENTS/Resources"

# Copy binary
cp "$BUILD_DIR/release/OpenWhaleMenuBar" "$MACOS/"

# Copy Info.plist
cp "Info.plist" "$CONTENTS/"

# Copy app icon
ICON_SRC="AppIcon.icns"
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$CONTENTS/Resources/AppIcon.icns"
    echo "🎨 App icon copied"
fi

# Create a simple entitlements file
cat > "$BUILD_DIR/entitlements.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.app-sandbox</key>
    <false/>
</dict>
</plist>
EOF

# Sign the app (ad-hoc)
codesign --force --sign - --entitlements "$BUILD_DIR/entitlements.plist" "$APP_BUNDLE" 2>/dev/null || true

echo ""
echo "✅ Built: $APP_BUNDLE"
echo ""
echo "To run:  open $APP_BUNDLE"
echo "To install: cp -R $APP_BUNDLE /Applications/"
