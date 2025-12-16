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
  // Vercel/Supabase URL-encodes special characters in passwords
  let finalConnectionString = connectionString;
  
  console.log('Original DATABASE_URL has encoded chars:', connectionString.includes('%'));
  
  if (connectionString.includes('%')) {
    try {
      // Match: postgresql://username:password@rest-of-url
      const urlMatch = connectionString.match(/^(postgresql:\/\/)([^:]+):([^@]+)@(.+)$/);
      
      if (urlMatch) {
        const [, protocol, username, encodedPassword, hostAndRest] = urlMatch;
        console.log('Regex matched. Decoding password...');
        
        // Decode only the password part
        const decodedPassword = decodeURIComponent(encodedPassword);
        finalConnectionString = `${protocol}${username}:${decodedPassword}@${hostAndRest}`;
        
        console.log('✅ Successfully decoded DATABASE_URL password');
      } else {
        console.warn('⚠️ DATABASE_URL pattern did not match regex, using original');
      }
    } catch (error) {
      console.error('❌ Failed to parse/decode DATABASE_URL:', error);
      finalConnectionString = connectionString;
    }
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
