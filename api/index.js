// Vercel serverless function - simplified approach
export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Health check endpoint
  if (req.url === '/api/health' || req.url === '/health') {
    res.status(200).json({
      status: 'ok',
      message: 'Rent Management System API is running on Vercel',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
    return;
  }

  // For other API routes, return a helpful message
  res.status(404).json({
    error: 'API endpoint not found',
    message: 'This deployment uses a simplified API structure. For full functionality, consider using Vercel API Routes or adapting the Express server.',
    availableEndpoints: [
      '/api/health - Health check'
    ],
    path: req.url,
    method: req.method
  });
}