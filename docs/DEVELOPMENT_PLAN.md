# Incremental development plan

## Phase 1 - Requirements and architecture

Deliver requirements, architecture/folders, logical schema/ERD, RBAC, workflow, API plan, page map, phase gates and policy questions. Status: documentation prepared; foundation, workspace, lecturer-claims, HOD review, Pro VC final review, core finance/payment actions, scoped audit browsing, and summary reports are implemented for local development. Resume with durable exports, using the baseline and technical decisions in [Implementation readiness](IMPLEMENTATION_READINESS.md). Institution-dependent behavior remains explicitly blocked or configurable.

| Phase | Deliverables | Exit gate |
| --- | --- | --- |
| 2 - Foundation | Workspace, React/NestJS, PostgreSQL/Prisma, migrations, auth, sessions, RBAC, core admin records, audit/outbox primitives, environment template, development seeds | Done locally; fresh DB setup, login/refresh/revoke, direct API permission/scope tests, constraints |
| 3 - Lecturer claims | Dashboards, drafts/items, calculations, submission, revisions/history/cancellation | Done locally; create/edit/submit-block/cancel persists; invalid dates/hours, missing policy, missing workload evidence, duplicate coverage, and full-time overload boundaries rejected or calculated |
| 4 - HOD | Department queues, review, approve/reject/return | Core action done locally through claim detail; dedicated queue remains |
| 5 - Pro VC | Office scopes, final queue and decisions | Core action done locally through claim detail; dedicated queue remains |
| 6 - Finance | Effective rates, decimal calculations, payment record and finalization | Core action done locally through claim detail; dedicated queue and reconciliation reports remain |
| 7 - Audit and notifications | Audit dashboard/search; expanded notification delivery | Scoped audit search and notification delivery done locally; expanded dashboards remain |
| 8 - Reports | Role-scoped queries and CSV/PDF exports | Scoped summary reports done locally; durable CSV/PDF exports remain |
| 9 - Administration | Complete remaining user/role/scope/configuration interfaces | Grant restrictions, deactivation behavior, versioned policy changes |
| 10 - Hardening | Security/accessibility/responsive/error/performance review, Docker and operational setup | Findings resolved; query/index and backup/restore review |
| 11 - Final testing | Full lifecycle, each role, negative API cases, production build and documentation | Definition of done met; no known critical/high defects |

## Gate after each implementation phase

Run relevant automated tests, type checking, linting and production builds. Apply migrations against a clean test database and test an upgrade where migrations changed. Verify permissions and the relevant workflow through API/integration tests. Fix critical errors before proceeding; record actual commands and outcomes, including anything blocked by missing infrastructure.

Do not report tests, migrations, or builds as passing merely because documentation exists. Documentation-only phases use document/link/consistency review; implementation phases require executable evidence.

## Critical test scenarios

- Lecturer login -> create -> submit -> HOD approve -> Pro VC approve -> Finance process -> pending -> paid -> lecturer sees payment -> report and audit reconcile.
- Different lecturer/HOD direct API and export access denied; role combinations do not enable self-approval by default.
- Returned content resubmitted as a new revision invalidates prior approval eligibility.
- Parallel reviewers: one transition succeeds, second gets conflict. Repeated payment request creates no duplicate financial record.
- Missing/ambiguous rates and workloads block unsupported actions. Decimal calculations cover rounding boundaries and zero overload.
- Session rotation replay, logout, disabled accounts, role revocation, and expired reset tokens are enforced.
- Persistence survives service restart; development seeds cannot silently populate production credentials or official rates.
