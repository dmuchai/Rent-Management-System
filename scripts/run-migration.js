/**
 * Migration Runner Script
 * Executes SQL migration files against the Supabase database
 */

import { config } from 'dotenv';
import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
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

/**
 * Validates and sanitizes migration filename to prevent path traversal attacks
 * @param {string} filename - The migration filename to validate
 * @returns {string} The validated filename
 * @throws {Error} If filename is invalid or unsafe
 */
function validateMigrationFilename(filename) {
  // Check if filename is provided
  if (!filename || typeof filename !== 'string') {
    throw new Error('Migration filename is required');
  }

  // Reject filenames with path separators or parent directory references
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Invalid migration filename: path separators and ".." are not allowed');
  }

  // Reject filenames starting with dot (hidden files)
  if (filename.startsWith('.')) {
    throw new Error('Invalid migration filename: hidden files are not allowed');
  }

  // Ensure filename ends with .sql
  if (!filename.endsWith('.sql')) {
    throw new Error('Invalid migration filename: must end with .sql');
  }

  // Reject filenames that are too long (prevent buffer overflow)
  if (filename.length > 255) {
    throw new Error('Invalid migration filename: filename too long (max 255 characters)');
  }

  return filename;
}

/**
 * Validates migration file path to ensure it's within the migrations directory
 * @param {string} migrationPath - The absolute path to validate
 * @param {string} migrationsDir - The migrations directory path
 * @throws {Error} If path is outside migrations directory or file doesn't exist
 */
function validateMigrationPath(migrationPath, migrationsDir) {
  // Verify the resolved path starts with the migrations directory
  if (!migrationPath.startsWith(migrationsDir)) {
    throw new Error('Security error: Migration file must be in migrations directory');
  }

  // Check if file exists
  if (!existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  // Check if it's a regular file (not a directory or symlink)
  const stats = statSync(migrationPath);
  if (!stats.isFile()) {
    throw new Error('Invalid migration: path is not a regular file');
  }
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
    
    // Validate and sanitize migration filename
    const validatedFilename = validateMigrationFilename(migrationFile);
    
    // Construct and validate migration path
    const migrationsDir = resolve(join(__dirname, '..', 'migrations'));
    const migrationPath = resolve(migrationsDir, validatedFilename);
    
    // Validate the resolved path is safe
    validateMigrationPath(migrationPath, migrationsDir);
    
    console.log(`📁 Migration path validated: ${migrationPath}`);
    
    // Ensure schema_migrations table exists
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Check if migration has already been applied
    const existingMigration = await sql`
      SELECT name, applied_at FROM schema_migrations WHERE name = ${validatedFilename}
    `;
    
    if (existingMigration.length > 0) {
      console.log(`⏭️  Migration already applied: ${validatedFilename}`);
      console.log(`   Applied at: ${existingMigration[0].applied_at || 'unknown'}\n`);
      return;
    }
    
    // Read migration file (path already validated)
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL loaded, executing...\n');
    
    // Execute migration within a transaction
    await sql.begin(async sql => {
      // Run the migration
      await sql.unsafe(migrationSQL);
      
      // Record successful migration
      await sql`
        INSERT INTO schema_migrations (name, applied_at)
        VALUES (${validatedFilename}, CURRENT_TIMESTAMP)
      `;
    });
    
    console.log(`✅ Migration completed successfully: ${validatedFilename}`);
    console.log(`   Recorded in schema_migrations table\n`);
    
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

// Validate migration filename before running
try {
  validateMigrationFilename(migrationFile);
  runMigration(migrationFile).catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
} catch (validationError) {
  console.error('❌ Invalid migration filename:', validationError.message);
  console.error('\nUsage: node scripts/run-migration.js <migration-file.sql>');
  console.error('Example: node scripts/run-migration.js add-tenant-invitation-fields.sql');
  process.exit(1);
}
