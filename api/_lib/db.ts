// Shared database connection utility for Vercel serverless functions
import postgres from 'postgres';

// Factory function to create database connection
// Each serverless function should call this to get a fresh connection
export function createDbConnection() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || connectionString.trim() === '') {
    throw new Error(
      'DATABASE_URL environment variable is required but not set. ' +
      'Please configure DATABASE_URL in your Vercel project settings or .env file.'
    );
  }

  // Parse and decode the connection string
  // Supabase/Vercel URL-encodes special characters in passwords
  let finalConnectionString = connectionString;
  
  if (connectionString.includes('%')) {
    try {
      // Use URL parser to properly extract components
      // Temporarily replace postgresql:// with http:// for URL parsing
      const tempUrl = connectionString.replace('postgresql://', 'http://');
      const parsedUrl = new URL(tempUrl);
      
      // Decode the password (URL.password is already decoded by the URL parser)
      const decodedPassword = parsedUrl.password;
      
      // Reconstruct the connection string with decoded password
      // Format: postgresql://username:password@host:port/database?params
      finalConnectionString = `postgresql://${parsedUrl.username}:${decodedPassword}@${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
      
      console.log('✅ Successfully decoded DATABASE_URL using URL parser');
    } catch (error) {
      console.error('❌ Failed to parse/decode DATABASE_URL:', error);
      // Fall back to original
      finalConnectionString = connectionString;
    }
  } else {
    console.log('No encoded characters in DATABASE_URL, using as-is');
  }

  // Use postgres-js for serverless edge compatibility with optimized pool settings
  const sql = postgres(finalConnectionString, {
    prepare: false,              // Disable prepared statements for edge compatibility
    max: 1,                      // Limit to 1 connection per serverless instance
    idle_timeout: 20,            // Close idle connections after 20 seconds
    connect_timeout: 10,         // Fail fast if connection takes > 10 seconds
    max_lifetime: 60 * 30,       // Recycle connections after 30 minutes
    ssl: 'require',              // Required for Supabase pooler
  });
  
  return sql;
}
