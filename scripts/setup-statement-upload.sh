#!/bin/bash

# Statement Upload Feature - Deployment Script
# Run this script to set up the statement upload feature

set -e  # Exit on error

echo "🚀 Setting up Statement Upload Feature"
echo "======================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL environment variable not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
    exit 1
fi

echo -e "${YELLOW}📋 Step 1: Running database migration...${NC}"
if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f migrations/004_statement_upload_history.sql
    echo -e "${GREEN}✅ Migration completed${NC}"
else
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client tools${NC}"
    echo "Or run this SQL manually:"
    echo "  psql \$DATABASE_URL -f migrations/004_statement_upload_history.sql"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Step 2: Testing parsers...${NC}"
if [ -f "tests/test-statement-parsers.js" ]; then
    node tests/test-statement-parsers.js
    echo -e "${GREEN}✅ Parser tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Test file not found, skipping parser tests${NC}"
fi

echo ""
echo -e "${YELLOW}📋 Step 3: Verifying API endpoints...${NC}"
API_FILES=(
    "api/reconciliation/upload-statement.ts"
    "api/reconciliation/upload-history.ts"
    "api/reconciliation/_parsers/statementParser.ts"
    "api/reconciliation/_parsers/mpesaParser.ts"
    "api/reconciliation/_parsers/equityParser.ts"
    "api/reconciliation/_parsers/kcbParser.ts"
    "api/reconciliation/_parsers/coopParser.ts"
    "api/reconciliation/_parsers/ncbaParser.ts"
    "api/reconciliation/_parsers/genericParser.ts"
)

ALL_EXIST=true
for file in "${API_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✓${NC} $file"
    else
        echo -e "${RED}  ✗${NC} $file (missing)"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo -e "${GREEN}✅ All API files present${NC}"
else
    echo -e "${RED}❌ Some API files are missing${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Step 4: Verifying UI components...${NC}"
UI_FILES=(
    "client/src/components/reconciliation/StatementUpload.tsx"
    "client/src/components/ui/progress.tsx"
)

for file in "${UI_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✓${NC} $file"
    else
        echo -e "${RED}  ✗${NC} $file (missing)"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo -e "${GREEN}✅ All UI files present${NC}"
else
    echo -e "${RED}❌ Some UI files are missing${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Step 5: Checking sample test files...${NC}"
SAMPLE_COUNT=$(find tests/sample-statements -name "*.csv" 2>/dev/null | wc -l)
if [ "$SAMPLE_COUNT" -ge 5 ]; then
    echo -e "${GREEN}✅ Found $SAMPLE_COUNT sample CSV files${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 6 sample files, found $SAMPLE_COUNT${NC}"
fi

echo ""
echo "======================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start dev server: npm run dev"
echo "  2. Login as landlord"
echo "  3. Go to Dashboard → Payment Settings"
echo "  4. Try uploading a test CSV from tests/sample-statements/"
echo ""
echo "Documentation:"
echo "  - User Guide: STATEMENT_UPLOAD_GUIDE.md"
echo "  - Tech Docs: STATEMENT_UPLOAD_IMPLEMENTATION.md"
echo ""
echo -e "${GREEN}Happy reconciling! 🎉${NC}"
