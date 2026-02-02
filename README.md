# Route Optimizer (LangGraph + OR-Tools + ORS + Neon)

## Overview

- Backend batch optimizer runs in GitHub Actions.
- Frontend (Netlify) triggers a GitHub `repository_dispatch` and polls results from Neon.

## Environment variables

### GitHub Actions

- `DATABASE_URL` (Neon Postgres connection string)
- `ORS_API_KEY` (OpenRouteService API key)
- `OPENAI_API_KEY` (optional)

### Netlify

- `DATABASE_URL`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN` (PAT with permission to trigger repository dispatch)

## Database

Apply `backend/schema.sql` to Neon.

## Frontend

- `npm install`
- `npm run dev`

## Trigger flow

1. UI calls `/api/dispatch` to create a pending job in Neon and trigger GitHub Actions.
2. Actions runs `backend/optimizer.py` for that `pending_route_id`.
3. UI polls `/api/result?id=...` until an `optimized_routes` row exists.
