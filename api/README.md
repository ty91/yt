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

## Run anywhere with `uvx`

You can run the API without cloning the repo using `uvx` from a VCS URL. Requirements: Python 3.9+, `uv`, and `ffmpeg` on `PATH`.

Examples (replace `<OWNER>/<REPO>` and branch/tag as needed):

```bash
# Run directly from GitHub via VCS URL, pointing to the api/ subdirectory
uvx --from "git+https://github.com/<OWNER>/<REPO>.git@main#subdirectory=api" yt-api

# Pin a tag or commit
uvx --from "git+https://github.com/<OWNER>/<REPO>.git@v0.1.0#subdirectory=api" yt-api
```

The CLI `yt-api` entry point starts Uvicorn on port 6172.
