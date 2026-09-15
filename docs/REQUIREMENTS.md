# Requirements and acceptance criteria

## Scope

Deliver a persistent, functioning application for six roles: Administrator, Lecturer, HOD, Pro VC, Finance Officer, and Auditor. Every displayed action must work, and dashboard values must come from authorized backend queries.

| Capability | Required behavior | Acceptance evidence |
| --- | --- | --- |
| Authentication | Email or staff ID, hashed password, revocable sessions | Login, logout, refresh rotation, disabled-account tests |
| Administration | Users, roles, permissions, organizational and academic records | Authorized CRUD; deactivation preserves history |
| Claims | Multiple courses, dates, weekly hours, weeks, remarks, drafts, review, submission | Server recalculation; draft editing; submission locks content |
| Workloads | Configurable expected workload and part-time eligibility | Unit-consistent, reproducible calculation tests |
| HOD review | Department queue, approve, reject with reason, return with comment | Cross-department API attempts fail |
| Pro VC review | Final review following HOD approval | Stage bypass fails; office scope enforced |
| Finance | Approved claims, payable amount, references, dates, notes, pending/paid | Duplicate payment and post-payment edits rejected |
| Audit | Attributable history of sensitive actions | Append-only records and authorization tests |
| Notifications | Recipient-specific read/unread messages linked to claims | Transactional delivery and isolated recipient access |
| Reporting | Own, department, finance, audit reports with CSV/PDF | Filters and exports enforce the same scopes as lists |
| UI | Responsive professional university interface | Keyboard, mobile, loading, empty, error and conflict checks |
| Operations | Migrations, seeds, environment template, Docker, builds | Clean setup and persistence after restart verified |

## Cross-cutting invariants

- Backend identity determines record scope; client lecturer/department IDs cannot grant access.
- Workflow actions require permission, scope, correct current state, and record version.
- Monetary values use decimal arithmetic and explicit currency/rounding policy.
- Claim submission, decisions, payment changes, audit records, and notification outbox records commit together.
- No invented official rates, normal workloads, deduction policies, or payment integrations.
- Financial and audit history must survive deactivation of related configuration and users.
- Lists, details, summaries, exports, and linked resources all apply authorization.

## Source coverage

The original prompt remains the detailed source of requirements. Its sections 1–3 and 19–23 inform architecture/data/security; 4–18 and 24–28 inform roles, workflow, API and UI; 29–36 inform testing, delivery gates, policy decisions, and completion criteria.

## Definition of done

The full lecturer → HOD → Pro VC → Finance → paid lifecycle passes against persistent storage. Reports, notifications, audit trails, role restrictions, direct API denial cases, concurrency safeguards, migrations, production builds, responsive UI, and verified setup documentation must also pass. Critical and high-severity defects block completion.
