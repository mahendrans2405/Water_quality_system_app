# Water Quality Monitoring System - Backend

## Setup

1. Copy env file:
   - `copy .env.example .env`
2. Set:
   - **MONGO_URI**
   - **JWT_ACCESS_SECRET** (>= 16 chars)
   - **JWT_REFRESH_SECRET** (>= 16 chars)
3. Start MongoDB locally (or use MongoDB Atlas).

### Start MongoDB with Docker (recommended on Windows)

From `backend/`:

- `docker compose up -d`

## Run

- Dev:
  - `npm run dev`
- Prod:
  - `npm run start`

## If you see `ECONNREFUSED 127.0.0.1:27017`

That error means MongoDB is not reachable. The server now **still starts**, and:

- `GET /health` will show `mongo.connected: false`
- `/api/*` returns **503 DB_UNAVAILABLE** until MongoDB is running

## API

- Health: `GET /health`
- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh-token`
- Users:
  - `POST /api/users` (SuperAdmin / Company)
  - `GET /api/users` (SuperAdmin / Company)
  - `PUT /api/users/:id` (SuperAdmin / Company)
  - `DELETE /api/users/:id` (SuperAdmin / Company)
- Companies:
  - `POST /api/companies` (SuperAdmin)
  - `GET /api/companies` (SuperAdmin)
  - `GET /api/companies/me` (Company)
  - `PUT /api/companies/me` (Company)
- Config:
  - `GET /api/config/me` (Company/Manager1/Manager2)
  - `PUT /api/config/me` (Company)
- Water:
  - `POST /api/water/reading` (Company/Manager1/Manager2)
  - `GET /api/water/readings` (role-based scope)
  - `GET /api/water/stats` (role-based scope)

## Notes

- On first run, roles are auto-seeded.
- Registration policy:
  - First registered user becomes **SuperAdmin**
  - After that, registration is restricted unless `ALLOW_OPEN_REGISTRATION=true`

