#!/usr/bin/env bash
set -euo pipefail

if rg -n "from \"\./routes\"|from '\./routes'|import\(\"./routes\"\)|import\('\./routes'\)" server; then
  echo "Legacy routes import detected. Use ./routes/index instead."
  exit 1
fi

rg -q 'from "./routes/index"' server/index.ts
rg -q 'from "./routes/index"' server/prod.ts

echo "Route entrypoint check passed."
