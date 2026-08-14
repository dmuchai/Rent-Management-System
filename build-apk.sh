#!/bin/bash

# Build a RevenueCat-enabled Android release for Landee.
# Usage: ./build-apk.sh [apk|bundle|all]

set -e  # Exit on error

echo "🚀 Starting Android Release Build Process..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
export VITE_API_URL="${VITE_API_URL:-https://landee.kejalink.co.ke}"
export VITE_ENABLE_SUBSCRIPTIONS="${VITE_ENABLE_SUBSCRIPTIONS:-true}"
export NODE_ENV=production

BUILD_FORMAT="${1:-apk}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$PROJECT_ROOT/dist/public"
ANDROID_DIR="$PROJECT_ROOT/android"
KEYSTORE_PROPERTIES="$ANDROID_DIR/keystore.properties"

echo -e "${YELLOW}Configuration:${NC}"
echo "API URL: $VITE_API_URL"
echo "Project Root: $PROJECT_ROOT"
echo "Dist Directory: $DIST_DIR"
echo "Subscriptions: $VITE_ENABLE_SUBSCRIPTIONS"
echo "Artifact: $BUILD_FORMAT"
echo ""

case "$BUILD_FORMAT" in
    apk|bundle|all) ;;
    *)
        echo -e "${RED}Unknown artifact type: $BUILD_FORMAT (expected apk, bundle, or all).${NC}"
        exit 1
        ;;
esac

if [ "$VITE_ENABLE_SUBSCRIPTIONS" != "true" ]; then
    echo -e "${RED}RevenueCat releases require VITE_ENABLE_SUBSCRIPTIONS=true.${NC}"
    exit 1
fi

if [[ "${VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY:-}" != goog_* ]]; then
    echo -e "${RED}Missing or invalid RevenueCat Android public SDK key.${NC}"
    echo "Set VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY to the public Google SDK key (goog_...)."
    echo "Do not use a RevenueCat secret key here."
    exit 1
fi

if [ ! -f "$KEYSTORE_PROPERTIES" ]; then
    echo -e "${RED}Missing Android release signing config.${NC}"
    echo "Create $KEYSTORE_PROPERTIES with storeFile, storePassword, keyAlias, and keyPassword."
    echo "See android/keystore.properties.example for the expected format."
    exit 1
fi

# Step 1: Build frontend with Vite
echo -e "${YELLOW}Step 1: Building frontend...${NC}"
cd "$PROJECT_ROOT"
npm run build:frontend
echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

# Step 2: Copy files to Android
echo -e "${YELLOW}Step 2: Syncing to Android...${NC}"
cd "$PROJECT_ROOT"

# Use Capacitor's sync command (more reliable than gradle)
echo "Using npx cap sync android..."
npx cap sync android
echo -e "${GREEN}✓ Frontend synced to Android${NC}"
echo ""

# Step 3: Build the requested signed Android artifact(s)
echo -e "${YELLOW}Step 3: Building signed Android release...${NC}"
cd "$ANDROID_DIR"
case "$BUILD_FORMAT" in
    apk) ./gradlew assembleRelease ;;
    bundle) ./gradlew bundleRelease ;;
    all) ./gradlew assembleRelease bundleRelease ;;
esac
echo -e "${GREEN}✓ Android release built successfully${NC}"
echo ""

# Step 4: Show output location(s)
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

show_artifact() {
    local artifact_path="$1"
    local artifact_label="$2"

    if [ ! -f "$artifact_path" ]; then
        echo -e "${RED}❌ $artifact_label build failed; expected $artifact_path${NC}"
        exit 1
    fi

    echo "  $artifact_label: $artifact_path"
    echo "  Size: $(du -h "$artifact_path" | cut -f1)"
    echo "  SHA-256: $(sha256sum "$artifact_path" | cut -d ' ' -f1)"
}

echo -e "${GREEN}✅ ANDROID RELEASE BUILD COMPLETE!${NC}"
echo ""
echo "📦 Artifacts:"
case "$BUILD_FORMAT" in
    apk) show_artifact "$APK_PATH" "APK" ;;
    bundle) show_artifact "$AAB_PATH" "AAB" ;;
    all)
        show_artifact "$APK_PATH" "APK"
        show_artifact "$AAB_PATH" "AAB"
        ;;
esac
echo ""
echo "Upload the AAB to a Google Play internal or closed testing track to test purchases."
