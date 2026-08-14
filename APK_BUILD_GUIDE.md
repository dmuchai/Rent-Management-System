# APK Build Guide for Landee Rent Management System

## Quick Start

The easiest way to build a signed, RevenueCat-enabled App Bundle for Google Play:

```bash
VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_... npm run aab:build
```

This automatically:
1. Sets `VITE_API_URL=https://landee.kejalink.co.ke`
2. Enables the subscription UI at build time
3. Validates the RevenueCat Android public SDK key
4. Builds the frontend and syncs the RevenueCat native plugin
5. Builds a signed AAB and prints its location and SHA-256 checksum

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
VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_... npm run aab:build
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

To produce both a Play Store AAB and an installable APK:

```bash
VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_... npm run android:release
```

### Method 2: Using Bash Script Directly

```bash
VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_... ./build-apk.sh bundle
```

### Method 3: Manual Build Steps

Set the API URL:
```bash
export VITE_API_URL=https://landee.kejalink.co.ke
export VITE_ENABLE_SUBSCRIPTIONS=true
export VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_...
export NODE_ENV=production
```

Build frontend:
```bash
npm run build:frontend
```

Sync to Android:
```bash
npx cap sync android
```

Build APK:
```bash
cd android
./gradlew bundleRelease
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

For release builds, place these local-only files inside `android/`:

`android/upload-keystore.jks` - your keystore file

`android/keystore.properties` - signing values used by Gradle

Example `android/keystore.properties`:

```properties
storeFile=upload-keystore.jks
storePassword=your-store-password
keyAlias=your-key-alias
keyPassword=your-key-password
```

Generate a signing key only if you do not already have one:
```bash
keytool -genkey -v -keystore landee-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias landee-app
```

Build the release bundle or APK after the local signing files are in place:
```bash
cd android
./gradlew bundleRelease
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

The build script sets the production API URL and enables subscriptions. Supply the
public RevenueCat Google SDK key in the build environment:

```bash
VITE_API_URL=https://landee.kejalink.co.ke
VITE_ENABLE_SUBSCRIPTIONS=true
VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_...
NODE_ENV=production
```

The SDK key is embedded in the app and is safe to use client-side. Never provide
the RevenueCat secret API key or webhook secret to a `VITE_*` variable.

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
