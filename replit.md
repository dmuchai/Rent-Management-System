# RentFlow - Property Management System

## Overview

RentFlow is a full-stack property management application designed for landlords and tenants. The system provides comprehensive tools for property management, tenant relations, payment processing, maintenance requests, and document management. Built with a modern tech stack, it features role-based access control, real-time payment integration, and automated workflows to streamline property management operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite for build tooling
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for client-side routing with role-based navigation
- **Form Handling**: React Hook Form with Zod validation schemas
- **File Uploads**: Uppy integration for document management with object storage

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Replit Auth integration with OpenID Connect (OIDC)
- **Session Management**: Express sessions stored in PostgreSQL with connect-pg-simple
- **File Storage**: Google Cloud Storage integration with custom ACL system

### Database Design
- **Primary Database**: PostgreSQL with Neon serverless integration
- **Schema Management**: Drizzle migrations with schema definitions in shared directory
- **Key Entities**: Users, Properties, Units, Tenants, Leases, Payments, Maintenance Requests, Documents
- **Session Storage**: Dedicated sessions table for authentication state
- **Relationships**: Well-defined foreign key relationships between entities with proper indexing

### Authentication & Authorization
- **Authentication Provider**: Replit Auth with OIDC protocol
- **Session Handling**: Server-side sessions with secure cookie configuration
- **Role-Based Access**: User roles (landlord/tenant) determine dashboard and feature access
- **API Security**: Authentication middleware protecting all API endpoints
- **Object-Level Permissions**: Custom ACL system for document access control

### Payment Processing
- **Payment Gateway**: Pesapal integration for mobile money and card payments
- **Payment Flow**: OAuth-style token authentication with transaction status tracking
- **Supported Methods**: M-Pesa, card payments, and bank transfers
- **Automated Notifications**: Email notifications for payment confirmations and reminders

### Document Management
- **Storage Backend**: Google Cloud Storage with Replit sidecar integration
- **Access Control**: Custom ACL policy system with group-based permissions
- **File Organization**: Category-based document organization (lease, property, maintenance, financial)
- **Upload Handling**: Direct-to-storage uploads with presigned URLs

### Email System
- **Email Service**: Nodemailer with SMTP configuration
- **Automated Workflows**: Rent reminders, payment confirmations, maintenance notifications
- **Template System**: HTML email templates for consistent branding
- **Delivery Tracking**: Error handling and delivery status monitoring

### Development & Deployment
- **Build Process**: Vite for frontend bundling, esbuild for backend compilation
- **Development Server**: Hot module replacement with Vite dev server integration
- **Environment Configuration**: Environment-based configuration for database, auth, and external services
- **Asset Handling**: Static file serving with proper caching headers

### API Design
- **Architecture**: RESTful API with consistent JSON responses
- **Error Handling**: Centralized error middleware with structured error responses
- **Request Validation**: Zod schema validation for all API endpoints
- **Response Format**: Standardized response structure with proper HTTP status codes
- **Logging**: Comprehensive request/response logging for debugging

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for documents and file uploads
- **Replit Sidecar**: Authentication proxy for Google Cloud services

### Authentication & Sessions
- **Replit Auth**: OIDC-based authentication with user profile management
- **Session Store**: PostgreSQL-backed session storage with automatic cleanup

### Payment Processing
- **Pesapal API**: Payment gateway for East African mobile money and card processing
- **OAuth Integration**: Token-based authentication for payment API access

### Communication Services
- **SMTP Service**: Email delivery for notifications and automated workflows
- **Nodemailer**: Email client library with HTML template support

### Frontend Libraries
- **UI Components**: Radix UI primitives for accessible component foundations
- **Styling**: Tailwind CSS with custom design system variables
- **File Upload**: Uppy with AWS S3 plugin for direct storage uploads
- **Date Handling**: date-fns for date manipulation and formatting

### Development Tools
- **Build Tools**: Vite, esbuild, TypeScript compiler
- **Code Quality**: ESLint and TypeScript for code analysis
- **Database Tools**: Drizzle Kit for schema management and migrations