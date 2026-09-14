# ASign

ASign uses a conventional MERN monorepo layout:

- `frontend/` — React and Vite user interface
- `backend/` — Express API and MongoDB connection

## Development

Install packages from the repository root:

```bash
npm install
```

Copy `backend/.env.example` to `backend/.env` and update the MongoDB connection when needed. Then start both applications:

```bash
npm run dev
```

The frontend runs at `http://127.0.0.1:5173` and the API runs at `http://127.0.0.1:5000`.
