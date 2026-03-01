# TCG Monorepo

Day 1 scaffold for a web-based TCG project.

## Apps
- `apps/frontend`: React + Vite TypeScript client
- `apps/backend`: Express + Socket.IO TypeScript server
- `packages/shared`: Shared types/utilities

## Quick start
1. Install dependencies
   - `npm install`
2. Run both frontend and backend
   - `npm run dev`

## Next steps (Day 2+)
- Add auth (Supabase or JWT + DB)
- Add card/deck schema and persistence
- Add real-time match state
- Add deployment config