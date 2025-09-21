# API

Simple FastAPI service that will host endpoints for the downloader backend.

## Setup

```bash
uv sync
```

## Run the development server

```bash
# Option A: run uvicorn directly
uv run uvicorn main:app --host 0.0.0.0 --port 6172 --reload

# Option B: run the module (defaults to port 6172)
uv run python main.py
```

## Health check

Send a request to `GET http://localhost:6172/health`.

## Streaming download flow

1. Start a download with `GET /download/stream?url=<youtube-url>`. The response is an SSE stream
   that resolves the final filename up front, reuses an existing cached file when present (and
   refreshes its timestamp), or runs `yt-dlp` while emitting log lines. When complete, it sends the
   output `filename` located in `api/download/`.
2. Retrieve the MP3 via `GET /download/{filename}`. The response streams the file with a
   `Content-Disposition` header.

## CORS

For development, CORS is enabled only for `http://localhost:5173` (Vite dev server).
