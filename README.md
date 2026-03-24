# TCG 

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
