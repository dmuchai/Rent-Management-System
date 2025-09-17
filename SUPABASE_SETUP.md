# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/login and create a new project
3. Choose a project name and set a database password
4. Wait for the project to be created

## 2. Get Your API Keys

From your Supabase project dashboard:

1. Go to **Settings** → **API**
2. Copy the following values to your `.env` file:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` 
   - **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY`

3. Go to **Settings** → **API** → **JWT Settings**
   - Copy **JWT Secret** → `SUPABASE_JWT_SECRET`

## 3. Set Up Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable Row Level Security
ALTER TABLE IF EXISTS properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS units ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own data)
CREATE POLICY "Users can view their own properties" ON properties FOR SELECT USING (owner_id = auth.uid()::text);
CREATE POLICY "Users can insert their own properties" ON properties FOR INSERT WITH CHECK (owner_id = auth.uid()::text);
CREATE POLICY "Users can update their own properties" ON properties FOR UPDATE USING (owner_id = auth.uid()::text);
CREATE POLICY "Users can delete their own properties" ON properties FOR DELETE USING (owner_id = auth.uid()::text);

-- Similar policies for other tables...
```

## 4. Configure Authentication

1. Go to **Authentication** → **Settings**
2. Enable the authentication methods you want (Email, Google, etc.)
3. Set up redirect URLs if needed

## 5. Set Up Storage (Optional)

1. Go to **Storage**
2. Create buckets for:
   - `property-images`
   - `documents`
   - `receipts`

## 6. Test Your Connection

Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:5000`