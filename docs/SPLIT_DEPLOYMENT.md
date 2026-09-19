# Split deployment: Vercel frontend and Render API

This project is prepared for two deployments from the same GitHub repository:

- Vercel hosts the React frontend.
- Render hosts the Nest API using `render.yaml` at the repository root.
- A managed PostgreSQL database stores all production records.

## 1. Create the production database

Create PostgreSQL with Render, Neon, or Supabase. Keep its SSL connection string private. Do not use the local `127.0.0.1` database URL.

## 2. Deploy the API on Render

1. Push this repository to GitHub.
2. In Render, choose **New** then **Blueprint** and select this GitHub repository. Render reads `render.yaml`.
   If you create the service manually, use `npm ci --include=dev && npm run db:generate && npm run build:api` as the Build Command and `npm start` as the Start Command.
3. Add these secret environment variables to the API service:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Production PostgreSQL connection string. |
| `JWT_SECRET` | A new random secret of at least 48 characters. |
| `WEB_ORIGIN` | `https://nexoratel-gilt.vercel.app` or your final Vercel domain. |

`NODE_ENV`, `HOST`, and the cross-origin cookie setting are already supplied by `render.yaml`.

4. Add `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_STAFF_ID`, and `BOOTSTRAP_ADMIN_PASSWORD` as Render secrets before the first deploy. This creates the first administrator plus system roles and permissions. Do not run the development seed in production.
5. Deploy. The Render build automatically applies Prisma migrations and creates the initial administrator only when none exists. Later deployments safely skip the bootstrap.
6. Visit `https://YOUR-RENDER-SERVICE.onrender.com/api/v1/health/ready`. It must return `{"data":{"status":"ready"}}`.

## 3. Deploy the frontend on Vercel

1. In Vercel, keep the repository root as the project Root Directory.
2. Add the Production environment variable below, replacing the URL with the working Render API URL:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://YOUR-RENDER-SERVICE.onrender.com` |

3. Redeploy Vercel. Vite embeds `VITE_API_URL` while building, so changing it always requires a new frontend deployment.

## 4. Verify sign-in

Open the Vercel URL, sign in, refresh the page, and confirm the session remains active. The default `vercel.app` and `onrender.com` domains are separate sites, so the API uses a secure cross-origin refresh cookie. For the final university deployment, use custom subdomains under one university domain, such as `claims.example.edu` and `claims-api.example.edu`.

## Production accounts

Sign in with the administrator details used for the one-time bootstrap, then use **Staff accounts** to add staff. Development accounts such as `lecturer@example.test` are not production credentials.
