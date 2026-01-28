import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rentmanagement.app',
  appName: 'Rent Management System',
  webDir: 'dist/public',
  server: {
    // Allow the app to load from your production URL
    url: process.env.CAPACITOR_SERVER_URL,
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0ea5e9",
      showSpinner: false
    }
  }
};

export default config;
