# UPSA Lecturer Claim Management System

A university information system being built for lecturer teaching claims, departmental verification, Pro VC approval, finance processing, payment recording, reporting, and auditability.

## Project status

The current working increment includes authentication, protected role workspaces, database-backed overview totals, staff creation/editing and role assignment, academic-record management, profile/password settings, an in-app notification inbox, explicit claim policy settings, workload configuration, lecturer teaching-claim drafts, submission gates, immutable submitted snapshots, history, coverage protection, HOD approve/return/reject decisions, Pro VC final approve/reject decisions, finance processing, configured-rate payment calculation, payment completion evidence, scoped audit-log browsing, scoped summary reports, and in-app notification delivery for submitted claims.

Dedicated reviewer/finance queues, durable CSV/PDF export jobs, Docker/production deployment, and institution-approved live operations remain to be implemented. No official university rates, workload rules, or claim policy are invented by the seed data; administrators must configure institution-approved policy, workload evidence, and payment rates before real submissions can progress. No production readiness is claimed.

Start with [Implementation readiness](docs/IMPLEMENTATION_READINESS.md) for the observed baseline, resolved technical decisions, outstanding institutional policies, and ordered delivery gates.

## Documentation

1. [Original development requirements](docs/MASTER_REQUIREMENTS.md)
2. [Requirements and acceptance criteria](docs/REQUIREMENTS.md)
3. [Architecture and folder structure](docs/ARCHITECTURE.md)
4. [Database schema and ERD](docs/DATABASE.md)
5. [RBAC and data isolation](docs/RBAC.md)
6. [Claim workflow and calculations](docs/WORKFLOW.md)
7. [REST API plan](docs/API.md)
8. [Frontend pages and routes](docs/FRONTEND.md)
9. [Development phases and verification](docs/DEVELOPMENT_PLAN.md)
10. [Institutional decisions requiring confirmation](docs/OPEN_QUESTIONS.md)
11. [Security, testing, and operations](docs/SECURITY_AND_OPERATIONS.md)

## Deployment

The repository includes a Vercel frontend/API function configuration. See [Vercel deployment](docs/VERCEL_DEPLOYMENT.md) before sharing a hosted link. A managed PostgreSQL database and production environment variables are required; the local embedded database cannot be deployed to Vercel.

## Stack

React, TypeScript, Vite, React Router, CSS and Lucide React; NestJS REST API; PostgreSQL with Prisma. Docker remains a future deployment deliverable.

## Local setup

Use Node.js 20.19 or newer with npm. The current verification used Node 20.19.5 and the installed lockfile dependencies. A fresh dependency installation has not been reverified in this workspace.

```powershell
npm ci
npm run db:generate
npm run db:local
```

Keep the database command running. It provisions a persistent local PostgreSQL instance on port 55432 and creates `.env` only when that file does not exist. It generates development credentials in `.local/development-accounts.txt`; these files are ignored by Git. An existing `.env` is respected, so verify its connection settings before migration or seeding.

In another terminal:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://127.0.0.1:3001/api/v1`. `/health` is liveness and `/health/ready` also checks the database. Six development roles use `lecturer@example.test`, `hod@example.test`, `provc@example.test`, `finance@example.test`, `auditor@example.test`, and `admin@example.test`. Use the generated password from the local credentials file. Seeds do not create official rates or workload rules and do not reset passwords on existing accounts.

For externally managed PostgreSQL, configure `.env` from `.env.example` and skip `db:local`. Production must not use the development seed or local database helper.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

Integration tests require the local database to be running. They create a randomly named isolated schema, apply migrations and test seeds, start a separate API on a free port, and remove only that test schema afterward. They verify authentication/revocation/replay/reset, role isolation, expired scopes, profile persistence, notification ownership, audit events, database constraints, lecturer claim ownership, exact decimal totals, concurrent edits, policy gates, immutable revisions, duplicate coverage protection, notification delivery, cancellation, and full-time overload calculation boundaries.

Browser tests require the development app and seeded accounts to be running:

```powershell
npx playwright install chromium
npm run test:e2e
```

Alternatively, use an installed Edge browser with `$env:PLAYWRIGHT_CHANNEL = 'msedge'`. Set `TEST_WEB_URL` when testing a different web port. Screenshots and failure traces are written to the ignored `test-results` directory. Browser tests use development accounts, save the administrator's existing profile values, and create cancelled development lecturer claims with a clearly marked test remark.

On this machine, the system Node link was inaccessible to the tool shell. An ignored copy of the installed runtime is available in `.local/runtime`. A terminal can use it with `$env:PATH = "$PWD/.local/runtime;$env:PATH"`; no system runtime was replaced.

Development proceeds incrementally through the documented phase gates. Official rates and unresolved institutional rules must not be invented.
