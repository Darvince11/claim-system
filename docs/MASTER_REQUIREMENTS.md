# MASTER DEVELOPMENT PROMPT

## UPSA Lecturer Claim Management System

You are acting as a senior software architect, senior full-stack engineer, database architect, security engineer, QA engineer, and UI/UX engineer.

Your task is to design and build a complete, production-quality **Lecturer Claim Management System** for the University of Professional Studies, Accra (UPSA).

This is not a prototype or a static dashboard.

Build a complete working application with:

* Frontend
* Backend
* Database
* Authentication
* Role-Based Access Control (RBAC)
* Claim workflow
* Claim calculations
* Approval/rejection workflow
* Finance/payment processing
* Audit trail
* Reporting
* Notifications
* Administrative configuration
* Validation
* Security controls
* Responsive UI
* Error handling
* Testing
* Documentation
* Deployment configuration

Do not create fake buttons, placeholder pages, or UI elements without functionality.

Every feature visible in the interface must be connected to the backend and database where applicable.

---

# 1. SYSTEM PURPOSE

The system must automate the lecturer teaching-claim lifecycle.

The primary process is:

Lecturer submits claim
→ HOD verifies claim
→ Pro VC performs final approval
→ Finance processes approved claim
→ Payment is recorded as completed

The system must improve:

* Accuracy
* Transparency
* Accountability
* Claim processing speed
* Auditability
* Access control
* Reporting

The system must reduce dependency on manual paperwork.

---

# 2. TECHNOLOGY STACK

Unless an existing project imposes different requirements, use:

## Frontend

* React
* TypeScript
* Vite
* React Router
* Traditional CSS/CSS Modules or a well-organized global CSS architecture
* Lucide React icons
* Axios or a typed API service layer

Do NOT use Tailwind CSS unless explicitly instructed later.

## Backend

Use:

* Node.js
* NestJS
* TypeScript
* REST API

Use a modular architecture.

## Database

Use:

* PostgreSQL
* Prisma ORM

## Authentication

Use secure:

* Email/staff-ID and password authentication
* Password hashing using Argon2 or bcrypt
* Access tokens
* Refresh-token rotation where appropriate
* Secure HTTP-only cookies where appropriate
* Server-side authorization

Never rely on frontend role checks for security.

## Development/Deployment

Provide:

* Environment variable configuration
* Database migrations
* Seed scripts
* Docker support
* Production build configuration
* README
* Setup instructions

Never hardcode credentials or secrets.

---

# 3. ARCHITECTURAL PRINCIPLES

Build the application using clean modular architecture.

Suggested backend modules:

* Auth
* Users
* Roles
* Permissions
* Faculties
* Departments
* Courses
* Academic Years
* Semesters
* Lecturer Workloads
* Claims
* Claim Items
* Claim Approvals
* Finance
* Payments
* Reports
* Notifications
* Audit Logs
* Settings

Separate:

Controllers
→ Services
→ Business Logic
→ Data Access

Do not place complex business logic directly inside controllers.

Use DTOs and server-side validation.

Use database transactions for critical operations such as claim submission, approval, payment updates, and workflow transitions.

---

# 4. USERS AND ROLES

The system has six primary roles.

## 4.1 Administrator

The Administrator manages the platform.

Admin can:

* Create users
* Update users
* Activate/deactivate users
* Reset user access when necessary
* Assign roles
* Manage permissions
* Manage faculties
* Manage departments
* Manage courses
* Manage academic years
* Manage semesters
* Configure workload requirements
* Configure system settings
* View system-level reports
* View audit logs

Admin must not casually alter finalized financial records.

---

# 5. LECTURER

Lecturers are the primary claim submitters.

## Lecturer Dashboard

Display:

* Welcome section
* Current academic year
* Current semester
* Total claims
* Draft claims
* Submitted claims
* Pending claims
* Approved claims
* Rejected claims
* Paid claims
* Recent claims
* Notifications

Primary action:

**Create New Claim**

## Lecturer Navigation

* Dashboard
* My Claims
* New Claim
* Claim History
* Reports
* Notifications
* Profile

---

# 6. CLAIM CREATION

Create a multi-section claim form.

The lecturer must provide:

### Academic Information

* Academic year
* Semester

### Teaching Information

Allow multiple courses to be added to one claim where appropriate.

Each claim item should contain:

* Course
* Course code
* Teaching dates
* Weekly teaching hours
* Number of weeks
* Remarks

Calculate automatically:

Total Teaching Hours = Weekly Teaching Hours × Number of Weeks

The calculation must happen on both frontend and backend.

Never trust frontend calculations alone.

Display:

Weekly Hours
× Weeks
= Total Hours

The lecturer must be able to:

* Save as draft
* Edit draft
* Add course
* Remove course
* Review claim
* Submit claim

Once submitted, normal editing must be disabled unless the claim is returned for correction.

---

# 7. WORKLOAD CLASSIFICATION

Support at minimum:

## Teaching Overload

Used when the lecturer exceeds the configured normal workload.

Example:

Expected workload = 12 hours/week
Actual workload = 18 hours/week
Overload = 6 hours/week

Do not hardcode 12 hours globally.

The expected workload must be configurable.

Formula:

Overload Hours =
MAX(Actual Teaching Hours - Expected Workload, 0)

## Part-Time Lecturer

Part-time lecturers are paid based on teaching hours.

The architecture must allow rates and calculation rules to be configured rather than scattered throughout source code.

---

# 8. CLAIM STATUS MODEL

Implement explicit statuses.

Recommended statuses:

* DRAFT
* SUBMITTED
* HOD_REVIEW
* HOD_REJECTED
* RETURNED_FOR_CORRECTION
* HOD_APPROVED
* PRO_VC_REVIEW
* PRO_VC_REJECTED
* PRO_VC_APPROVED
* FINANCE_PROCESSING
* PAYMENT_PENDING
* PAID
* CANCELLED

Do not permit arbitrary status changes.

Create a server-side state machine/workflow policy defining valid transitions.

Example:

DRAFT
→ SUBMITTED
→ HOD_REVIEW
→ HOD_APPROVED
→ PRO_VC_REVIEW
→ PRO_VC_APPROVED
→ FINANCE_PROCESSING
→ PAYMENT_PENDING
→ PAID

Rejected or returned claims must follow explicitly permitted paths.

---

# 9. HOD MODULE

The HOD manages claims belonging to lecturers in the HOD's department.

## HOD Dashboard

Show:

* Claims awaiting review
* Claims approved
* Claims rejected
* Claims returned
* Number of lecturers
* Recent submissions

## HOD Claim Queue

Filters:

* Lecturer
* Course
* Semester
* Academic year
* Status
* Date submitted

## Claim Review Page

Display:

* Lecturer
* Department
* Employment/lecturer type
* Academic year
* Semester
* Courses
* Weekly hours
* Number of weeks
* Calculated hours
* Workload
* Overload where applicable
* Remarks
* Claim history

Actions:

* Approve
* Reject
* Return for correction

Require a reason for rejection.

Require a comment when returning a claim for correction.

The HOD must only access claims within the HOD's authorized department unless additional permission has explicitly been granted.

---

# 10. PRO VC MODULE

The Pro VC performs final approval after HOD approval.

## Dashboard

Show:

* Claims awaiting final approval
* Claims approved
* Claims rejected
* Recent approvals
* Summary by faculty/department where authorized

## Review

The Pro VC must be able to inspect:

* Lecturer information
* Department
* Claim items
* Teaching hours
* Workload information
* HOD decision
* HOD comments
* Complete approval history

Actions:

* Approve
* Reject
* Return where institutional policy allows

Require reasons for rejection.

After approval, the claim moves to Finance.

---

# 11. FINANCE MODULE

Finance must only process claims that have successfully completed the required approval stages.

## Finance Dashboard

Show:

* Claims awaiting processing
* Payment pending
* Paid claims
* Total approved amount where payment rules are configured
* Recent payments

## Finance Queue

Filters:

* Lecturer
* Department
* Faculty
* Academic year
* Semester
* Payment status
* Date

Finance can:

* Open approved claim
* Verify payment information
* Record approved/payable amount
* Add payment reference
* Add payment date
* Add finance notes
* Mark payment pending
* Mark payment completed

Once payment is finalized, sensitive financial fields must not be silently changed.

Corrections must be auditable.

---

# 12. PAYMENT CALCULATION ENGINE

The original system requirements do not provide complete institutional payment rates.

Therefore:

DO NOT invent UPSA payment rates.

Build a configurable rate architecture.

Possible configurable fields:

* Lecturer category
* Employment type
* Rate per hour
* Effective date
* Academic year
* Semester where applicable

Calculation:

Payable Amount =
Eligible Teaching Hours × Applicable Rate

All financial calculations must use fixed-precision decimal handling.

Never use floating-point arithmetic for currency.

Every calculation should be reproducible and auditable.

---

# 13. AUDIT DEPARTMENT

The Audit Department requires read-oriented access for accountability and compliance.

## Audit Dashboard

Show:

* Claim submissions
* Approvals
* Rejections
* Returned claims
* Payments
* Recent sensitive system activities

## Audit Log

Record important events including:

* Login
* Failed login where appropriate
* Claim creation
* Claim submission
* Claim modification
* Claim approval
* Claim rejection
* Claim returned
* Payment processing
* Payment completion
* Administrative configuration changes
* User creation
* Role changes

Each log should contain where appropriate:

* ID
* User
* User role
* Action
* Entity type
* Entity ID
* Timestamp
* Previous values
* New values
* IP address where appropriate
* Metadata

Audit logs must be protected from ordinary modification or deletion.

---

# 14. ADMINISTRATION MODULE

Create an Administration section containing:

## Users

* User list
* Search
* Filter
* Create
* Edit
* Activate/deactivate
* Assign role

## Faculties

* Create
* Edit
* Activate/deactivate

## Departments

Each department belongs to a faculty.

Support:

* Create
* Edit
* Assign HOD
* Activate/deactivate

## Courses

Store:

* Course code
* Course title
* Department
* Credit hours where required
* Active status

## Academic Years

Example:

2026/2027

Only authorized administrators can configure them.

## Semesters

Examples:

* First Semester
* Second Semester

## Workload Configuration

Allow authorized administrators to define normal workload rules.

## Payment Rates

Create configurable rate structures without inventing institutional rates.

---

# 15. REPORTING

Create a proper reporting module.

## Lecturer Reports

Include:

* Courses taught
* Teaching hours
* Claim statuses
* Approval history
* Payment history where authorized

## Department Reports

Include:

* Lecturer workloads
* Overload information
* Claims by status
* Department statistics

## Finance Reports

Include:

* Approved claims
* Payment pending
* Paid claims
* Payment records

## Audit Reports

Include:

* User activities
* Approval history
* Rejections
* Claim modifications
* Payment activities

Provide filters such as:

* Date range
* Academic year
* Semester
* Faculty
* Department
* Lecturer
* Status

Allow suitable reports to be exported to:

* PDF
* CSV

Do not expose confidential information to roles without permission.

---

# 16. NOTIFICATION SYSTEM

Implement in-app notifications.

Examples:

Lecturer:
"Your claim has been approved by the HOD."

"Your claim was returned for correction."

"Your claim has received final approval."

"Payment for your claim has been recorded."

HOD:
"A new lecturer claim requires your review."

Pro VC:
"A claim has been forwarded for final approval."

Finance:
"A newly approved claim is ready for processing."

Notifications should support:

* Read/unread status
* Timestamp
* Link to relevant claim

Design the architecture so email notifications can be added or enabled through configuration.

---

# 17. ROLE-BASED ACCESS CONTROL

Do not simply hardcode:

if role === "admin"

Build proper permissions.

Example permissions:

claims.create
claims.view_own
claims.view_department
claims.submit
claims.approve_hod
claims.approve_provc
claims.reject
claims.return
payments.view
payments.process
reports.view_department
reports.view_finance
audit.view
users.manage
roles.manage
departments.manage
courses.manage
settings.manage

Roles should receive appropriate permissions.

Enforce permissions on the backend.

Frontend restrictions are only for UX.

---

# 18. DATA ISOLATION

This requirement is critical.

Lecturer:

Can only access their own claims unless explicitly granted another permission.

HOD:

Can only access claims belonging to the HOD's authorized department(s).

Finance:

Can only access the financial/claim data necessary for authorized processing.

Audit:

Can inspect relevant records but should not receive unnecessary modification permissions.

Pro VC:

Can access claims requiring the office's approval according to configured institutional scope.

Admin:

Administrative access must still be permission-controlled.

Never rely on a user-supplied lecturer ID or department ID to enforce access.

Determine authorization from the authenticated server-side identity.

---

# 19. DATABASE DESIGN

Create a normalized PostgreSQL database.

At minimum evaluate entities for:

* users
* roles
* permissions
* role_permissions
* user_roles where required
* faculties
* departments
* courses
* academic_years
* semesters
* lecturer_profiles
* lecturer_workloads
* claims
* claim_items
* claim_approvals
* claim_status_history
* payment_rates
* payments
* notifications
* audit_logs
* refresh_tokens/sessions where required
* system_settings

Use:

* UUIDs where appropriate
* Foreign keys
* Unique constraints
* Check constraints
* Indexes
* Created timestamps
* Updated timestamps

Use soft deletion only where appropriate.

Never soft-delete financial/audit records merely for convenience.

Create indexes for frequently queried fields including appropriate combinations of:

* lecturer_id
* department_id
* status
* academic_year_id
* semester_id
* submitted_at

Design indexes according to actual queries rather than blindly indexing every column.

---

# 20. DATA INTEGRITY

Protect against:

* Duplicate claims
* Invalid teaching hours
* Negative values
* Invalid week counts
* Claims referencing inactive courses
* Invalid academic periods
* Unauthorized approvals
* Approval of already finalized claims
* Duplicate payment processing
* Invalid workflow transitions

Critical checks must happen inside the backend/database transaction where appropriate.

---

# 21. CONCURRENCY

Handle situations where two users open the same claim.

Example:

Two authorized reviewers attempt actions on the same record.

The second operation must not silently overwrite the first.

Use:

* Transactions
* Optimistic concurrency/version fields or locking where appropriate
* Status preconditions

Return a clear conflict response.

---

# 22. API DESIGN

Create versioned REST APIs.

Example structure:

/api/v1/auth/login
/api/v1/auth/logout
/api/v1/auth/refresh

/api/v1/users

/api/v1/faculties

/api/v1/departments

/api/v1/courses

/api/v1/claims

/api/v1/claims/:id

/api/v1/claims/:id/submit

/api/v1/claims/:id/hod/approve

/api/v1/claims/:id/hod/reject

/api/v1/claims/:id/return

/api/v1/claims/:id/provc/approve

/api/v1/claims/:id/provc/reject

/api/v1/payments

/api/v1/reports

/api/v1/notifications

/api/v1/audit-logs

Use appropriate:

GET
POST
PATCH/PUT
DELETE

Return consistent responses.

Use proper HTTP codes:

200
201
204
400
401
403
404
409
422 where appropriate
500

Never expose stack traces or sensitive server details in production responses.

---

# 23. SECURITY

Security is mandatory.

Implement:

* Secure password hashing
* Authentication
* Authorization
* RBAC
* Input validation
* Output sanitization where required
* Rate limiting
* Secure headers
* CORS restrictions
* CSRF protection where applicable to the chosen auth architecture
* Secure cookie configuration where applicable
* Parameterized ORM queries
* Brute-force protection
* Audit logging
* Session/token revocation
* Environment variable protection

Prevent:

* SQL injection
* XSS
* CSRF
* IDOR/BOLA
* Broken access control
* Privilege escalation
* Mass assignment
* Authentication bypass

Never return password hashes or sensitive authentication data through APIs.

---

# 24. USER INTERFACE

The application should look like a professional university enterprise system.

Design characteristics:

* Clean
* Modern
* Professional
* Academic
* Minimal
* Accessible
* Responsive
* Consistent

Use a primarily:

* White
* Neutral
* UPSA-inspired professional visual language

Do not make the application excessively colorful.

Do not create a generic AI-generated-looking dashboard.

## Desktop Layout

Left sidebar
Top header
Main content

## Mobile

Use responsive navigation.

Provide:

* Clear typography
* Good spacing
* Status badges
* Tables
* Search
* Filters
* Pagination
* Loading states
* Empty states
* Confirmation dialogs
* Form validation
* Toast/notification feedback

---

# 25. DASHBOARD DATA

Never hardcode dashboard numbers.

Dashboard statistics must come from backend queries.

Examples:

Lecturer:

* My total claims
* Pending
* Approved
* Paid

HOD:

* Department claims
* Awaiting review
* Approved
* Rejected

Pro VC:

* Awaiting final approval
* Approved
* Rejected

Finance:

* Awaiting processing
* Payment pending
* Paid

Admin:

* Users
* Lecturers
* Departments
* Claims
* Pending approvals

---

# 26. SEARCH, FILTERING AND PAGINATION

Large tables must support server-side pagination.

Provide suitable filtering and searching for:

* Claims
* Users
* Lecturers
* Departments
* Courses
* Payments
* Audit logs

Do not load thousands of records into the browser and filter everything locally.

---

# 27. ERROR HANDLING

Create centralized backend exception/error handling.

Frontend must display understandable errors.

Do not show users:

"Prisma Error P2002"

Instead:

"A claim for this course and academic period already exists."

Log technical details securely on the server.

---

# 28. ACCESSIBILITY

Use:

* Semantic HTML
* Form labels
* Keyboard-accessible controls
* Visible focus states
* Accessible dialogs
* Suitable contrast
* ARIA attributes where required

---

# 29. TESTING

Create:

## Unit Tests

Test:

* Teaching-hour calculation
* Overload calculation
* Payment calculation
* Permission checks
* Status transitions

## Integration Tests

Test:

* Authentication
* Claim creation
* Submission
* HOD approval
* Pro VC approval
* Finance processing
* Authorization

## End-to-End Critical Workflow

Test:

Lecturer login
→ Create claim
→ Submit
→ HOD approve
→ Pro VC approve
→ Finance process
→ Mark paid
→ Lecturer sees paid status.

Also test unauthorized attempts.

---

# 30. SEED DATA

Provide development seed data.

Create example:

* Admin
* Lecturer
* HOD
* Pro VC
* Finance Officer
* Auditor

Also create sample:

* Faculty
* Department
* Courses
* Academic year
* Semester

Seed data is development-only.

Do NOT invent official UPSA payment rates.

---

# 31. README

Create professional documentation containing:

* Project description
* Architecture
* Requirements
* Installation
* Environment variables
* PostgreSQL setup
* Migration commands
* Seed commands
* Frontend startup
* Backend startup
* Testing
* Docker instructions
* Production deployment considerations

Provide `.env.example`.

Never commit real secrets.

---

# 32. DEVELOPMENT PROCESS

Do NOT attempt to generate the entire system blindly in one enormous step.

Build it incrementally.

## PHASE 1 — Requirements and Architecture

Before coding:

1. Analyze these requirements.
2. Produce architecture.
3. Produce database ERD/schema.
4. Produce RBAC matrix.
5. Produce workflow/state-transition diagram.
6. Produce API structure.
7. Produce frontend page/route map.
8. Identify requirements that remain institution-specific.

STOP.

Do not start implementation until the architecture is internally consistent.

---

## PHASE 2 — Foundation

Build:

* Project structure
* PostgreSQL connection
* Prisma
* Core schema
* Migrations
* Authentication
* RBAC
* Users
* Faculties
* Departments
* Courses
* Academic years
* Semesters

Verify:

* Login
* Authentication
* Authorization
* Database constraints
* Role restrictions

---

## PHASE 3 — Lecturer Claims

Build:

* Lecturer dashboard
* New claim
* Claim items
* Draft saving
* Teaching-hour calculation
* Workload calculation
* Claim submission
* Claim history

Verify the complete lecturer workflow.

---

## PHASE 4 — HOD Workflow

Build:

* HOD dashboard
* Department claim queue
* Claim review
* Approval
* Rejection
* Return for correction
* Status history

Verify department isolation.

---

## PHASE 5 — Pro VC Workflow

Build:

* Pro VC dashboard
* Final approval queue
* Review
* Approval
* Rejection
* Workflow transition

Verify that claims cannot bypass HOD approval.

---

## PHASE 6 — Finance

Build:

* Finance dashboard
* Approved claim queue
* Configurable rate support
* Payment calculation
* Payment record
* Payment reference
* Payment status
* Mark paid

Verify financial integrity.

---

## PHASE 7 — Audit and Notifications

Build:

* Audit logs
* Audit dashboard
* Notifications
* Approval history
* Claim history

Verify that sensitive actions are logged.

---

## PHASE 8 — Reports

Build:

* Lecturer reports
* Department reports
* Finance reports
* Audit reports
* Filters
* CSV export
* PDF export

Verify permissions for each report.

---

## PHASE 9 — Admin

Complete:

* User management
* Roles/permissions
* Faculties
* Departments
* Courses
* Academic configuration
* Workload configuration
* Payment-rate configuration

---

## PHASE 10 — HARDENING

Perform:

* Security review
* Authorization review
* Validation review
* Performance optimization
* Index review
* Accessibility review
* Responsive testing
* Error handling
* Concurrency testing

---

## PHASE 11 — FINAL TESTING

Run the complete lifecycle:

Lecturer
→ HOD
→ Pro VC
→ Finance
→ Paid
→ Report
→ Audit Trail

Test each role independently.

Test unauthorized access.

Test direct API access.

Test invalid state transitions.

Fix all critical and high-severity problems before declaring the system complete.

---

# 33. CRITICAL DEVELOPMENT RULES

1. Do not invent business requirements silently.

2. If an institutional rule is unknown, make it configurable or clearly identify it as requiring confirmation.

3. Never invent official UPSA payment rates.

4. Never bypass backend authorization.

5. Never trust frontend calculations.

6. Never use placeholder data in production functionality.

7. Never expose claims across departments without authorization.

8. Never permit Finance to process a claim before required approval.

9. Never allow normal users to modify audit logs.

10. Never allow arbitrary claim status changes.

11. Use database transactions for critical workflow operations.

12. Every important action must produce an audit record.

13. Every button must perform its intended operation or be removed.

14. Do not create pages merely to make the application look complete.

15. Validate each phase before proceeding.

---

# 34. REQUIREMENTS THAT MUST REMAIN CONFIGURABLE

The provided requirements do not define all institutional policies.

Therefore, do not make assumptions about:

* Official UPSA hourly payment rates
* Lecturer-category payment differences
* Exact normal workload for every lecturer type
* Tax/deduction calculations
* Whether all rejected claims can be resubmitted
* Whether Pro VC can return claims directly
* Whether supporting documents are mandatory
* Exact payment integration with UPSA's financial systems
* Exact email infrastructure

Design these so they can be configured or implemented once the university supplies the official rules.

---

# 35. DEFINITION OF DONE

The project is NOT complete merely because the UI loads.

It is complete only when:

* Users can authenticate.
* RBAC works.
* Lecturer can create and submit a valid claim.
* HOD can review the correct departmental claim.
* Pro VC can perform final approval.
* Finance can process an approved claim.
* Payment can be recorded.
* Lecturer can track status.
* Reports work.
* Notifications work.
* Audit history works.
* Unauthorized access is rejected.
* Data survives application restart.
* Database migrations work.
* Calculations are verified.
* Critical workflows are tested.
* Responsive interface works.
* Production build succeeds.
* README/setup documentation is complete.

---

# 36. YOUR FIRST RESPONSE

Do not begin by generating random components.

First provide:

1. Complete architecture
2. Recommended folder structure
3. Database schema/ERD
4. Tables and relationships
5. RBAC permission matrix
6. Claim state-transition model
7. API endpoint plan
8. Complete page/route map
9. Development phase plan
10. List of institutional rules that still require confirmation

Then begin Phase 1.

After completing each implementation phase:

* Run tests
* Run type checking
* Run linting
* Build the project
* Check database migrations
* Test permissions
* Test the relevant workflow
* Fix errors

Do not proceed to the next phase while known critical errors remain.

Build this as a real university information system, not a demonstration dashboard.

