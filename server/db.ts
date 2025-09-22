import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// For Supabase, use postgres-js instead of neon serverless
// Convert pooler URL to direct connection for better reliability
const connectionString = process.env.DATABASE_URL.replace(':6543/', ':5432/');
console.log('Connecting to database...');

// Create postgres client
const client = postgres(connectionString, { 
  prepare: false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });