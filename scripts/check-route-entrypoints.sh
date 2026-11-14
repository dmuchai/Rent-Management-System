#!/usr/bin/env bash
set -euo pipefail

if grep -E -n -R "from \"\./routes\"|from '\./routes'|import\(\"./routes\"\)|import\('\./routes'\)" server; then
  echo "Legacy routes import detected. Use ./routes/index instead."
  exit 1
fi

grep -q 'from "./routes/index"' server/index.ts
grep -q 'from "./routes/index"' server/prod.ts

echo "Route entrypoint check passed."
