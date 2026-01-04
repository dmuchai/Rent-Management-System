# 🏠 Landee & Moony - Rent Management System

A modern, full-stack property management platform built with **React**, **TypeScript**, **Vercel Serverless Functions**, and **Supabase**.

## ✨ Features

### 🔐 Authentication
- **Email/Password Login** - Traditional authentication with secure password validation
- **Google OAuth** - One-click sign-in with Google
- **Role-based Access** - Support for Landlords, Tenants, and Property Managers
- **Password Visibility Toggle** - Show/hide password during login and registration

### 🏢 Property Management
- Create and manage unlimited properties
- Full CRUD operations (Create, Read, Update, Delete)
- Property details with address and description
- Track property-level statistics

### 🏠 Unit Management
- Add multiple units per property
- Unit details: number, bedrooms, bathrooms, size, rent amount
- Occupancy status tracking
- Edit and update unit information
- Responsive unit display with proper data formatting

### 👥 Tenant Management
- Comprehensive tenant profiles
- Contact information and lease history
- User-specific tenant filtering
- Create, view, and edit tenant records

### 📋 Lease Management
- Create lease agreements linking tenants to units
- Lease terms: start date, end date, monthly rent, security deposit
- Active/Inactive status tracking
- Automatic status calculation (Upcoming, Active, Expired)
- Conflict detection for overlapping leases
- Full edit capabilities with data pre-population

### 💰 Payment Tracking
- Record and track rent payments
- Payment history with tenant and property details
- Dashboard revenue statistics
- Monthly and total revenue tracking

### 📊 Dashboard
- Real-time statistics overview
- Property and tenant counts
- Revenue analytics (monthly and total)
- Recent payments display
- Quick action cards for common tasks
- **Mobile-Responsive Design** with collapsible sidebar
- **Desktop Sidebar Toggle** - Collapse to icon-only view

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ and npm
- Supabase account
- Vercel account (for deployment)

### 2. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Set up Database Schema**
   - Open Supabase SQL Editor
   - Run the schema from `supabase-migration.sql`
   - This creates tables, RLS policies, and relationships

3. **Configure Authentication**
   - Enable Email provider in Supabase Authentication settings
   - Enable Google OAuth provider (optional)
   - Configure redirect URLs for your domain

### 3. Environment Variables

Create a `.env` file in the root:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database Connection (Session Pooler)
DATABASE_URL=postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-eu-north-1.pooler.supabase.com:5432/postgres

# Optional: Node Environment
NODE_ENV=production
```

### 4. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL
```

## 🏗️ Architecture

```
Frontend (React + Vite + TypeScript)
    ↓ 
    ├── Wouter (Client-side routing)
    ├── TanStack Query (Data fetching)
    ├── Tailwind CSS + shadcn/ui (Styling)
    └── Lucide React (Icons)
    ↓ 
Vercel Serverless Functions (/api)
    ↓ 
    ├── JWT Authentication (Supabase)
    ├── postgres.js (Database queries)
    └── Zod (Validation)
    ↓
Supabase Backend
    ├── PostgreSQL Database (Session Pooler)
    ├── Authentication (Email + OAuth)
    └── Row Level Security (RLS)
```

## 📡 API Endpoints

All endpoints are Vercel Serverless Functions located in `/api` directory. Authentication is handled via Supabase JWT tokens in cookies or Authorization headers.

### Authentication
- `POST /api/login` - Email/password authentication
- `GET /api/login?provider=google` - Google OAuth redirect
- `POST /api/register` - Create new user account
- `GET /api/auth/user` - Get current user info
- `POST /api/auth/logout` - Sign out user
- `GET /api/auth-callback` - OAuth callback handler

### Properties
- `GET /api/properties` - List all user's properties
- `GET /api/properties?id={id}` - Get specific property details
- `POST /api/properties` - Create new property
- `PUT /api/properties` - Update property (requires `id` in body)
- `DELETE /api/properties?id={id}` - Delete property

### Units
- `GET /api/units` - List all user's units
- `GET /api/units?propertyId={id}` - Get units for specific property
- `POST /api/units` - Create new unit
- `PUT /api/units` - Update unit (requires `id` in body)

### Tenants
- `GET /api/tenants` - List all user's tenants
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants` - Update tenant (requires `id` in body)

### Leases
- `GET /api/leases` - List all leases for user's properties
- `POST /api/leases` - Create new lease agreement
- `PUT /api/leases` - Update lease (requires `id` in body)

### Payments
- `GET /api/payments` - List all payments for user's properties
- `POST /api/payments` - Record new payment

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics and metrics

## 🗃️ Database Schema

### Core Tables
- **properties** - Property information (name, address, owner_id, type)
- **units** - Rental units (property_id, unit_number, bedrooms, bathrooms, size, rent_amount, is_occupied)
- **tenants** - Tenant profiles (user_id, first_name, last_name, email, phone)
- **leases** - Lease agreements (tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit, is_active)
- **payments** - Payment records (lease_id, amount, paid_date, status, payment_method)

### Column Naming Convention
- Database uses `snake_case` (e.g., `monthly_rent`, `security_deposit`, `unit_number`)
- API transforms to `camelCase` for frontend (e.g., `monthlyRent`, `securityDeposit`, `unitNumber`)

## 🛡️ Security Features

- **Row Level Security (RLS)** - Supabase policies ensure users only access their own data
- **JWT Authentication** - Secure token-based auth with Supabase
- **OAuth Support** - Google sign-in integration
- **Password Validation** - 8+ characters, uppercase, lowercase, number, special character
- **Input Validation** - Zod schema validation on all endpoints
- **SQL Injection Protection** - Parameterized queries with postgres.js
- **HTTPS Only** - Secure cookie transmission
- **Session Pooler** - Optimized database connections for serverless

## 💻 Frontend Features

### Responsive Design
- **Mobile-First** - Fully responsive on all screen sizes
- **Hamburger Menu** - Slide-in sidebar overlay on mobile (<768px)
- **Collapsible Sidebar** - Desktop toggle between full (256px) and collapsed (80px) width
- **Responsive Grids** - Adaptive layouts for property/unit cards
- **Touch-Friendly** - Proper touch targets and spacing

### User Experience
- **Password Visibility** - Toggle show/hide with eye icon in login/register
- **Form Validation** - Real-time validation with helpful error messages
- **Loading States** - Spinners and disabled states during async operations
- **Toast Notifications** - Success/error feedback for all actions
- **Auto-Close Modals** - Forms close automatically on success
- **Data Pre-population** - Edit forms load existing data

### Components
- **Sidebar** - Navigation with active state and icons
- **Header** - User menu, notifications, and menu controls
- **Dashboard** - Statistics cards and recent activity
- **Property Cards** - Visual property display with actions
- **Data Tables** - Sortable, responsive tables for leases and tenants
- **Forms** - Reusable forms with validation

## 🔧 Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Wouter** - Lightweight routing (2KB)
- **TanStack Query** - Data fetching and caching
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **Lucide React** - Modern icon system

### Backend
- **Vercel Serverless Functions** - API endpoints
- **Node.js 18+** - Runtime environment
- **TypeScript** - Type safety
- **postgres.js** - PostgreSQL client
- **Zod** - Schema validation
- **@supabase/supabase-js** - Supabase SDK

### Database & Auth
- **Supabase** - Backend as a Service
- **PostgreSQL 15** - Relational database
- **Row Level Security** - Data access policies
- **Supabase Auth** - Authentication service

## 📁 Project Structure

```
/
├── api/                          # Vercel Serverless Functions
│   ├── _lib/                     # Shared utilities
│   │   ├── auth.ts              # Authentication middleware
│   │   ├── db.ts                # Database connection
│   │   └── verify-auth.ts       # JWT verification
│   ├── auth/                     # Auth endpoints
│   ├── dashboard/               # Dashboard endpoints
│   ├── leases/                  # Lease CRUD
│   ├── payments/                # Payment endpoints
│   ├── properties/              # Property CRUD
│   ├── tenants/                 # Tenant CRUD
│   ├── units/                   # Unit CRUD
│   ├── login.ts                 # Login handler
│   └── register.ts              # Registration handler
├── client/                       # React frontend
│   └── src/
│       ├── components/           # Reusable components
│       │   ├── layout/          # Header, Sidebar
│       │   ├── properties/      # Property components
│       │   ├── tenants/         # Tenant components
│       │   ├── leases/          # Lease components
│       │   ├── payments/        # Payment components
│       │   └── ui/              # shadcn/ui components
│       ├── hooks/               # Custom React hooks
│       ├── lib/                 # Utilities and config
│       ├── pages/               # Page components
│       │   ├── landing.tsx      # Landing page
│       │   ├── login.tsx        # Login page
│       │   ├── register.tsx     # Registration page
│       │   └── dashboard/       # Dashboard pages
│       └── App.tsx              # Root component
├── shared/                       # Shared types
│   └── schema.ts                # TypeScript types and Zod schemas
├── vercel.json                  # Vercel configuration
├── vite.config.ts              # Vite configuration
└── package.json                # Dependencies
```

## 🚀 Development

### Local Setup

```bash
# Install dependencies
npm install

# Start development server (client on port 5173)
npm run dev

# Build for production
npm run build

# Type checking
npm run check
```

### Vercel CLI Development

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Pull environment variables
vercel env pull

# Run with serverless functions locally
vercel dev
```

## 🚨 Troubleshooting

### Common Issues

**1. "Authentication required" errors**
- Verify Supabase URL and anon key in environment variables
- Check if cookies are being set (check browser DevTools)
- Ensure Supabase project has correct redirect URLs configured

**2. "Method Not Allowed (405)" errors**
- Verify you're using the correct HTTP method (GET, POST, PUT)
- For PUT operations, ensure `id` is in the request body
- Check API endpoint exists in `/api` folder

**3. Database connection errors**
- Verify `DATABASE_URL` uses session pooler connection string
- Check password is URL-decoded correctly in connection helper
- Ensure database schema is set up with RLS policies

**4. "NaN" or blank values in forms**
- Check database column names match API transformation
- Verify snake_case to camelCase conversion in API responses
- Ensure field names in forms match API response structure

**5. Login/Register not working**
- Check Font Awesome is loaded OR Lucide icons are imported
- Verify Supabase Auth settings (email provider enabled)
- Check password meets validation requirements (8+ chars, mixed case, number, special char)

**6. Mobile sidebar not appearing**
- Clear browser cache and hard refresh
- Check responsive breakpoints (md:hidden, md:flex)
- Verify state management for sidebar open/close

### Debug Tips

1. **Check Vercel Logs**: View real-time function logs in Vercel dashboard
2. **Browser Console**: Check for JavaScript errors and network requests
3. **Supabase Dashboard**: Monitor auth events and database queries
4. **Network Tab**: Verify API requests and responses
5. **Check Environment Variables**: Ensure all required vars are set in Vercel

## 📝 Configuration Files

- `vercel.json` - Vercel deployment and routing configuration
- `vite.config.ts` - Vite build and dev server settings
- `tailwind.config.ts` - Tailwind CSS customization
- `tsconfig.json` - TypeScript compiler options
- `shared/schema.ts` - Shared types and Zod validation schemas

## 🎯 Key Implementation Details

### Authentication Flow
1. User enters credentials on `/login` or `/register`
2. Frontend calls `/api/login` (POST) or `/api/register` (POST)
3. Supabase Auth validates and creates session
4. Backend sets httpOnly cookie with JWT token
5. Subsequent API calls include cookie automatically
6. `requireAuth` middleware verifies JWT on each request

### Data Flow
1. Frontend makes request with TanStack Query
2. Vercel function receives request
3. `requireAuth` middleware extracts and verifies JWT
4. Database query executed with user context
5. Results transformed from snake_case to camelCase
6. JSON response sent to frontend
7. TanStack Query caches result

### Mobile Responsiveness
- **< 768px**: Hamburger menu, overlay sidebar, stacked buttons
- **≥ 768px**: Persistent sidebar, horizontal buttons, expandable/collapsible toggle
- **Breakpoints**: `sm:`, `md:`, `lg:` Tailwind classes throughout

## 🔄 Recent Updates

- ✅ Mobile-responsive dashboard with collapsible sidebar
- ✅ Email/password authentication alongside Google OAuth
- ✅ Password visibility toggles with Lucide React icons
- ✅ Role selection on registration (Landlord/Tenant/Property Manager)
- ✅ Full CRUD operations for properties, units, tenants, and leases
- ✅ Edit forms with data pre-population using useEffect
- ✅ Proper data transformation (snake_case ↔ camelCase)
- ✅ Fixed lease creation with correct database column names
- ✅ PUT handlers for updating resources
- ✅ Query parameter routing for property details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Backend infrastructure
- [Vercel](https://vercel.com) - Hosting and serverless functions
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [TanStack Query](https://tanstack.com/query) - Data fetching
- [Lucide](https://lucide.dev) - Icon system

---

Built with ❤️ using modern web technologies

🚀 **Live Demo**: [https://property-manager-ke.vercel.app](https://property-manager-ke.vercel.app)