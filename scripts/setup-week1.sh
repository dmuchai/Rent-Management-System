#!/bin/bash

# Week 1 Setup Script - Payment Reconciliation Foundation
# Run this script to set up the database tables and test the implementation

set -e  # Exit on error

echo "🚀 Setting up Payment Reconciliation System - Week 1"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo ""
echo "📦 Step 1: Installing dependencies..."
npm install

echo ""
echo "🗄️  Step 2: Running database migration..."
echo "Choose your database setup:"
echo "1) Supabase (Remote)"
echo "2) Local PostgreSQL"
echo "3) Skip migration (I'll run it manually)"
read -p "Enter choice (1-3): " DB_CHOICE

case $DB_CHOICE in
    1)
        echo ""
        echo "📋 Copy the SQL from migrations/001_payment_reconciliation_phase1.sql"
        echo "   and run it in your Supabase SQL Editor"
        echo ""
        echo "🔗 Supabase SQL Editor: https://app.supabase.com/project/_/sql"
        echo ""
        read -p "Press Enter when you've run the migration..."
        ;;
    2)
        echo ""
        read -p "Enter PostgreSQL host (default: localhost): " PG_HOST
        PG_HOST=${PG_HOST:-localhost}
        
        read -p "Enter PostgreSQL port (default: 5432): " PG_PORT
        PG_PORT=${PG_PORT:-5432}
        
        read -p "Enter database name: " PG_DB
        read -p "Enter database user: " PG_USER
        
        echo ""
        echo "Running migration..."
        psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -f migrations/001_payment_reconciliation_phase1.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migration completed successfully!"
        else
            echo "❌ Migration failed. Please check the errors above."
            exit 1
        fi
        ;;
    3)
        echo "⏭️  Skipping migration. Make sure to run it manually!"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Week 1 Setup Complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Start the dev server: npm run dev"
echo "2. Login as a landlord"
echo "3. Navigate to 'Payment Settings' in the sidebar"
echo "4. Add your first payment channel!"
echo ""
echo "📖 See WEEK1_IMPLEMENTATION.md for detailed testing instructions"
