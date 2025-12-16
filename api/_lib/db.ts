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

  // Decode URL-encoded characters in the connection string
  // Vercel/Supabase sometimes URL-encodes special characters in passwords
  let decodedConnectionString = connectionString;
  try {
    // Only decode if it contains URL-encoded characters
    if (connectionString.includes('%')) {
      decodedConnectionString = decodeURIComponent(connectionString);
    }
  } catch (error) {
    // If decoding fails, use the original string
    console.warn('Failed to decode DATABASE_URL, using original:', error);
  }

  // Use postgres-js for serverless edge compatibility with optimized pool settings
  const sql = postgres(decodedConnectionString, {
    prepare: false,              // Disable prepared statements for edge compatibility
    max: 1,                      // Limit to 1 connection per serverless instance
    idle_timeout: 20,            // Close idle connections after 20 seconds
    connect_timeout: 10,         // Fail fast if connection takes > 10 seconds
    max_lifetime: 60 * 30,       // Recycle connections after 30 minutes
    ssl: 'require',              // Required for Supabase pooler
  });
  
  return sql;
}
