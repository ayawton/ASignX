# ASignX

ASignX uses React/Vite, Express/TypeScript, a private Python/FastAPI recognition
service, and Supabase PostgreSQL, Auth and Storage.

- `client/` — React and Vite user interface
- `server/` — Express API, Drizzle migrations and private recognition service

## Development

Install packages separately in `client/` and `server/`:

```bash
npm ci
```

Configure `client/.env.local` and `server/.env` from their `.env.example` files.
Install the Python requirements and private models using
[recognition setup](docs/ASignLive-Recognition.md). Start the client and API in
separate terminals:

```bash
npm run dev
```

Run `npm run recognition` in `server/` in a third terminal. The frontend normally
runs at `http://localhost:5173` and proxies `/api` to Express on port 3000.

## Deployment

Follow [the deployment guide](docs/Deployment.md) for Vercel, Railway Docker
services and Supabase. Follow [server standards](server/README.md) for migrations,
authentication and Storage. Never expose backend credentials or trained models
in browser assets. Camera frames remain transient.
