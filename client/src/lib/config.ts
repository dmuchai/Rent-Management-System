// API Configuration for Production Deployment - Updated Sep 26, 2025
// This file handles switching between local development and production API endpoints
// IMPORTANT: Frontend should route to Render backend for all API calls

const isDevelopment = import.meta.env.MODE === 'development';
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Backend API Base URLs
const API_ENDPOINTS = {
  development: 'http://localhost:5000',
  production: {
    // Railway deployment URL (update with your actual backend URL after deployment)
    railway: 'https://rent-management-system-production.up.railway.app',
    
    // Render deployment URL - LIVE BACKEND
    render: 'https://rent-management-backend.onrender.com',
    
    // DigitalOcean deployment URL (update with your actual backend URL after deployment)
    digitalocean: 'https://rent-management-system-xyz.ondigitalocean.app'
  }
};

// Choose your backend deployment platform
// Update this after deploying your backend
const BACKEND_PLATFORM = 'render'; // Using Render free tier

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

// Log configuration in both development and production for debugging
console.log('=== API Configuration Debug ===');
console.log('Mode:', import.meta.env.MODE);
console.log('isDevelopment:', isDevelopment);
console.log('isLocal:', isLocal);
console.log('Selected Platform:', BACKEND_PLATFORM);
console.log('Current API URL:', API_BASE_URL);
console.log('Full Config:', API_CONFIG);
console.log('================================');