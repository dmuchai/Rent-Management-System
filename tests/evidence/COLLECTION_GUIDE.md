# Evidence Collection Guide

## Quick Start

This guide explains how to collect and organize testing evidence for the PKCE OAuth Security Upgrade.

## 📋 Prerequisites

- Browser DevTools knowledge
- Access to production environment
- Vercel dashboard access
- Supabase dashboard access
- Screen recording software
- HAR file export capability

## 🎯 Evidence Collection Workflow

### Step 1: Prepare Test Environment

```bash
# Clear browser data
- Open DevTools (F12)
- Application > Storage > Clear site data
- Close all tabs
- Open incognito window (optional)
```

### Step 2: Execute Test Scenario

Follow test procedures in each evidence directory:
- [`functional/README.md`](./functional/README.md) - OAuth login, password reset
- [`security/README.md`](./security/README.md) - Token protection, replay attacks
- [`browsers/README.md`](./browsers/README.md) - Cross-browser compatibility
- [`backend/README.md`](./backend/README.md) - Backend logs, database queries
- [`ci/README.md`](./ci/README.md) - Automated test results
- [`deployment/README.md`](./deployment/README.md) - Deployment verification

### Step 3: Capture Evidence

#### Screenshots (PNG)
```
Tools:
- Ubuntu: Screenshot tool (Shift+PrtScn)
- macOS: Cmd+Shift+4
- Windows: Win+Shift+S

Best practices:
- Capture full browser window
- Include URL bar (redact if needed)
- Highlight important elements
- Use 1920x1080 resolution
```

#### Screen Recordings (MP4)
```
Tools:
- Ubuntu: SimpleScreenRecorder, Kazam
- macOS: QuickTime (Cmd+Ctrl+N)
- Windows: Xbox Game Bar (Win+G)

Best practices:
- Record at 30fps minimum
- Include audio narration (optional)
- Keep videos under 2 minutes
- Compress before committing
```

#### Network Captures (HAR)
```
Steps:
1. Open DevTools > Network tab
2. Click "Preserve log"
3. Execute test flow
4. Right-click > Save all as HAR
5. Sanitize sensitive data
6. Save to security/ directory
```

#### Backend Logs (LOG/JSON)
```
Vercel:
1. Dashboard > Logs
2. Filter by time range
3. Filter by /api/auth
4. Download log stream
5. Save to backend/ directory

Supabase:
1. Dashboard > Auth > Logs
2. Select date range
3. Export to JSON
4. Save to backend/ directory
```

### Step 4: Sanitize Evidence

**⚠️ CRITICAL: Remove sensitive data before committing**

#### Redact from Screenshots
- [ ] Email addresses (use test@example.com)
- [ ] Phone numbers
- [ ] Full names (use "Test User")
- [ ] Access tokens
- [ ] API keys
- [ ] Session IDs

#### Redact from Logs
```bash
# Remove tokens from log files
sed -i 's/eyJhbGc[^"]*/[REDACTED_TOKEN]/g' backend/*.log

# Replace emails
sed -i 's/[a-zA-Z0-9._%+-]+@gmail\.com/test@example.com/g' backend/*.log

# Remove IP addresses
sed -i 's/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/192.168.1.XXX/g' backend/*.log
```

#### Sanitize HAR Files
```javascript
// Use HAR Sanitizer tool or manually edit JSON
{
  "request": {
    "headers": [
      // Remove these headers:
      {"name": "Authorization", "value": "REDACTED"},
      {"name": "Cookie", "value": "REDACTED"}
    ]
  }
}
```

### Step 5: Organize Files

```bash
# Move files to appropriate directories
mv oauth-success.png tests/evidence/functional/
mv browser-history.png tests/evidence/security/
mv chrome-test.mp4 tests/evidence/browsers/
mv build-log.txt tests/evidence/deployment/
```

### Step 6: Document Metadata

Create a metadata file alongside each evidence file:

**Example: `oauth-login-success.png.meta.yaml`**
```yaml
file: oauth-login-success.png
date: 2026-01-02
time: 10:30:45 UTC
tester: Dennis Muchai
environment: Production
url: https://property-manager-ke.vercel.app
browser: Chrome 121.0.6167
platform: Ubuntu 22.04
test_case: TC-AUTH-001
scenario: New user OAuth registration
result: PASS
duration: 15s
notes: User redirected to dashboard successfully
```

### Step 7: Update Documentation

Add evidence link to `OAUTH_PKCE_SECURITY_UPGRADE.md`:

```markdown
- [x] Google OAuth login works  
  **Evidence:** [`tests/evidence/functional/oauth-login-success.mp4`](#evidence-oauth-login) • Screen recording of full flow
```

### Step 8: Commit Evidence

```bash
# Stage evidence files
git add tests/evidence/

# Commit with descriptive message
git commit -m "docs: Add testing evidence for OAuth PKCE migration

- Functional test screenshots and videos
- Security test HAR files and logs
- Browser compatibility test results
- Backend validation logs
- Deployment verification artifacts

Evidence supports all checklist items in OAUTH_PKCE_SECURITY_UPGRADE.md"

# Push to remote
git push origin main
```

## 📊 Evidence Checklist

Use this checklist to ensure comprehensive coverage:

### Functional Evidence
- [ ] `oauth-login-success.mp4` - OAuth flow video
- [ ] `url-with-code.png` - Authorization code in URL
- [ ] `session-created.json` - Session API response
- [ ] `redirect-dashboard.mp4` - Redirect video
- [ ] `password-reset-flow.mp4` - Password reset flow
- [ ] `account-linking.png` - Account linking UI

### Security Evidence
- [ ] `url-clean.png` - No tokens in URL
- [ ] `browser-history-clean.png` - Clean browser history
- [ ] `cookies-inspection.png` - HttpOnly cookies
- [ ] `network-tab.har` - Network traffic capture
- [ ] `localStorage-empty.png` - Empty localStorage
- [ ] `sessionStorage-pkce-only.png` - PKCE verifier only
- [ ] `code-reuse-blocked.log` - Code replay blocked
- [ ] `replay-attack-test.mp4` - Replay attack video

### Browser Evidence
- [ ] `chrome-v121-success.png` - Chrome test
- [ ] `firefox-v122-success.png` - Firefox test
- [ ] `safari-v17-success.png` - Safari test
- [ ] `mobile-test-matrix.md` - Mobile results
- [ ] `incognito-mode-success.mp4` - Incognito test

### Backend Evidence
- [ ] `authorization-code-validation.log` - Code validation
- [ ] `password-reset-validation.log` - Reset validation
- [ ] `supabase-auth-events.json` - Auth events
- [ ] `recovery-token-audit.sql` - DB audit queries

### CI/CD Evidence
- [ ] `integration-test-output.log` - Jest results
- [ ] `e2e-test-report.html` - Playwright report
- [ ] `github-actions-workflow.log` - CI pipeline log

### Deployment Evidence
- [ ] `vercel-build-success.log` - Build output
- [ ] `health-check-200.png` - Health check
- [ ] `smoke-test-report.md` - Smoke tests
- [ ] `monitoring-dashboard.png` - Analytics

## 🔧 Troubleshooting

### Large Files
If evidence files are too large for Git:

```bash
# Upload to cloud storage
gdrive upload tests/evidence/functional/oauth-login.mp4

# Add download link in README
echo "[Download oauth-login.mp4](https://drive.google.com/...)" >> tests/evidence/functional/README.md

# Add to .gitignore
echo "tests/evidence/**/*.mp4" >> .gitignore
```

### Missing Evidence
If a test cannot be performed:

```markdown
- [ ] Safari iOS testing  
  **Evidence:** NOT AVAILABLE - No iOS device available
  **Mitigation:** Tested in Safari macOS + Mobile viewport simulation
```

### Failed Tests
If a test fails:

```markdown
- [x] Authorization code reuse test  
  **Evidence:** [`tests/evidence/security/code-reuse-FAILED.log`](#evidence-failed)
  **Status:** ❌ FAILED
  **Issue:** Code not properly consumed, can be reused
  **Action:** Fix required in `/api/auth.ts` line 234
```

## 📚 Tools & Resources

### Recommended Tools
- **Screenshot:** Flameshot (Linux), Snagit (macOS/Windows)
- **Screen Recording:** OBS Studio, SimpleScreenRecorder
- **HAR Editor:** Charles Proxy, Fiddler
- **Log Viewer:** Logsene, Papertrail
- **Video Compression:** HandBrake, FFmpeg

### Automation Scripts
```bash
# Auto-sanitize logs
./scripts/sanitize-logs.sh tests/evidence/backend/*.log

# Generate metadata files
./scripts/generate-metadata.sh tests/evidence/

# Compress videos
./scripts/compress-videos.sh tests/evidence/**/*.mp4

# Validate evidence completeness
./scripts/validate-evidence.sh
```

## 📞 Support

For help with evidence collection:
- **Documentation:** See directory-specific README files
- **Repository:** [Rent-Management-System](https://github.com/dmuchai/Rent-Management-System)
- **Main Doc:** `OAUTH_PKCE_SECURITY_UPGRADE.md`

---

**Last Updated:** January 2, 2026  
**Version:** 1.0  
**Author:** Dennis Muchai
