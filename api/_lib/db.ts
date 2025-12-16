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

  // Parse and properly decode the connection string
  // Vercel/Supabase URL-encodes special characters in passwords, but we need to be careful
  // not to decode the entire URL as that can break the @ symbols in the hostname
  let finalConnectionString = connectionString;
  
  try {
    // Match pattern: postgresql://user:password@host:port/database
    const urlMatch = connectionString.match(/^(postgresql:\/\/)([^:]+):([^@]+)@(.+)$/);
    
    if (urlMatch && connectionString.includes('%')) {
      const [, protocol, username, password, hostAndDb] = urlMatch;
      // Decode only the password part which may contain URL-encoded characters
      const decodedPassword = decodeURIComponent(password);
      finalConnectionString = `${protocol}${username}:${decodedPassword}@${hostAndDb}`;
      
      console.log('Decoded password in DATABASE_URL');
    }
  } catch (error) {
    // If parsing/decoding fails, use the original string
    console.warn('Failed to parse DATABASE_URL, using original:', error);
    finalConnectionString = connectionString;
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
