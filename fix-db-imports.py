#!/usr/bin/env python3
import re

files = [
    'api/tenants/index.ts',
    'api/units/index.ts', 
    'api/leases/index.ts',
    'api/payments/index.ts',
    'api/dashboard/stats.ts'
]

db_connection_code = """  // Create database connection
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const sql = postgres(databaseUrl, { 
    prepare: false,
    max: 1,
  });
  const db = drizzle(sql);

  try {
"""

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Add try block after auth check
        content = re.sub(
            r'(if \(!auth\) \{\s+return res\.status\(401\)\.json\(\{ error: [\'"]Unauthorized[\'"] \}\);\s+\})\s+',
            r'\1\n\n' + db_connection_code,
            content
        )
        
        # Add finally block at the end before the closing brace
        content = re.sub(
            r'(\n\})\s*$',
            r'\n  } finally {\n    await sql.end();\n  }\n}',
            content
        )
        
        with open(filepath, 'w') as f:
            f.write(content)
        
        print(f"Fixed {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
