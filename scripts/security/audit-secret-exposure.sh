#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[security] scanning workspace for potential Supabase secret exposure..."

# Exclude large/generated directories
EXCLUDES=(
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=.git
  --exclude-dir=.vercel
  --exclude-dir=.next
  --exclude-dir=build
)

# Scan tracked files only (CI-safe and avoids failing on local untracked .env files)
TRACKED_FILES=$(git ls-files)

# 1) Hard fail on concrete service_role secret value leakage patterns
SERVICE_ROLE_JWT_MATCHES=$(printf '%s\n' "$TRACKED_FILES" | xargs -r grep -nE \
  "SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"]?(eyJ[A-Za-z0-9._-]{20,}|sb_secret_[A-Za-z0-9._-]{10,})" 2>/dev/null || true)

# 2) Warn on suspicious variable names in non-example files
VAR_NAME_MATCHES=$(printf '%s\n' "$TRACKED_FILES" | xargs -r grep -nE \
  "SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY|sb_secret|service_role" 2>/dev/null || true)

# 3) High-risk: tracked env files with non-placeholder secrets
TRACKED_ENVS=$(git ls-files | grep -E '(^|/)\.env(\..+)?$' || true)
HIGH_RISK_ENV_FILES=""

if [[ -n "$TRACKED_ENVS" ]]; then
  while IFS= read -r env_file; do
    [[ -z "$env_file" ]] && continue

    # Allow known safe examples/placeholders
    if [[ "$env_file" =~ \.env\.example$ ]] || [[ "$env_file" =~ \.sample$ ]] || [[ "$env_file" =~ \.sample\.env$ ]]; then
      continue
    fi

    if grep -qE '^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET|DATABASE_URL|UPSTASH_REDIS_REST_TOKEN|BREVO_API_KEY|VERCEL_OIDC_TOKEN)=' "$env_file"; then
      # Skip obvious placeholders
      if ! grep -Eq '(your_|YOUR_|example|placeholder|changeme)' "$env_file"; then
        HIGH_RISK_ENV_FILES+="$env_file"$'\n'
      fi
    fi
  done <<< "$TRACKED_ENVS"
fi

if [[ -n "$HIGH_RISK_ENV_FILES" ]]; then
  echo "[security][HIGH] tracked env files with probable real secrets found:" >&2
  echo "$HIGH_RISK_ENV_FILES" >&2
  echo "[security] move secrets to deployment secret stores, purge from git history, and rotate keys immediately." >&2
  exit 2
fi

if [[ -n "$SERVICE_ROLE_JWT_MATCHES" ]]; then
  echo "[security][HIGH] possible service_role token leakage detected:" >&2
  echo "$SERVICE_ROLE_JWT_MATCHES" >&2
  echo "[security] rotate SUPABASE_SERVICE_ROLE_KEY and scrub leaked values." >&2
  exit 2
fi

if [[ -n "$VAR_NAME_MATCHES" ]]; then
  echo "[security][WARN] service-role env references found (review usage):"
  echo "$VAR_NAME_MATCHES"
fi

if [[ -f .env ]] && grep -qE "SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"]?(eyJ|sb_secret_)" .env; then
  echo "[security][WARN] local .env contains SUPABASE_SERVICE_ROLE_KEY; ensure .env is gitignored and never committed."
fi

echo "[security] scan complete: no explicit leaked service_role token pattern detected."
