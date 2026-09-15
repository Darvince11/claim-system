# Permissions and record scope

Roles group permissions. Each request also needs an authorized resource scope and workflow preconditions. Permission changes take effect through server-side checks and session/cache invalidation. Multiple roles combine explicit grants; there is no implicit administrator bypass.

Legend: O = own records, D = assigned departments, S = explicitly configured office scope, F = finance-necessary data, A = audit scope, M = administrative function, — = no default grant.

| Permission | Lecturer | HOD | Pro VC | Finance | Auditor | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| claims.create/edit_draft/submit/cancel_own | O | — | — | — | — | — |
| claims.view_own | O | — | — | — | — | — |
| claims.view_department | — | D | — | — | — | — |
| claims.view_provc_scope | — | — | S | — | — | — |
| claims.approve_hod | — | D | — | — | — | — |
| claims.approve_provc | — | — | S | — | — | — |
| claims.reject | — | D | S | — | — | — |
| claims.return | — | D | S* | — | — | — |
| claims.view_finance | — | — | — | F | — | — |
| payments.view | O | — | — | F | A | — |
| payments.process | — | — | — | F | — | — |
| reports.view_own | O | — | — | — | — | — |
| reports.view_department | — | D | S | — | — | — |
| reports.view_finance | — | — | — | F | — | — |
| audit.view/reports.view_audit | — | — | — | — | A | M |
| reports.view_system | — | — | — | — | — | M |
| users.manage/roles.manage | — | — | — | — | — | M |
| faculties.manage/departments.manage/courses.manage | — | — | — | — | — | M |
| academic_periods.manage/workloads.manage/rates.manage/settings.manage | — | — | — | — | — | M |
| notifications.manage_own/profile.manage_own | O | O | O | O | O | O |

Each slash-separated entry represents separate permission codes. `S*` requires explicit institutional authorization for Pro VC returns and is disabled until configured. Auditor access to claims is through `claims.view_audit`, granted within A scope. Reports/export rights never imply mutation rights. `reports.export` is additionally required for CSV/PDF exports and granted only for authorized report categories.

## Enforcement

- Authentication guard identifies an active account and valid session.
- Permission guard checks the operation; scope policy applies an unavoidable database predicate.
- Lecturer ownership comes from identity; draft creation derives lecturer and department server-side.
- HOD department assignments must be current and explicitly granted; Pro VC scope must be configured.
- Finance receives only the identity, teaching, approval and payment fields needed for processing. Pending unapproved claims are excluded.
- Audit and administrator responses redact authentication secrets and unnecessary personal/payment data.
- Claim items, history, payments, dashboard counts, notifications, and downloads inherit applicable parent scope.
- Guessed record IDs outside scope return 404; known forbidden operation categories return 403.
- Users cannot grant permissions they are not authorized to delegate. Role management is audited and protects against accidental removal of the last active administrative operator.
- Proposed safeguard: reviewers cannot approve their own claims even with multiple roles. Confirm the university's delegation and conflict-of-interest policy before rollout.
