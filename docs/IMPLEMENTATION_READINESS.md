# Implementation readiness

Prepared 2026-09-09 from repository inspection and updated after the foundation and lecturer-claims increments. This document resolves implementation planning gaps; it does not approve university policy. The master requirements define product scope. This document records technical decisions for implementation where earlier plans differ.

## Current implementation status

Stages 1-6 plus scoped audit browsing and summary reports are now substantially implemented for local development: migrations, auth/session hardening, protected workspaces, core administration, profile/password settings, notification inbox, explicit claim policy settings, lecturer workload configuration, lecturer drafts, submission validation, immutable submitted snapshots, claim coverage protection, history ordering, HOD approve/return/reject decisions, Pro VC final approve/reject decisions, finance processing, configured-rate payment calculation, payment completion evidence, audit/outbox writes, scoped audit-log search, scoped report totals, and in-app delivery for submitted claim notifications. Automated coverage includes unit, integration, browser, migration, and production build checks.

The next implementation start point is durable report exports, with dedicated reviewer/finance queues as interface polish. Continue to keep institution-dependent settings explicit. Missing approved policy, workload evidence, rates, or office scope must block progression with business validation errors rather than fabricated defaults.

## Observed baseline

| Area | Evidence | Remaining work |
| --- | --- | --- |
| Public frontend | Landing, Login, ResetPassword and auth provider | Protected shell, every role workspace, shared error routes |
| Authentication | Login, refresh rotation, logout, reset consumption, identity loading | Verify lifecycle, concurrency, byte-length validation, profile endpoints, reset delivery procedure |
| Administration | Users, roles, scopes, academic configuration APIs | Interfaces, detail reads, controlled delegation, effective scopes, typed settings, concurrency checks |
| Persistence | Prisma models and development seeds | Migration history, SQL integrity constraints, missing durable event/export models, clean setup |
| Claims and finance | Models and scope helpers | Domain policies, services, endpoints, UI, transactional decisions and calculations |
| Audit | Transaction-compatible insertion helper | Complete event coverage, request context, scoped reads, restricted database privileges |
| Reports and notifications | Notification model and unused frontend download helper | APIs, worker, durable jobs, interfaces, scope enforcement |
| Verification and operations | Package scripts, Vitest config, local PostgreSQL helper | Test files, CI, Docker, production routing, backup/restore exercise |

The login redirect currently targets unregistered dashboard routes. README status was stale. No migrations or test files were found. npm was unavailable in the assessment shell, so typecheck, lint, test, and build attempts did not run. Existing code is a starting point, not acceptance evidence.

## Technical decisions

1. Keep React/Vite, NestJS, PostgreSQL/Prisma, traditional CSS, Lucide, and the modular monolith. Keep existing auth/admin services while adding domain modules for claims, finance, reporting, notifications, and audit.
2. Make `/` an authenticated dashboard/role chooser entry, sending anonymous visitors to login. Move the existing public landing page to `/about` if retained. Add protected routes, explicit forbidden/not-found states, and session-loading handling before dashboards.
3. Support the six named system roles initially. Retain editable permission grants with a server-owned delegation allowlist; role management cannot authorize arbitrary self-escalation. Custom role creation is deferred because routing and scope semantics currently depend on the six role codes. Workspace switching affects presentation, never server authority.
4. Retain `/configuration/:resource` CRUD, `/catalog`, `/users`, and `/roles`. Implement missing detail reads and use the API plan for new feature routes. Use one typed public contract for each endpoint; field validation errors must reach the appropriate form fields.
5. Retain bcrypt with consistent UTF-8 input bounds and benchmarked cost. Test refresh replay, parallel refresh, logout, expired sessions, inactive accounts, and live permission changes. Profile editing initially permits only display name/title; staff identity, employment category, department, and roles require administration.
6. Preserve revision snapshots and claim department/faculty ownership at submission. Current user/course records cannot rewrite historical evidence. Snapshot employment classification, teaching assignments, rule versions, labels, reviewer decisions, and calculation inputs.
7. Add effective dates and role references to scope grants. Use these grants as the authoritative source for HOD and other reviewer coverage; do not maintain a competing HOD-assignment table. Expand approved faculty scope to explicit departments initially. No implicit institution-wide access.
8. Keep lecturer employment/profile fields on User initially. A separate profile table is unnecessary until independent lifecycle requirements arise. The logical ERD's profile relationship is represented by these fields.
9. Keep claim actions explicit. Conditional version/state updates, approvals, immutable revisions, history, audit, and outbox writes must commit together. Scope predicates apply before reads or mutation. A role alone never authorizes a workflow transition.
10. Use durable idempotency for consequential actions: bind actor, operation, target, key, and request hash. Reuse the same client key when retrying the same intended action; reject a changed payload with that key. The current helper generating a fresh key per request must be replaced for these actions.
11. Implement outbox events and a worker before first claim submission. Use leases, bounded retries, backoff, recipient/event uniqueness, and failed-job visibility. In-app delivery is required; email is an optional later adapter.
12. Implement the planned export-job API, replacing the unused direct-download helper. Persist report type, validated filters, requester, expiry, and protected artifact location. Reauthorize generation and download; regenerate or deny if authorization changed. Never expose a reusable public artifact URL.
13. Record external payment evidence only. Initial settlement supports one payment per claim; partial payments, reversals, deductions, overrides, and bank transfer integration remain unavailable until defined. A payment-adjustment table is deferred with that workflow.
14. Use same-origin production frontend/API routing, a private database, a separate migration role, and restricted application/worker roles. Container networking must replace the current loopback-only API bind in deployment configuration. Health and database readiness are distinct checks.

## Database and authorization work before claims

- Add migration-backed date, numeric range, enum/state, and paid-reference/date constraints; align decimal input precision with database bounds.
- Add outbox and report-export entities, job leases/retries, and idempotency expiry metadata. Preserve deduplication evidence long enough to prevent replay after cleanup.
- Add effective scope grants, immutable policy versions, explicit submission ownership snapshots, and payment-to-approved-revision linkage.
- Model teaching coverage using assignment/section identifiers and actual teaching intervals after policy confirmation. Current course-only uniqueness cannot represent every class/section arrangement and must not become the final duplicate rule by accident.
- Enforce nonambiguous rule/rate applicability transactionally, including concurrent configuration writes. Add effective rate dates and define boundary handling before supporting mid-period changes.
- Restrict audit/revision update/delete privileges and record request IDs. Redact tokens, passwords, and unnecessary personal data from snapshots and events.
- Separate scope checks for claims, reports, audit records, and administration. The current claim scope helper is only a starting point: Pro VC visibility must require eligible approval history, and report scopes must follow the corresponding office grants.

## Workspace and interaction contract

Use a compact desktop sidebar/header, responsive mobile navigation, white/neutral content surfaces, restrained brand accents, and visible status labels. Reuse existing images only where relevant; operational screens prioritize records and actions. Avoid decorative dashboard filler.

| Workspace | Required working experience |
| --- | --- |
| Lecturer | Dashboard, searchable claims, multi-course draft editor, review-before-submit, returned corrections, timeline, payment visibility, own reports |
| HOD | Department queue, workload evidence, current revision review, approve/reject/return, decision history |
| Pro VC | Scoped final queue, HOD evidence on current revision, final decision and history |
| Finance | Approved queue, eligibility/rate breakdown, processing/pending/paid actions, reference/date entry, payment reports |
| Auditor | Scoped activity search, claim/payment evidence, redacted audit detail, exports; no workflow mutation |
| Administrator | User lifecycle, role/scope assignment, academic records, workload/rate versions, typed policy settings, configuration readiness |
| Shared | Profile, password change, notifications, role switching, access denied, not found, session expired |

Every list needs bounded server pagination, filter persistence, deterministic sorting, loading/empty/error/retry states, and scoped counts. Every form needs labels, field errors, pending state, unsaved-change protection, and preservation of input after recoverable failures. Consequential actions need review/confirmation; stale-version conflicts require refreshed evidence before retry. Dialogs restore focus, controls work by keyboard, and statuses never depend on color alone.

Dashboard totals count current claims once, not historical milestones. Lecturer pending includes active HOD/Pro VC review, final-approved, processing, and payment-pending states; returned and rejected are separate. Financial totals are grouped by currency and distinguish unpriced claims from zero-value amounts. Reviewer queue counts include only actions currently available to that reviewer.

## University policy gates

Technical implementation can proceed without pretending these decisions are approved. Record owner, decision date, effective period, and version for each in OPEN_QUESTIONS.md. The following are proposed responsible offices, not confirmed assignments.

| Gate | Input needed | Proposed owner | Behavior while absent |
| --- | --- | --- | --- |
| Claim eligibility | Categories, normal workload, complete workload source, overload allocation, part-time eligibility | Academic Affairs/HR | Permit drafts; block unsupported submission with specific missing configuration |
| Teaching coverage | Calendar/weeks, holidays, section IDs, overlaps, team teaching, cross-department routing | Academic Affairs | Block ambiguous teaching coverage; no invented duplicate key |
| Approvals | Office coverage, acting periods, conflicts of interest, deadlines, returns/rejection resubmission | Academic leadership | Explicit scopes; deny self-approval; rejected terminal; Pro VC return disabled |
| Finance | Official rates/effective dates, currency, rounding, zero-value policy, reference/date rules | Finance | Show unpriced status; block payment progression |
| Evidence | Attachment requirement, permitted formats, limits, storage and retention | Academic Affairs/IT | No upload control; block affected submission if mandatory evidence is configured but unsupported |
| Recovery and delivery | Account provisioning, verified reset delivery, optional email provider | IT | Development-only reset testing; live recovery requires an approved procedure |
| Live operations | Hosting, TLS, retention, backup/recovery objectives, support ownership, branding/report approval | IT and designated university owners | Local/test use; no live-data readiness claim |

Any synthetic calculation fixtures must be isolated to tests or explicitly labeled development configuration. They never seed official university rates. Missing policy is a business validation response, not a fabricated successful result.

## Ordered implementation and exit gates

| Stage | Deliverable | Evidence required before moving on |
| --- | --- | --- |
| 1. Reproducible foundation | Runtime setup, environment validation, migrations, seeds, corrected auth/admin contracts, audit/outbox primitives | Implemented for local development; fresh isolated DB, login/refresh/logout/reset, permissions and constraints tested; typecheck/lint/build pass |
| 2. Usable workspace | Protected shell, six role entries, profile, core administration, effective scope/configuration screens | Implemented for local development; redirects, role access, session restoration, profile, administration, responsive browser checks covered |
| 3. Lecturer claims | Drafts/items, coverage/calculation policies, snapshots, submit/history/cancel | Implemented for local development; calculation boundaries, missing-policy blocks, ownership denial, duplicate coverage, immutable snapshots, notification delivery, full-time overload, and browser draft flow tested |
| 4. Review workflow | HOD and Pro VC queues/actions with current-revision evidence | Core HOD and Pro VC actions implemented through claim detail; dedicated reviewer queues remain |
| 5. Finance | Versioned rates, payment calculation and settlement | Core processing, pending calculation, and paid evidence implemented through claim detail; dedicated finance queue and reconciliation reports remain |
| 6. Visibility | Notification inbox, audit search, reports, durable CSV/PDF exports | Notification inbox, scoped audit search, and summary reports implemented; durable exports remain |
| 7. Release preparation | CI, Docker, production configuration, operational docs, accessibility/performance review | Full browser lifecycle, negative API tests, migration upgrade, restart persistence, backup restore, mobile checks, no high/critical defects |

Keep tests under the root tests tree to match existing tooling: domain tests, isolated PostgreSQL integration tests, and Playwright e2e tests with separate runners. CI must run generated-client setup, typecheck, lint, relevant tests, and production builds. Tests must never target a live database. Record actual commands and outcomes; a blocked check remains blocked.

The first coding task is Stage 1, not additional public-page styling. Completion means a lecturer's valid configured claim reaches recorded payment through authorized reviews, with consistent reports, notifications, and audit evidence after a restart. A usable local build and an institution-approved live deployment are separate milestones.
