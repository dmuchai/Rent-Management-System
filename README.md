# 🏠 Rent Management System - Supabase Setup

A full-stack rent management system built with **React**, **Express.js**, and **Supabase** (PostgreSQL + Auth + Storage).

## 🚀 Quick Start

### 1. Supabase Project Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note down your project URL and API keys

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Set up Database Schema**
   - Open your Supabase SQL Editor
   - Copy and run the SQL from `supabase-migration.sql`

4. **Test Your Setup**
   ```bash
   npm run test:supabase  # Test database connection
   npm run dev           # Start development server
   npm run test:api      # Test API endpoints
   ```

### 2. Environment Variables

Add these to your `.env` file:

```env
# Required Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here

# Server Configuration
PORT=5000
NODE_ENV=development
```

## 🏗️ Architecture

```
Frontend (React + TypeScript)
    ↓ JWT Authentication
Express.js API Server
    ↓ Supabase Client
Supabase Backend
    ├── PostgreSQL Database
    ├── Authentication
    └── Storage
```

## 📡 API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Properties
- `GET /api/properties` - Get user's properties
- `POST /api/properties` - Create new property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### Units
- `GET /api/properties/:propertyId/units` - Get property units
- `POST /api/units` - Create new unit
- `PUT /api/units/:id` - Update unit

### Tenants
- `GET /api/tenants` - Get user's tenants
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants/:id` - Update tenant

## 🔐 Authentication Flow

1. **Frontend**: User signs in via Supabase Auth
2. **JWT Token**: Supabase returns a JWT token
3. **API Calls**: Frontend sends JWT in Authorization header
4. **Verification**: Express middleware verifies JWT
5. **Database**: Supabase enforces Row Level Security (RLS)

## 🗃️ Database Tables

- **properties** - Property information (name, address, owner)
- **units** - Individual rental units within properties
- **tenants** - Tenant information and contact details
- **leases** - Lease agreements linking tenants to units
- **payments** - Rent payments and transaction records
- **maintenance_requests** - Maintenance and repair requests
- **documents** - File storage references

## 🛡️ Security Features

- **Row Level Security (RLS)** - Users can only access their own data
- **JWT Authentication** - Secure token-based authentication
- **API Rate Limiting** - Prevents abuse
- **Input Validation** - Zod schema validation
- **SQL Injection Protection** - Parameterized queries

## 🧪 Testing

```bash
# Test Supabase connection
npm run test:supabase

# Test API endpoints
npm run test:api

# Run development server
npm run dev

# Type checking
npm run check
```

## 📝 Development Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run check           # TypeScript type checking

# Testing
npm run test:supabase   # Test database connection
npm run test:api        # Test API endpoints

# Production
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:push         # Push schema changes to database
```

## 🔧 Configuration Files

- `.env` - Environment variables
- `supabase-migration.sql` - Database schema and RLS policies
- `shared/schema.ts` - TypeScript types and Zod validation
- `server/routes.ts` - API endpoint definitions
- `server/storage.ts` - Supabase database operations
- `server/replitAuth.ts` - JWT authentication middleware

## 📚 Key Technologies

- **Frontend**: React, TypeScript, Tailwind CSS, React Query
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (JWT)
- **Validation**: Zod
- **Build Tools**: Vite, TSX

## 🚨 Troubleshooting

### Common Issues

1. **"Authentication required" errors**
   - Check your JWT token is valid
   - Verify Supabase JWT secret is correct

2. **Database connection errors**
   - Verify Supabase URL and service role key
   - Check if database tables exist

3. **CORS errors**
   - Ensure your domain is whitelisted in Supabase
   - Check authentication settings

4. **RLS policy errors**
   - Verify Row Level Security policies are set up
   - Check user has proper permissions

### Getting Help

1. Check the Supabase dashboard for errors
2. Review server logs in development
3. Use the test scripts to isolate issues
4. Verify environment variables are loaded

## 🎯 Next Steps

1. Set up your Supabase project
2. Run the database migration
3. Configure your environment variables
4. Test the connection and API endpoints
5. Start developing your features!

---

Happy coding! 🚀