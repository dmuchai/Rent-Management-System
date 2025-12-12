#!/bin/bash
# This script will help identify which endpoints need fixing
echo "Endpoints still using Drizzle ORM:"
grep -l "db.query\|db.insert\|db.update\|db.delete" api/**/*.ts | grep -v node_modules
