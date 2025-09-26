// Vercel serverless function entry point
import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS configuration for Vercel deployment
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cookie');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Rent Management System API is running on Vercel',
    timestamp: new Date().toISOString()
  });
});

// Placeholder for main API routes - in production you'd import the built server
app.all('/api/*', (req, res) => {
  res.status(501).json({ 
    error: 'API routes not yet configured for serverless deployment',
    message: 'Please configure the server routes for Vercel deployment',
    path: req.path,
    method: req.method
  });
});

// For Vercel serverless functions, we need to export a handler
export default function handler(req, res) {
  return app(req, res);
}