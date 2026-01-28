# Mobile App Development Guide

This guide explains how to develop and build the mobile app version of the Rent Management System using Capacitor.

## Prerequisites

- **For iOS Development**: macOS with Xcode installed
- **For Android Development**: Android Studio installed
- Node.js and npm (already installed)

## Development Workflow

### 1. Build the Web App
```bash
npm run build:frontend
```

### 2. Sync with Native Projects
```bash
npm run mobile:sync
```
This command builds the frontend and copies it to the native projects.

### 3. Open in Native IDE

**For Android:**
```bash
npm run mobile:android
```
This opens Android Studio where you can run the app on an emulator or physical device.

**For iOS:**
```bash
npm run mobile:ios
```
This opens Xcode where you can run the app on a simulator or physical device.

## Testing on Devices

### Android
1. Run `npm run mobile:android`
2. In Android Studio, select a device/emulator
3. Click the "Run" button (green play icon)

### iOS
1. Run `npm run mobile:ios`
2. In Xcode, select a simulator or connected device
3. Click the "Run" button (play icon)

## Live Reload During Development

For faster development, you can use live reload:

1. Start your dev server: `npm run dev`
2. Update `capacitor.config.ts` to point to your local server:

## Building for Production

### Android APK/AAB
1. Run `npm run mobile:build`
2. Open Android Studio: `npm run mobile:android`
3. Go to **Build > Generate Signed Bundle / APK**
4. Follow the wizard to create a release build

### iOS IPA
1. Run `npm run mobile:build`
2. Open Xcode: `npm run mobile:ios`
3. Select **Product > Archive**
4. Follow the wizard to distribute to App Store or TestFlight

## App Store Deployment

### Google Play Store
- Requires a Google Play Console account ($25 one-time fee)
- Follow [Android Publishing Guide](https://capacitorjs.com/docs/android/deploying-to-google-play)

### Apple App Store
- Requires an Apple Developer account ($99/year)
- Follow [iOS Publishing Guide](https://capacitorjs.com/docs/ios/deploying-to-app-store)

## Customization

### App Icons and Splash Screens
Use the Capacitor Assets tool to generate all required sizes:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

### App Name and ID
Edit `capacitor.config.ts`:
```typescript
{
  appId: 'com.yourcompany.app',
  appName: 'Your App Name'
}
```

## Troubleshooting

### Changes not reflecting?
Run `npm run mobile:sync` to copy the latest web build to native projects.

### Build errors?
- Ensure Android Studio and/or Xcode are properly installed
- Check that all dependencies are installed: `npm install`
- Clean and rebuild in the native IDE

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
