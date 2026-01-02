# Testing Evidence Directory

This directory contains all testing artifacts and evidence for the **PKCE OAuth Security Upgrade** and ongoing authentication testing.

## Purpose

- **Audit Trail:** Maintain verifiable proof of security testing completion
- **Compliance:** Support security audits and compliance reviews
- **Documentation:** Reference materials for security analysis
- **Troubleshooting:** Historical data for debugging authentication issues

## Directory Structure

```
tests/evidence/
├── functional/     # Functional testing evidence (OAuth flows, user journeys)
├── security/       # Security testing evidence (token protection, replay attacks)
├── browsers/       # Cross-browser compatibility test results
├── ci/             # CI/CD pipeline and automated test outputs
├── backend/        # Backend logs, database traces, API validation
└── deployment/     # Deployment verification and production monitoring
```

## Evidence Requirements

Each test checklist item in `OAUTH_PKCE_SECURITY_UPGRADE.md` requires:

1. **Artifact File:** Screenshot, video, log file, or HAR capture
2. **File Name:** Descriptive name matching documentation reference
3. **Metadata:** Date, tester, environment, browser/platform
4. **Link:** Anchor link from documentation to evidence file

## File Naming Conventions

- **Screenshots:** `feature-action-result.png` (e.g., `oauth-login-success.png`)
- **Videos:** `feature-flow.mp4` (e.g., `password-reset-flow.mp4`)
- **Logs:** `component-event-type.log` (e.g., `authorization-code-validation.log`)
- **Reports:** `browser-version-type.pdf` (e.g., `chrome-v121-test-report.pdf`)
- **HAR Files:** `component-action.har` (e.g., `network-tab-oauth-flow.har`)

## Retention Policy

| Evidence Type | Retention Period | Storage Location |
|---------------|------------------|------------------|
| Screenshots/Videos | 90 days | Local + Cloud backup |
| Log files | 1 year | Local + Cloud archive |
| Test reports | Indefinitely | Git version control |
| CI/CD artifacts | 30 days | GitHub Actions |

## Security Considerations

- **No PII:** Redact personal information from screenshots/logs
- **No Secrets:** Never commit access tokens, API keys, or passwords
- **Sanitized URLs:** Blur or redact sensitive URL parameters
- **Access Control:** Limit cloud storage access to security team

## How to Add Evidence

1. **Capture Artifact:** Take screenshot, record video, export log
2. **Name File:** Follow naming convention above
3. **Save to Directory:** Place in appropriate subdirectory
4. **Update Documentation:** Add anchor link in `OAUTH_PKCE_SECURITY_UPGRADE.md`
5. **Commit to Git:** Include evidence in pull request (if not too large)
6. **Cloud Backup:** Upload large files (videos) to Google Drive

## Evidence Checklist Template

```markdown
- [x] Test item description
  **Evidence:** [`tests/evidence/category/filename.ext`](#anchor-link) • Brief description
```

## Contact

For questions about testing evidence:
- **Security Lead:** Dennis Muchai
- **Repository:** [Rent-Management-System](https://github.com/dmuchai/Rent-Management-System)
- **Documentation:** See `OAUTH_PKCE_SECURITY_UPGRADE.md`

---

**Last Updated:** January 2, 2026  
**Version:** 1.0
