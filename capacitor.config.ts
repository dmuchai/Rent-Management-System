import type { CapacitorConfig } from '@capacitor/cli';


const isDev = process.env.NODE_ENV !== 'production';

function getProdUrl() {
  const prodUrl = process.env.PROD_URL || process.env.CAPACITOR_SERVER_URL;
  if (!prodUrl || prodUrl.includes('example.com')) {
    // If we're strictly in production, we need a URL. 
    // For local builds, we can fallback to a placeholder but warn the user.
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ WARNING: PROD_URL is not set. Native app may not connect to backend.');
    }
    return 'https://api.rentmanagement.co'; // Default placeholder domain
  }
  return prodUrl;
}

const config: CapacitorConfig = {
  appId: 'com.rentmanagement.app',
  appName: 'Rent Management System',
  webDir: 'dist/public',
  ...(isDev
    ? {
      server: {
        url: process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:5000',
        cleartext: true,
      },
    }
    : {
      server: {
        url: process.env.CAPACITOR_SERVER_URL || getProdUrl(),
        cleartext: false,
      },
    }),
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0ea5e9",
      showSpinner: false,
    },
  },
};

export default config;
