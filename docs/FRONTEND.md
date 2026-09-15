# Frontend page and route map

Use React Router, a typed API client, CSS/CSS Modules, Lucide icons and accessible reusable controls. Desktop uses sidebar, header and content; mobile uses keyboard-accessible collapsible navigation. Use restrained white/neutral surfaces and approved UPSA branding when supplied.

| Routes | Pages and actions | Audience |
| --- | --- | --- |
| /login, /reset-password | Authentication and access recovery | Public/token holder |
| / | Redirect to authorized dashboard or role chooser | Authenticated |
| /lecturer/dashboard | Current period, claim totals, recent claims, notifications, create action | Lecturer |
| /lecturer/claims | My Claims with search/filter/pagination | Lecturer |
| /lecturer/claims/new | Academic information, multi-course teaching form, calculation preview, save/review/submit | Lecturer |
| /lecturer/claims/:id/edit | Draft/returned correction editor | Owner |
| /lecturer/claims/:id | Status, course details, timeline, payment summary | Owner |
| /lecturer/history | Historical claims and approval/payment history | Lecturer |
| /hod/dashboard, /hod/claims | Department statistics and review queue | HOD |
| /hod/claims/:id | Lecturer/workload/course review, approve/reject/return | Scoped HOD |
| /provc/dashboard, /provc/claims | Final approval summaries and queue | Pro VC |
| /provc/claims/:id | Complete history and final decision | Scoped Pro VC |
| /finance/dashboard, /finance/claims | Approved, processing, pending and paid summaries/queue | Finance |
| /finance/claims/:id | Approval evidence, calculation, processing action | Finance |
| /finance/payments, /finance/payments/:id | Payment metadata, reference/date, pending/completion actions | Finance |
| /audit/dashboard, /audit/logs, /audit/logs/:id | Activity metrics, audit search and detail | Auditor/authorized Admin |
| /audit/claims/:id | Read-only claim/approval/payment evidence | Scoped Auditor |
| /admin/dashboard | Authorized system totals and configuration access | Admin |
| /admin/users, /admin/users/new, /admin/users/:id | User create/edit/activation/reset/role assignment | Users manager |
| /admin/roles, /admin/roles/:id | Six system roles, controlled permission editing; user scope assignment through user administration | Roles manager |
| /admin/faculties, /admin/departments, /admin/courses | Configuration lists, create/edit forms and deactivation | Relevant manager |
| /admin/academic-years, /admin/semesters | Academic periods | Academic manager |
| /admin/workloads | Rules and lecturer teaching assignments | Workload manager |
| /admin/payment-rates | Versioned effective payment rules | Rates manager |
| /admin/settings | Allowed institutional/system configuration | Settings manager |
| /reports/own, /reports/department, /reports/finance, /reports/audit, /reports/system | Filtered reports with CSV/PDF exports | Matching permission and scope |
| /notifications | Read/unread list with authorized claim links | All authenticated roles |
| /profile | Own profile/password settings | All authenticated roles |
| /forbidden, /* | Access denied and not found | All |

Configuration list pages can contain accessible create/edit dialogs instead of extra routes. All claim links resolve to the role-appropriate authorized detail view. Multi-role users can switch workspaces without changing server permissions.

## Interaction requirements

- Shared status labels map exactly to workflow states. Dashboard aggregate definitions are documented in the API and do not double-count historical milestones as current claims.
- Forms show labels, inline validation and server errors, support add/remove course items, and preserve unsaved input after recoverable failures.
- Submitted claims show read-only content unless returned. Rejection/return dialogs require a reason/comment before submission.
- Finance shows missing rate/policy information clearly and blocks unsupported processing.
- Destructive or consequential actions require an accessible confirmation dialog; loading prevents accidental repeat clicks but server idempotency remains authoritative.
- Tables use server-side search, filters and pagination. Include loading, empty, error and retry states.
- Conflict responses explain that the record changed and require reloading/reviewing before another decision.
- Keyboard navigation, focus restoration, semantic headings, accessible dialogs, visible focus, and text-backed status colors are required.
- No static statistics, fake buttons, placeholder pages, or secret/debug details in product flows.
