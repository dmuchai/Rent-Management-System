#!/bin/bash

# Build APK script for Landee Rent Management System
# This script builds the frontend and Android APK with proper configuration

set -e  # Exit on error

echo "🚀 Starting APK Build Process..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
export VITE_API_URL=https://landee.kejalink.co.ke
export NODE_ENV=production

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$PROJECT_ROOT/dist/public"
ANDROID_DIR="$PROJECT_ROOT/android"

echo -e "${YELLOW}Configuration:${NC}"
echo "API URL: $VITE_API_URL"
echo "Project Root: $PROJECT_ROOT"
echo "Dist Directory: $DIST_DIR"
echo ""

# Step 1: Clean and build frontend
echo -e "${YELLOW}Step 1: Building frontend...${NC}"
cd "$PROJECT_ROOT"
rm -rf dist/
npm run build
echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

# Step 2: Copy files to Android
echo -e "${YELLOW}Step 2: Syncing to Android...${NC}"
cd "$PROJECT_ROOT"

# Use Capacitor's sync command (more reliable than gradle)
echo "Using npx cap sync..."
npx cap sync
echo -e "${GREEN}✓ Frontend synced to Android${NC}"
echo ""

# Step 3: Build APK
echo -e "${YELLOW}Step 3: Building Android APK...${NC}"
./gradlew assembleRelease
echo -e "${GREEN}✓ APK built successfully${NC}"
echo ""

# Step 4: Show output location
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo -e "${GREEN}✅ APK BUILD COMPLETE!${NC}"
    echo ""
    echo "📦 APK Details:"
    echo "  Location: $APK_PATH"
    echo "  Size: $APK_SIZE"
    echo ""
    echo "📱 Next steps:"
    echo "  1. Sign the APK (if not auto-signed)"
    echo "  2. Upload to Google Play Store"
    echo "  3. Or install locally: adb install $APK_PATH"
else
    echo -e "${RED}❌ APK build failed!${NC}"
    echo "Expected location: $APK_PATH"
    exit 1
fi
