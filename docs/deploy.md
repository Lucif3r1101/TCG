# Deployment Guide

## Architecture
- Frontend: Vercel (`apps/frontend`)
- Backend: Render Web Service (`apps/backend` build via workspace command)
- Database: MongoDB Atlas

## 1) MongoDB Atlas
- Ensure cluster is active.
- Create DB user with read/write access to `tcg` database.
- Network Access: allow Render egress (for quick setup, temporary `0.0.0.0/0`).

## 2) Backend (Render)
- Option A: use `render.yaml` in repo root.
- Option B: create web service manually with:
  - Build Command: `npm install && npm run build -w @tcg/backend`
  - Start Command: `npm run start -w @tcg/backend`
  - Health Check Path: `/health`

### Backend environment variables
- `NODE_VERSION=20`
- `PORT=4000`
- `MONGODB_URI=<atlas-uri-with-/tcg-db>`
- `JWT_SECRET=<long-random-secret>`
- `CORS_ORIGIN=https://<your-vercel-domain>`
- `EMAIL_FROM=TCG Support <your-verified-sender@yourdomain.com>`
- `RESET_PASSWORD_URL=https://<your-vercel-domain>`
- Mail provider vars — see "Password reset email" below.

If you have multiple frontend domains, set comma-separated origins:
- `CORS_ORIGIN=https://app.example.com,https://preview.example.com`

### Password reset email
- In production, the reset token is not returned in the API response — it is emailed.
- `RESET_PASSWORD_URL` builds the reset link included in emails.
- The backend supports two providers via `MAIL_PROVIDER` (`resend` | `smtp`). If
  `MAIL_PROVIDER` is blank it auto-detects: **Resend** when `RESEND_API_KEY` is set,
  otherwise **SMTP** when `SMTP_HOST` is set. If neither is configured, reset emails
  are skipped (the request still succeeds, nothing is sent).

**Option A — Resend (primary, needs a verified domain):**
- `MAIL_PROVIDER=resend`
- `RESEND_API_KEY=<resend-api-key>`
- `EMAIL_FROM=TCG Support <your-verified-sender@yourdomain.com>`

**Option B — Gmail SMTP (beta, no custom domain needed):**
- `MAIL_PROVIDER=smtp`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=youraddress@gmail.com`
- `SMTP_PASS=<16-char Google App Password>`  ← create at Google Account → Security →
  2-Step Verification → App passwords (NOT your normal Gmail password)
- `SMTP_SECURE=false` (use `true` only with port `465`)
- `EMAIL_FROM=Chronicles of the Rift <youraddress@gmail.com>` (Gmail ignores other From addresses)

**Setup checklist:**
1. Pick a provider and set `MAIL_PROVIDER` (or leave blank for auto-detect).
2. Set `EMAIL_FROM` and the provider's vars above.
3. Set `RESET_PASSWORD_URL` to your frontend origin.
4. Redeploy, then test: `POST /auth/forgot-password` with a real address and confirm delivery.
5. When your custom domain is verified in Resend, switch `MAIL_PROVIDER=resend`.

## 3) Frontend (Vercel)
- Import repo in Vercel.
- Root Directory: `apps/frontend`
- Project Name: `chronicles-of-the-rift` (recommended)
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### Frontend environment variables
- `VITE_API_URL=https://<your-render-backend-domain>`
- `VITE_SOCKET_URL=https://<your-render-backend-domain>`

## 4) Post-deploy smoke checks
- Open frontend and register a new user.
- Confirm `/health` on backend returns `ok: true`.
- Join queue from two users and verify `match_found`.
- Refresh one client in active match and verify rejoin works.

## 5) Security checklist before public launch
- Rotate `JWT_SECRET` and DB password from any values used during development.
- Restrict Atlas network access from `0.0.0.0/0` to known ranges if possible.
- Limit CORS to only production frontend domains.
- Keep `NODE_VERSION=20` in deploy environments.
