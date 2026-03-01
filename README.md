# TCG Monorepo

Day 1 + Day 2 + Day 3 + Day 4 + Day 5 + Day 6 + Day 7 scaffold for a web-based TCG project.

## Apps
- `apps/frontend`: React + Vite TypeScript client
- `apps/backend`: Express + Socket.IO TypeScript server
- `packages/shared`: Shared types/utilities

## Day 2 scope (completed)
- MongoDB connection with Mongoose
- Auth API endpoints
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me` (Bearer token)
- JWT auth middleware
- Frontend register/login screen

## Day 3 scope (completed)
- Base card seed on backend startup
- Starter card collection + starter deck on new user registration
- Public cards API
  - `GET /cards`
- Protected deck APIs
  - `GET /decks`
  - `GET /decks/:deckId`
  - `POST /decks`
  - `PUT /decks/:deckId`

Deck rules in this MVP:
- Deck size: exactly 20 cards
- Max copies per card: 2

## Day 4 foundation (completed)
- Socket auth via JWT (`socket.handshake.auth.token`)
- Queue matchmaking (`queue_join`, `queue_leave`)
- Match creation persisted in Mongo (`Match` model)
- Basic match state flow
  - `match_found`
  - `match_end_turn` -> `match_state`
  - `match_concede` -> `match_completed`

## Day 5 foundation (completed)
- Match query APIs for rejoin:
  - `GET /matches/active`
  - `GET /matches/:matchId`
- Richer match state persisted:
  - player health, player mana, turn deadline
- Frontend console upgraded:
  - auto rejoin active match on refresh
  - live match panel with turn, hp, mana, timer

## Day 6 hardening (completed)
- API protection:
  - global API rate limit
  - stricter auth route rate limit
- Realtime protection:
  - zod validation for socket payloads
  - per-user cooldowns for queue and match actions
- Deck validation hardened:
  - duplicate entries cannot bypass max copies per card
- Backend tests:
  - deck rules tests
  - realtime payload schema tests

## Day 7 launch prep (completed)
- Production CORS handling with support for multiple origins.
- Deploy templates and docs:
  - `render.yaml` for backend service setup
  - `docs/deploy.md` with Render + Vercel launch steps
- Env templates updated for production-like setup.

## Phase 1 UX/Auth upgrade (completed)
- Redesigned frontend auth/dashboard shell with improved responsive UI.
- Added `POST /auth/forgot-password` and `POST /auth/reset-password`.
- Strong password policy enforced in backend and frontend for register/reset:
  - 8+ chars, uppercase, lowercase, number, symbol.

## Phase 2 multiplayer rooms (completed)
- Added realtime room lobby flow for `2-6` players:
  - `room_create`, `room_join`, `room_leave`, `room_ready`, `room_start`
  - room lifecycle events: `room_created`, `room_state`, `room_started`, `room_left`
- Added room payload validation in backend.
- Frontend dashboard now includes create/join room controls with ready/start actions.

## Quick start
1. Use MongoDB Atlas and set backend env:
   - Copy `apps/backend/.env.example` to `apps/backend/.env`
   - Fill `MONGODB_URI` and `JWT_SECRET`
2. Set frontend env:
   - Copy `apps/frontend/.env.example` to `apps/frontend/.env`
3. Install dependencies:
   - `npm install`
4. Run both apps:
   - `npm run dev`

## Quick API test flow
1. Register user: `POST /auth/register`
2. Copy token from response
3. List cards: `GET /cards`
4. List your decks: `GET /decks` with `Authorization: Bearer <token>`

## Notes
- Backend default URL: `http://localhost:4000`
- Frontend default URL: `http://localhost:5173`
- Auth token expiration: 7 days
- Deployment guide: `docs/deploy.md`
