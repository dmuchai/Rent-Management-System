/**
 * Migration Runner Script
 * Executes SQL migration files against the Supabase database
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'postgres';
const postgres = pkg;

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function runMigration(migrationFile) {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    connection: {
      application_name: 'migration_runner'
    }
  });

  try {
    console.log(`\n🔄 Running migration: ${migrationFile}...`);
    
    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', migrationFile);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL loaded, executing...\n');
    
    // Execute migration
    await sql.unsafe(migrationSQL);
    
    console.log(`✅ Migration completed successfully: ${migrationFile}\n`);
    
  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`);
    console.error('Error details:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the migration
const migrationFile = process.argv[2] || 'add-tenant-invitation-fields.sql';
runMigration(migrationFile).catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
