// Shared database connection for Vercel serverless functions
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../shared/schema';

// Create connection pool (Vercel functions are stateless, so this gets recreated)
const connectionString = process.env.DATABASE_URL!;

// Use postgres-js for serverless edge compatibility
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
