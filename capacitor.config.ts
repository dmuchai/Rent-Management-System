import type { CapacitorConfig } from '@capacitor/cli';


const isDev = process.env.NODE_ENV !== 'production';

function getProdUrl() {
  const prodUrl = process.env.PROD_URL;
  if (!prodUrl || prodUrl.includes('example.com')) {
    throw new Error(
      'Production URL is not set or is using a placeholder. Please set the PROD_URL environment variable to your actual production URL.'
    );
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
        url: process.env.CAPACITOR_SERVER_URL || 'http://192.168.100.165:5000',
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
