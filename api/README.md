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
   that emits `log` messages while `yt-dlp` runs and concludes with a `complete` event containing a
   `token` and `filename`.
2. Exchange the token for the audio bytes via `GET /download/{token}`. The response is an MP3 file
   with a `Content-Disposition` header set for the original filename.
