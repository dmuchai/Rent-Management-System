// API Configuration for Production Deployment
// This file handles switching between local development and production API endpoints

const isDevelopment = import.meta.env.MODE === 'development';
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Backend API Base URLs
const API_ENDPOINTS = {
  development: 'http://localhost:5000',
  production: {
    // Railway deployment URL (update with your actual backend URL after deployment)
    railway: 'https://rent-management-system-production.up.railway.app',
    
    // Render deployment URL (update with your actual backend URL after deployment)
    render: 'https://rent-management-system.onrender.com',
    
    // DigitalOcean deployment URL (update with your actual backend URL after deployment)
    digitalocean: 'https://rent-management-system-xyz.ondigitalocean.app'
  }
};

// Choose your backend deployment platform
// Update this after deploying your backend
const BACKEND_PLATFORM = 'railway'; // Change to 'render' or 'digitalocean' as needed

export const API_BASE_URL = isDevelopment || isLocal 
  ? API_ENDPOINTS.development
  : API_ENDPOINTS.production[BACKEND_PLATFORM as keyof typeof API_ENDPOINTS.production];

// Export configuration for debugging
export const API_CONFIG = {
  mode: import.meta.env.MODE,
  isDevelopment,
  isLocal,
  selectedPlatform: BACKEND_PLATFORM,
  currentURL: API_BASE_URL
};

// Log configuration in development
if (isDevelopment) {
  console.log('API Configuration:', API_CONFIG);
}