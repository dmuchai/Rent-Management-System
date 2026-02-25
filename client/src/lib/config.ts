// API Configuration for Production Deployment - Updated Feb 25, 2026
// Web: Uses same-origin (empty string) for Vercel serverless functions
// Mobile (APK): Requires VITE_API_URL pointing to backend domain

const isDevelopment = import.meta.env.MODE === 'development';
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Backend API Base URLs
const API_ENDPOINTS = {
  // For mobile/APK: Use VITE_API_URL (must be set to backend domain)
  // For web: Use empty string for same-origin requests
  development: import.meta.env.VITE_API_URL || '',
  production: import.meta.env.VITE_API_URL || ''  // Should be set for APK builds
};

export const API_BASE_URL = isDevelopment ? API_ENDPOINTS.development : API_ENDPOINTS.production;

// Base path for the application (supports subdirectory deployments)
// Set VITE_BASE_PATH environment variable if deploying to a subdirectory
// Example: VITE_BASE_PATH=/app for https://example.com/app/
// Default: '' (root path)
export const BASE_PATH = import.meta.env.VITE_BASE_PATH || '';

// Helper function to build absolute paths respecting base path
export function buildPath(path: string): string {
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // Combine base path with clean path
  return BASE_PATH ? `${BASE_PATH}/${cleanPath}` : `/${cleanPath}`;
}

// Export configuration for debugging
export const API_CONFIG = {
  mode: import.meta.env.MODE,
  isDevelopment,
  isLocal,
  currentURL: API_BASE_URL || '(same-origin)',
  architecture: 'Vercel Serverless Functions',
  basePath: BASE_PATH || '(root)'
};

// Log configuration in both development and production for debugging
console.log('=== API Configuration (Vercel Serverless) ===');
console.log('Mode:', import.meta.env.MODE);
console.log('isDevelopment:', isDevelopment);
console.log('isLocal:', isLocal);
console.log('VITE_API_URL env:', import.meta.env.VITE_API_URL || '(not set)');
console.log('Current API URL:', API_BASE_URL || '(same-origin - using Vercel serverless functions)');
console.log('Base Path:', BASE_PATH || '(root)');
console.log('Architecture: Vercel Frontend + Serverless Functions + Supabase Database');
console.log('==========================================');