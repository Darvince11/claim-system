# Institutional decision register

These are unresolved institutional policies, not assertions about UPSA. Foundation development can proceed without most answers; dependent workflow/calculation features must fail clearly until required configuration is supplied.

| Decision | Needed by | Proposed handling pending confirmation |
| --- | --- | --- |
| Official hourly rates, currencies, lecturer categories and effective dates | Finance | No official seeded rates; prevent pricing when missing/ambiguous |
| Normal workload by lecturer type and authoritative workload source | Claim calculations | Versioned configurable rules; no global 12-hour assumption |
| Eligible overload allocation across courses/claims and different teaching weeks | Submission/calculations | Require full workload evidence and explicit allocation policy |
| Fractional weeks, holidays, date boundaries, maximum hours, team teaching | Claim validation | Configure calendar/input policies; reject unsupported ambiguity |
| Duplicate definition, class/section identifiers, cross-listed courses | Submission constraints | Confirm uniqueness/overlap domain before enforcing business key |
| Claim department for cross-department teaching and organizational transfers | Scope and submission | Proposed owning department snapshot; require confirmed routing policy |
| Pro VC office scope, delegation and acting HOD periods | Reviewer access | Explicit effective scope grants; no assumed institution-wide access |
| Multiple roles and conflict-of-interest/self-approval policy | Approvals | Proposed default denies self-approval |
| Resubmission after rejection, withdrawal after submission, deadlines | Workflow | Rejected states terminal and cancellation draft-only until enabled |
| Pro VC returns and required review path afterward | Workflow | Disabled pending confirmation; proposed return restarts HOD approval |
| Supporting-document requirements, formats, size and retention | Claim submission | Attachment feature requires a defined secure storage/access design |
| Tax, deductions, rounding, zero-value claims and finance amount overrides | Finance | No invented deductions or silent overrides; configuration required |
| Installments, partial payments, reversals, corrections and reconciliation | Finance | Proposed single settlement per claim; paid data immutable; separate adjustment policy required |
| Payment reference uniqueness, payment date rules and university integration | Finance | Record external payment evidence; no automatic transfer assumed |
| Official email delivery and access-reset delivery channel | Notifications/auth operations | In-app notifications first; configure secure production reset delivery |
| Historical workload import and account provisioning/SSO requirements | Foundation/rollout | Password-based design per brief; no unapproved identity integration |
| Branding assets, official report layouts and signatories | UI/reports | Neutral academic visual style; no invented official insignia |
| Personal/payment data retention, audit IP collection, export limits, backup objectives | Production readiness | Institution-approved operating policy required before live data rollout |

Record approved decisions with owner, date, effective period and implementation reference. Policy changes must be versioned so prior claims remain reproducible.
