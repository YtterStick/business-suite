# Tactiq Production Deployment Guide (Render + Cloudflare Edge + R2 + Cron)

This guide sets up **Option A**:
- **Cloudflare CDN & WAF** caches static Next.js bundles (`/_next/static/*`), icons, logos, and protects auth routes.
- **Cloudflare R2 + Edge Worker** handles file uploads/downloads directly from R2 (`$0` egress) and runs scheduled keep-alive & DB cleanup crons.
- **Render Web Service** runs Next.js 16 + Server Actions + Prisma 6.
- **Neon PostgreSQL** hosts your database (with idle scale-to-zero preserved by keeping `/api/health` DB-free).

---

## Architecture Overview

```text
Browser
 ├── https://app.yourdomain.com/_next/static/*  ──▶ Cloudflare Edge Cache (0 bytes hit Render)
 ├── https://app.yourdomain.com/*               ──▶ Cloudflare WAF/CDN ──▶ Render (Next.js + Prisma ──▶ Neon)
 ├── PUT (Presigned URL from /api/.../presign)  ──▶ Cloudflare R2 Direct Upload (0 bytes hit Render)
 └── https://files.yourdomain.com/files/*       ──▶ Cloudflare Worker Edge Cache ──▶ R2 Bucket ($0 egress)

Cloudflare Cron Triggers
 ├── */10 * * * *  ──▶ GET  https://your-service.onrender.com/api/health (DB-free keep-alive)
 └── 0 3 * * *     ──▶ POST https://your-service.onrender.com/api/cron/cleanup (prunes expired sessions/invites)
```

---

## Step 1 — Prepare Neon PostgreSQL

1. Open your Neon Console and grab **both** connection strings for your production database:
   - `DATABASE_URL` → **Pooled** connection string (`-pooler` hostname, `?sslmode=require`)
   - `DATABASE_URL_UNPOOLED` → **Direct (unpooled)** connection string (`?sslmode=require`)
2. Generate a strong `CRON_SECRET` (at least 32 random chars), e.g. in PowerShell:
   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

---

## Step 2 — Create Cloudflare R2 Bucket & CORS

1. Log in to **Cloudflare Dashboard → R2 Object Storage → Create bucket**.
2. Name the bucket `tactiq-files` (or update `bucket_name` in `cloudflare/edge-worker/wrangler.toml`).
3. Inside `tactiq-files` → **Settings → CORS Policy**, allow direct browser `PUT` uploads from your app origin:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://app.yourdomain.com",
         "http://localhost:3000"
       ],
       "AllowedMethods": ["GET", "HEAD", "PUT"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Go to **R2 → Manage R2 API Tokens → Create API Token**:
   - Permissions: **Object Read & Write** scoped to `tactiq-files`.
   - Copy **Account ID**, **Access Key ID**, and **Secret Access Key** for Render env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).

---

## Step 3 — Deploy Next.js Backend + SSR on Render

1. Push this repository to GitHub (make sure `render.yaml` and `.env.example` are committed, and `.env` / `.env.local` are **not** committed).
2. In **Render Dashboard → New → Blueprint**, connect your repo — Render detects `render.yaml` (`tactiq-web`).
   - Or create a **Web Service** manually with:
     - **Build Command:** `npm ci && npm run db:deploy && npm run build`
     - **Start Command:** `npx next start -H 0.0.0.0 -p ${PORT:-10000}`
     - **Health Check Path:** `/api/health`
3. Set all **Environment Variables** in Render:
   - `NODE_ENV=production`
   - `NODE_OPTIONS=--max-old-space-size=384`
   - `DATABASE_URL=<Neon pooled URL>`
   - `DATABASE_URL_UNPOOLED=<Neon direct URL>`
   - `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com`
   - `GOOGLE_CLIENT_ID=<your Google client id>`
   - `GOOGLE_CLIENT_SECRET=<your Google client secret>`
   - `CRON_SECRET=<same random secret from Step 1>`
   - `R2_ACCOUNT_ID=<Cloudflare Account ID>`
   - `R2_ACCESS_KEY_ID=<R2 Access Key ID>`
   - `R2_SECRET_ACCESS_KEY=<R2 Secret Access Key>`
   - `R2_BUCKET_NAME=tactiq-files`
   - `R2_PUBLIC_BASE_URL=https://files.yourdomain.com`
4. Wait for the first deploy to turn green and note your Render URL (e.g. `https://tactiq-web.onrender.com`).

---

## Step 4 — Wire Custom Domain, SSL, Caching & WAF in Cloudflare

Keeping `app.yourdomain.com` and `files.yourdomain.com` under **one root domain** ensures `httpOnly` `bs_session` and Google OAuth cookies work reliably.

1. **Custom Domain on Render:**
   - Render → **Settings → Custom Domains → Add `app.yourdomain.com`**.
2. **Cloudflare DNS:**
   - Add a `CNAME` record: `app` → `tactiq-web.onrender.com`.
   - Keep proxy **grey cloud (DNS only)** until Render finishes verifying & issuing its TLS cert, then switch to **Proxied (orange cloud)**.
3. **Cloudflare SSL/TLS:**
   - Set **SSL/TLS → Overview** to **Full (strict)** (never *Flexible*, or login cookies and redirects break).
4. **Cloudflare Caching → Cache Rules (Maximize Edge Offload):**
   - **Rule 1 — Cache Immutable Next.js & Static Assets:**
     - Match: `URI Path` starts with `/_next/static/` OR `URI Path` equals `/icon.svg` OR `/tactiq-logo.png` OR `/tactiq-logo.svg`
     - Action: **Eligible for cache**, Edge TTL **Ignore cache-control / 1 year**.
   - **Rule 2 — Bypass Dynamic & Auth Routes:**
     - Match: `URI Path` starts with `/api/` OR `/login` OR `/signup` OR `/invite/`
     - Action: **Bypass cache**.
5. **Cloudflare Speed → Optimization:** Ensure **Brotli** compression is enabled.
6. **Cloudflare Security → WAF / Rate Limiting (Free Tier):**
   - Rate-limit `POST` requests on `/login`, `/signup`, and `/api/auth/*` (e.g. 20 requests / 10 seconds per IP) to prevent credential stuffing before hitting Render.

---

## Step 5 — Update Google OAuth Redirect URI

In **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs**:
- Add Authorized JavaScript Origin: `https://app.yourdomain.com`
- Add Authorized Redirect URI: `https://app.yourdomain.com/api/auth/google/callback`

---

## Step 6 — Deploy the Cloudflare Edge Worker (R2 CDN + Keep-Alive & Cleanup Crons)

1. Edit `cloudflare/edge-worker/wrangler.toml` and set `RENDER_ORIGIN` to your actual Render URL (`https://tactiq-web.onrender.com`).
2. Install Worker dev dependencies and deploy:
   ```powershell
   cd cloudflare/edge-worker
   npm install
   npx wrangler login
   npx wrangler secret put CRON_SECRET
   npx wrangler deploy
   ```
   *(Paste the exact same `CRON_SECRET` configured in Render when prompted.)*
3. Attach your file subdomain to the Worker:
   - In **Cloudflare Dashboard → Workers & Pages → `tactiq-edge` → Settings → Domains & Routes → Add Custom Domain**, add **`files.yourdomain.com`**.
4. Verify your Worker handles both cron schedules (`*/10 * * * *` keep-alive + `0 3 * * *` daily cleanup) under **Workers & Pages → `tactiq-edge` → Triggers**.

---

## Step 7 — Verify Everything End-to-End

1. **Worker Edge Health:**
   ```powershell
   curl.exe -i https://files.yourdomain.com/edge/health
   ```
   Expect `200 OK` with `"edge":"cloudflare-worker"`.

2. **Render DB-Free Health (Keep-Alive):**
   ```powershell
   curl.exe -i https://app.yourdomain.com/api/health
   ```
   Expect `200 OK`, `Cache-Control: no-store...`, and no database query.

3. **Authenticated Deep DB Probe (optional manual check):**
   ```powershell
   curl.exe -i -H "Authorization: Bearer YOUR_CRON_SECRET" "https://app.yourdomain.com/api/health?db=1"
   ```
   Expect `200 OK` with `"db":"connected"` and latency in ms.

4. **Daily Cleanup Cron Test:**
   ```powershell
   curl.exe -i -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://app.yourdomain.com/api/cron/cleanup
   ```
   Expect `200 OK` with deleted counts JSON.

5. **Static Asset Cache Hit Check:**
   Open `https://app.yourdomain.com` in Chrome DevTools → Network, load twice, and verify `/_next/static/*` assets return `cf-cache-status: HIT`.

6. **Auth & Google Login:**
   Sign in via Google on `https://app.yourdomain.com/login` and verify redirect lands cleanly inside your workspace.
