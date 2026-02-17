import type { CapacitorConfig } from '@capacitor/cli';


const isDev = process.env.NODE_ENV !== 'production';



const config: CapacitorConfig = {
  appId: 'com.rentmanagement.app',
  appName: 'Landee',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0ea5e9",
      showSpinner: false,
    },
  },
};

const serverUrl = process.env.CAPACITOR_SERVER_URL;
const prodUrl = process.env.PROD_URL;

if (serverUrl) {
  config.server = {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  };
} else if (!isDev && prodUrl && !prodUrl.toLowerCase().includes('example.com')) {
  config.server = {
    url: prodUrl,
    cleartext: prodUrl.startsWith('http://'),
  };
}

export default config;
