import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

// Use direct connection instead of pooler
const directUrl = process.env.DATABASE_URL.replace(':6543/', ':5432/');
const sql = postgres(directUrl);

async function createTables() {
  try {
    console.log('Creating tables...');
    
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        role VARCHAR NOT NULL DEFAULT 'landlord',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Users table created');

    // Create sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `;
    console.log('✓ Sessions table created');

    // Create index on sessions
    await sql`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire)
    `;
    console.log('✓ Sessions index created');

    // Create properties table
    await sql`
      CREATE TABLE IF NOT EXISTS properties (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        address TEXT NOT NULL,
        property_type VARCHAR NOT NULL,
        total_units INTEGER NOT NULL,
        description TEXT,
        image_url VARCHAR,
        owner_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Properties table created');

    console.log('All tables created successfully!');
    
    // Test inserting a user record
    const testUser = await sql`
      INSERT INTO users (id, email, first_name, last_name, role)
      VALUES ('test-user-id', 'test@example.com', 'Test', 'User', 'landlord')
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `;
    console.log('✓ Test user record:', testUser[0]);
    
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    await sql.end();
  }
}

createTables();