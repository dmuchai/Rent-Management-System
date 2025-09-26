// Debug configuration file to check what's deployed
import { API_BASE_URL, API_CONFIG } from './lib/config';

export function debugConfig() {
  console.log('=== API Configuration Debug ===');
  console.log('API_BASE_URL:', API_BASE_URL);
  console.log('Full Config:', API_CONFIG);
  console.log('Environment Mode:', import.meta.env.MODE);
  console.log('Current URL:', window.location.href);
  
  // Test API call to verify which backend is being called
  return {
    apiBaseUrl: API_BASE_URL,
    config: API_CONFIG,
    mode: import.meta.env.MODE,
    currentUrl: window.location.href
  };
}

// Auto-run debug on load
if (typeof window !== 'undefined') {
  console.log('Debug Config:', debugConfig());
}