# APK Build Guide for Landee Rent Management System

## Quick Start

The easiest way to build the APK with correct configuration:

```bash
npm run apk:build
```

This automatically:
1. Sets `VITE_API_URL=https://landee.kejalink.co.ke`
2. Builds the frontend
3. Syncs files to Android
4. Builds the APK
5. Shows the output location

## What's New

✅ **Automated build script** (`build-apk.sh`)
✅ **NPM convenience scripts** for building and installing
✅ **Correct API URL** embedded in the APK at build time

## Prerequisites

Ensure you have installed:
- Node.js 18+
- Android SDK (with gradle)
- Capacitor CLI: `npm install -g @capacitor/cli`

## Build Methods

### Method 1: Using NPM Script (Recommended)

```bash
npm run apk:build
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

### Method 2: Using Bash Script Directly

```bash
./build-apk.sh
```

### Method 3: Manual Build Steps

Set the API URL:
```bash
export VITE_API_URL=https://landee.kejalink.co.ke
export NODE_ENV=production
```

Build frontend:
```bash
npm run build:frontend
```

Sync to Android:
```bash
npx cap sync
```

Build APK:
```bash
cd android
./gradlew assembleRelease
```

## Installation

### Install on Connected Android Device

```bash
npm run apk:install
```

Or manually:
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Uninstall from Device

```bash
adb uninstall com.rentmanagement.app
```

## Verify API Configuration

After installing, check the app console (in browser DevTools if debugging):

Should show:
```
Current API URL: https://landee.kejalink.co.ke
```

NOT:
```
Current API URL: (same-origin - using Vercel serverless functions)
```

## Troubleshooting

### APK Still Shows Loading Spinner

1. **Check API URL in logs:**
   - Connect device with `adb logcat`
   - Look for "Current API URL" message
   - Should show `https://landee.kejalink.co.ke`

2. **Verify API is accessible:**
   ```bash
   curl -I https://landee.kejalink.co.ke/api/auth
   ```
   Should return HTTP 200-400 (not connection refused)

3. **Check CORS headers:**
   ```bash
   curl -I -H "Origin: https://landee.kejalink.co.ke" \
     https://landee.kejalink.co.ke/api/auth
   ```

### Build Fails with "Cannot find gradle"

Ensure Android SDK is installed:
```bash
# On macOS with Homebrew
brew install gradle

# Or set ANDROID_HOME
export ANDROID_HOME=$HOME/Library/Android/sdk
```

### APK is Missing Files

Manually copy frontend after build:
```bash
cp -r dist/public android/app/src/main/assets/public
```

## Release Setup

### 1. Update Version

In `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        versionCode X    // Increment this
        versionName "X.Y.Z"  // Semantic versioning
    }
}
```

### 2. Sign APK

Generate signing key (first time only):
```bash
keytool -genkey -v -keystore landee-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias landee-app
```

Sign APK:
```bash
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore landee-release.jks \
  android/app/build/outputs/apk/release/app-release.apk \
  landee-app
```

### 3. Optimize APK Size

```bash
zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release.apk \
  landee-release-aligned.apk
```

### 4. Upload to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Create/select your app
3. Go to **Release > Production**
4. Upload signed APK
5. Fill in release notes
6. Submit for review

## Environment Variables

The build script automatically sets:

```bash
VITE_API_URL=https://landee.kejalink.co.ke
NODE_ENV=production
```

If you need to use a different backend:
```bash
VITE_API_URL=https://your-custom-domain.com npm run apk:build
```

## Performance Tips

1. **Clean build (slower but guaranteed clean):**
   ```bash
   rm -rf dist/ android/app/build/
   npm run apk:build
   ```

2. **Incremental build (faster):**
   ```bash
   npm run apk:build
   ```

3. **Check APK size:**
   ```bash
   ls -lh android/app/build/outputs/apk/release/app-release.apk
   ```

## Getting Help

Check logs from the device:
```bash
adb logcat | grep -i "pesapal\|api\|auth"
```

View Vercel logs:
```bash
# Real-time tail
vercel logs

# Specific project
vercel logs -l 50
```

---

**Last Updated:** February 25, 2026
**API URL:** https://landee.kejalink.co.ke
