# REST API plan

Base path: `/api/v1`. All routes require authentication unless explicitly listed as public. Every resource endpoint enforces the [RBAC policy](RBAC.md), record scope, and response field allowlists.

| Method and path | Purpose |
| --- | --- |
| POST /auth/login | Public, rate-limited email/staff-ID login |
| POST /auth/refresh | Rotate cookie refresh token with CSRF/origin controls |
| POST /auth/logout | Revoke session and clear cookies |
| GET /auth/me | Current identity and effective UI permissions |
| POST /auth/reset-password | Consume single-use access reset token |
| GET, PATCH /profile | Own allowlisted profile fields |
| POST /profile/change-password | Verify current password; revoke other sessions |
| GET, POST /users | Search/paginate or create users |
| GET, PATCH /users/:id | View/update account, including activation |
| PUT /users/:id/roles | Assign authorized roles and scopes |
| POST /users/:id/reset-access | Issue audited, expiring access reset |
| GET /roles | List the six supported system roles |
| GET /permissions | Read executable permission catalog |
| PUT /roles/:id/permissions | Update permitted role grants |
| GET /catalog | Authorized academic options for forms |
| GET, POST /configuration/:resource | List/create supported academic, workload, and rate resources |
| GET, PATCH /configuration/:resource/:id | Detail, controlled update/versioning and deactivation |
| GET, PATCH /settings | Allowlisted typed settings |
| GET /dashboards/:role | Scoped live dashboard aggregates |
| GET, POST /claims | Filter own/authorized claims or create draft |
| GET, PATCH /claims/:id | Scoped detail or editable draft fields/items |
| POST /claims/:id/preview | Calculate validated draft inputs without workflow change |
| POST /claims/:id/submit | Submit/resubmit with version and idempotency key |
| POST /claims/:id/cancel | Cancel permitted draft |
| GET /claims/:id/history | Scoped status/revision/decision history |
| POST /claims/:id/hod/approve, /hod/reject | HOD decision |
| POST /claims/:id/provc/approve, /provc/reject | Pro VC decision |
| POST /claims/:id/return | Stage-specific return governed by policy |
| POST /claims/:id/finance/start | Begin processing final-approved claim |
| GET /payments | Scoped, paginated finance/payment records |
| POST /payments | Create calculated payment for FINANCE_PROCESSING claim |
| GET, PATCH /payments/:id | View or edit permitted pre-finalization metadata |
| POST /payments/:id/pending | Validate payment and move claim/payment to pending |
| POST /payments/:id/complete | Record payment reference/date and finalize atomically |
| GET /reports/:type | Own, department, finance, audit, system reports |
| POST /reports/:type/exports | Request scoped CSV/PDF generation |
| GET /reports/exports/:id | Export state and authorized download access |
| GET /notifications | Current recipient's paginated notifications |
| PATCH /notifications/:id/read | Mark own notification read |
| POST /notifications/read-all | Mark own notifications read |
| GET /audit-logs, /audit-logs/:id | Authorized audit search/detail |

Comma-separated paths expand to individual endpoints. For academic/configuration resources, retain the existing `/configuration/:resource` and `/configuration/:resource/:id` namespace instead of adding duplicate top-level CRUD routes; supported resource names are faculties, departments, courses, academic-years, semesters, workload-rules, lecturer-workloads, and payment-rates. Add scoped detail reads there. `/catalog` supplies authorized form options. HOD coverage is managed through effective user role/scope assignments, without a second independently mutable assignment endpoint. Fixed report paths are registered before dynamic type paths. Administrative deactivation uses PATCH; hard deletion of historical records is not exposed. See [Implementation readiness](IMPLEMENTATION_READINESS.md) for the implementation contract and delivery gates.

## Contracts

- Success: `{ data, meta? }`; paginated meta includes page, pageSize, total (or a cursor for large event feeds).
- Error: `{ error: { code, message, fieldErrors?, requestId } }`; no stack traces or raw ORM exceptions.
- List query parameters: allowlisted search, filters, sort, page and pageSize, with a server-enforced maximum. Date bounds are explicit; sorting includes an ID tie-breaker.
- Mutations use `expectedVersion`; workflow and payment actions accept `Idempotency-Key`. Unknown fields are rejected to prevent mass assignment.
- Claim creation takes semester, claim type and course teaching inputs. Owner, status, totals and scope are server-derived.
- Monetary fields are decimal strings; timestamps are ISO 8601; teaching/payment dates use YYYY-MM-DD.
- HTTP 200/201/204 for success, 400 for malformed requests, 401 unauthenticated, 403 forbidden operation, 404 absent/out-of-scope resource, 409 concurrency/duplicate conflict, 422 business validation, 429 throttling, 500 redacted unexpected failure.
- CSV/PDF exports use the same query scopes and redaction as the report. Downloads revalidate access and expire.

OpenAPI documentation and generated/validated public contracts are implementation deliverables; this plan is not a claim that endpoints exist.
