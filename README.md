# Rent Management System

A comprehensive Rent Management System built to streamline interactions between landlords and tenants. This application manages properties, tenants, leases, and payments, providing a unified dashboard for all rental management needs.

## Features

- **Property Management**: Track properties, units, and occupancy status.
- **Tenant Portal**: Allow tenants to view lease details, pay rent, and submit maintenance requests.
- **Landlord Dashboard**: Manage properties, view financial reports, and oversee tenant communications.
- **Lease Management**: Digital lease tracking and documentation.
- **Financials**: Rent collection, payment tracking, and optional payment gateway integration (Pesapal).
- **Mobile Support**: Native mobile functionality via Capacitor for Android and iOS.

## Tech Stack

**Frontend:**
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [TypeScript](https://www.typescriptlang.org/)

**Backend:**
- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)

**Database & Storage:**
- [PostgreSQL](https://www.postgresql.org/) (via Supabase/Neon)
- [Supabase](https://supabase.com/) (Auth, Storage, Realtime)
- [Upstash Redis](https://upstash.com/) (Rate limiting)

**Mobile:**
- [Capacitor](https://capacitorjs.com/)

**Utilities:**
- [Zod](https://zod.dev/) (Validation)
- [TanStack Query](https://tanstack.com/query/latest) (Data Fetching)
- [Recharts](https://recharts.org/) (Data Visualization)

## Prerequisites

Before getting started, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v20 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A [Supabase](https://supabase.com/) account for database and authentication services.

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Rent-Management-System
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy `.env.example` to `.env` and fill in your credentials.
   ```bash
   cp .env.example .env
   ```
   *See `.env.example` for details on required Supabase and service keys.*

4. **Setup Database**
   Push the schema to your database using Drizzle Kit.
   ```bash
   npm run db:push
   ```

## Usage

### Development Server
Run the application in development mode (starts both frontend and backend).
```bash
npm run dev
```
The application will be available at `http://localhost:5000` (or the port specified in your .env).

### Mobile Development
Sync and open native projects.

**Android:**
```bash
npm run mobile:android
```

**iOS:**
```bash
npm run mobile:ios
```

## Scripts

- `npm run dev`: Start the development server.
- `npm run build`: Build the backend for production.
- `npm run build:frontend`: Build the frontend static assets.
- `npm run db:generate`: Generate database migrations.
- `npm run db:push`: Push schema changes to the database directly.
- `npm run check`: Run TypeScript type checking.
- `npm test:api`: Run API tests.

## License

MIT
