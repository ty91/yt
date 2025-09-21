## Overview

- Web frontend: `web/` — connects to a local API at `http://localhost:6172`.
- API server: `api/` — runs on your machine (no container/orchestrator assumed).

## Local Development

Run the API at port 6172:

```bash
cd api
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 6172 --reload
```

Run the web app (Vite dev server at 5173):

```bash
cd web
pnpm install
pnpm dev
```

The frontend will only render after it can reach `GET http://localhost:6172/health`.
