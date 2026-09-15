# Security, testing, and operations

## Authentication and authorization design

Retain the existing bcrypt implementation, permitted by the master requirements, and benchmark its cost during implementation. Validate password length in UTF-8 bytes to reject values beyond bcrypt's 72-byte input limit rather than silently truncating them; apply the same rule to provisioning, changes, and resets. Short-lived access tokens are held in browser memory; rotating refresh tokens use Secure, HttpOnly cookies with an appropriate SameSite policy. Store only refresh-token hashes, revoke token families on reuse, and revoke sessions when accounts are disabled or access is reset. Check active session/account/permissions server-side so revocations do not depend solely on access-token expiry.

Use same-origin deployment where possible, allowlisted CORS if needed, origin/CSRF protection for cookie-authenticated routes, request throttling and login brute-force protection. Reset tokens are random, hashed, short-lived and single-use. Never expose password hashes, tokens or reset secrets in logs/responses beyond the intended secure delivery flow.

Validate DTOs strictly; reject unknown mutable fields. Use parameterized Prisma queries, secure headers and a content-security policy compatible with the UI. Redact error responses and log correlation IDs. Scope authorization protects list/detail/export/aggregate endpoints against IDOR/BOLA.

## Audit and asynchronous work

Audit changes in the same database transaction as business actions. Capture actor, effective role, action, entity, timestamp, redacted before/after values, reason and request ID. Log relevant authentication failures without passwords or raw tokens. Protect audit tables using restricted runtime privileges; production administrators need a controlled, separately audited maintenance process.

Persist outbox events with claim/payment mutations. A worker retries with backoff and deduplicates notifications by event and recipient. Notification links are reauthorized when opened. Email is optional and requires configured delivery infrastructure. Export workers re-evaluate scope and protect generated files with authorization and expiry.

## Testing strategy

Unit tests cover decimal teaching/payable/overload arithmetic, permission scopes, rate selection, and every permitted/denied state transition. Integration tests use a real isolated PostgreSQL database for constraints, transactions, authentication, revisions, concurrency, audit insertion and payment uniqueness. Browser end-to-end tests exercise the full lifecycle and meaningful denial/error cases.

Verify semantic HTML, keyboard/focus behavior, dialog announcements, contrast and mobile layouts. Performance checks use realistic datasets, bounded pagination and actual query plans. CSV exports neutralize formula injection; PDF generation escapes untrusted content and disallows arbitrary network resource fetching.

## Development and deployment deliverables

- Validated `.env.example` documenting database URL, API/web origins, authentication configuration, optional mail settings and environment mode; no real secrets.
- Docker configuration for web/API/worker/PostgreSQL development; production configuration includes health/readiness checks, persistent storage, TLS ingress and graceful shutdown.
- Separate migration job and restricted runtime database role. Test migrations on a fresh database and an upgrade copy before release.
- Development seeds create six example roles/users plus faculty, department, courses and academic period. Credentials are supplied securely through development configuration, never hardcoded. No official payment rates are invented.
- Structured redacted logs, request IDs, error/latency metrics, failed outbox/export alerts, and database connection limits.
- Backup schedule, restore exercise, recovery objectives and retention approved before live deployment.
- Secrets managed outside source control; environment validation fails startup when required values are missing.
- README gains verified install, migration, seed, start, test, build, Docker and deployment commands when those files exist.

Security controls described here are planned requirements. No operational system or security certification is implied by this documentation.
