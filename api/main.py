import asyncio
import json
import secrets
import tempfile
from pathlib import Path
from threading import Lock
from typing import AsyncIterator
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import HttpUrl

app = FastAPI()


def _build_command(url: str, output_template: str) -> list[str]:
    return [
        "yt-dlp",
        url,
        "-f",
        "bestaudio/best",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--newline",
        "--no-playlist",
        "--output",
        output_template,
    ]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


_download_store: dict[str, tuple[str, bytes]] = {}
_download_store_lock = Lock()


def _build_content_disposition(filename: str) -> str:
    sanitized = filename.replace('"', "").replace("\r", " ").replace("\n", " ")
    ascii_fallback = sanitized.encode("ascii", "ignore").decode("ascii") or "audio.mp3"
    encoded = quote(sanitized)
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


async def _stream_download(url: str) -> AsyncIterator[str]:
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_template = str(Path(tmp_dir) / "%(title)s.%(ext)s")
            command = _build_command(url, output_template)
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            assert process.stdout is not None

            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                text = line.decode(errors="ignore").strip()
                if not text or text.startswith("WARNING:"):
                    continue
                payload = json.dumps({"type": "log", "message": text})
                yield f"data: {payload}\n\n"

            return_code = await process.wait()
            if return_code != 0:
                detail = f"yt-dlp exited with status {return_code}"
                payload = json.dumps({"type": "error", "message": detail})
                yield f"event: error\ndata: {payload}\n\n"
                return

            files = list(Path(tmp_dir).glob("*"))
            if not files:
                payload = json.dumps({"type": "error", "message": "No audio file produced"})
                yield f"event: error\ndata: {payload}\n\n"
                return

            audio_file = files[0]
            audio_bytes = audio_file.read_bytes()
            filename = audio_file.name

        token = secrets.token_urlsafe(16)
        with _download_store_lock:
            _download_store[token] = (filename, audio_bytes)

        payload = json.dumps({"type": "complete", "token": token, "filename": filename})
        yield f"event: complete\ndata: {payload}\n\n"
    except Exception as exc:  # pragma: no cover - defensive fallback
        payload = json.dumps({"type": "error", "message": str(exc)})
        yield f"event: error\ndata: {payload}\n\n"


@app.get("/download/stream")
async def download_stream(url: HttpUrl) -> StreamingResponse:
    return StreamingResponse(_stream_download(str(url)), media_type="text/event-stream")


@app.get("/download/{token}")
def fetch_download(token: str) -> Response:
    with _download_store_lock:
        payload = _download_store.pop(token, None)

    if payload is None:
        raise HTTPException(status_code=404, detail="Download not found")

    filename, audio_bytes = payload
    headers = {"Content-Disposition": _build_content_disposition(filename)}
    # TODO: Stream the file to avoid loading into memory twice.
    return Response(content=audio_bytes, media_type="audio/mpeg", headers=headers)


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
