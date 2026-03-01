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
- `RESEND_API_KEY=<resend-api-key>`
- `EMAIL_FROM=TCG Support <your-verified-sender@yourdomain.com>`
- `RESET_PASSWORD_URL=https://<your-vercel-domain>`

If you have multiple frontend domains, set comma-separated origins:
- `CORS_ORIGIN=https://app.example.com,https://preview.example.com`

### Password reset email notes
- In production, reset token is not returned in API response.
- Backend sends reset email via Resend using `RESEND_API_KEY` and `EMAIL_FROM`.
- `RESET_PASSWORD_URL` is used to build the reset link included in emails.

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
