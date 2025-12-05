// API Configuration for Production Deployment - Updated Dec 5, 2025
// NOW USING VERCEL SERVERLESS FUNCTIONS - Same origin, no CORS needed!

const isDevelopment = import.meta.env.MODE === 'development';
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Backend API Base URLs
const API_ENDPOINTS = {
  development: 'http://localhost:5000',
  // Production uses same-origin Vercel serverless functions (no separate backend needed)
  production: ''
};

export const API_BASE_URL = isDevelopment || isLocal 
  ? API_ENDPOINTS.development
  : API_ENDPOINTS.production;

// Export configuration for debugging
export const API_CONFIG = {
  mode: import.meta.env.MODE,
  isDevelopment,
  isLocal,
  currentURL: API_BASE_URL || '(same-origin)',
  architecture: 'Vercel Serverless Functions'
};

// Log configuration in both development and production for debugging
console.log('=== API Configuration (Vercel Serverless) ===');
console.log('Mode:', import.meta.env.MODE);
console.log('isDevelopment:', isDevelopment);
console.log('isLocal:', isLocal);
console.log('Current API URL:', API_BASE_URL || '(same-origin - using Vercel serverless functions)');
console.log('Architecture: Vercel Frontend + Serverless Functions + Supabase Database');
console.log('==========================================');