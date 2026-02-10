import type { CapacitorConfig } from '@capacitor/cli';


const isDev = process.env.NODE_ENV !== 'production';



const config: CapacitorConfig = {
  appId: 'com.rentmanagement.app',
  appName: 'Rent Management System',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0ea5e9",
      showSpinner: false,
    },
  },
};

if (isDev) {
  config.server = {
    url: process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:5000',
    cleartext: true,
  };
} else {
  const prodUrl = process.env.PROD_URL || process.env.CAPACITOR_SERVER_URL;
  if (prodUrl && !prodUrl.includes('example.com')) {
    config.server = {
      url: prodUrl,
      cleartext: false,
    };
  }
}

export default config;
