// Shared database connection for Vercel serverless functions
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../shared/schema';

// Validate required environment variable
const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.trim() === '') {
  throw new Error(
    'DATABASE_URL environment variable is required but not set. ' +
    'Please configure DATABASE_URL in your Vercel project settings or .env file.'
  );
}

// Use postgres-js for serverless edge compatibility with optimized pool settings
const client = postgres(connectionString, {
  prepare: false,              // Disable prepared statements for edge compatibility
  max: 1,                      // Limit to 1 connection per serverless instance
  idle_timeout: 20,            // Close idle connections after 20 seconds
  connect_timeout: 10,         // Fail fast if connection takes > 10 seconds
  max_lifetime: 60 * 30,       // Recycle connections after 30 minutes
});
export const db = drizzle(client, { schema });
