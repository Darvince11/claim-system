# Vercel deployment

The repository is configured for one Vercel project. The Vite application is served as a single-page app and the Nest API runs as the `/api/v1/*` Vercel Function. No separate frontend API URL is required.

## Before the first deployment

Create a managed PostgreSQL database. Use a production database from a provider such as Neon, Supabase, or Vercel Postgres; do not use the local embedded database or a development seed password.

In the Vercel project settings, add these environment variables for Production and Preview:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The SSL PostgreSQL connection string supplied by the managed database provider. |
| `JWT_SECRET` | A newly generated random secret with at least 48 characters. |
| `WEB_ORIGIN` | Optional. The production URL, for example `https://your-project.vercel.app`. Vercel's `VERCEL_URL` is used automatically when this is omitted. |
| `NODE_ENV` | `production` |

Do not set `SEED_PASSWORD` or `SEED_DEMO_DATA` in Vercel. The demo seed is local-only and must never be used for colleagues or production users.

## First release

1. Import the GitHub repository into Vercel with the repository root as the Root Directory.
2. Keep the detected Vite framework preset. `vercel.json` supplies the build command, SPA fallback, and API function settings.
3. Set the environment variables above.
4. Apply Prisma migrations to the managed database once, using the same `DATABASE_URL`:

```powershell
$env:DATABASE_URL='postgresql://...'
npm ci
npm run db:generate
npm run db:migrate
```

5. Push the deployment branch or click Redeploy in Vercel.
6. Visit `https://your-project.vercel.app/api/v1/health/ready` before sharing the main URL. This must be served by the API Function, not the frontend fallback.

If that health URL does not return `{"data":{"status":"ready"}}`, do not share the sign-in page yet. Open the Vercel Function logs and correct the missing `DATABASE_URL`, `JWT_SECRET`, or migration before redeploying.

## Operational note

Vercel Functions scale to zero and must be treated as request-driven. The current notification outbox is processed during application requests. For institution-wide production use, move email delivery and scheduled jobs to a dedicated queue or cron worker before enabling live email notifications.
