import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';
const defaultProdUrl = 'https://rent-management-system.example.com'; // Replace with your actual prod URL

const config: CapacitorConfig = {
  appId: 'com.rentmanagement.app',
  appName: 'Rent Management System',
  webDir: 'dist/public',
  ...(isDev
    ? {
        server: {
          url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:5173',
          cleartext: true,
        },
      }
    : {
        server: {
          url: process.env.CAPACITOR_SERVER_URL || defaultProdUrl,
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
