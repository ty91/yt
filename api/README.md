# API

Simple FastAPI service that will host endpoints for the downloader backend.

## Setup

```bash
uv sync
```

## Run the development server

```bash
uv run uvicorn main:app --reload
```

## Health check

Send a request to `GET /health`.

## Streaming download flow

1. Start a download with `GET /download/stream?url=<youtube-url>`. The response is an SSE stream
   that resolves the final filename up front, reuses an existing cached file when present (and
   refreshes its timestamp), or runs `yt-dlp` while emitting log lines. When complete, it sends the
   output `filename` located in `api/download/`.
2. Retrieve the MP3 via `GET /download/{filename}`. The response streams the file with a
   `Content-Disposition` header.
