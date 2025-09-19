import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import AsyncIterator
from urllib.parse import quote

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import HttpUrl

app = FastAPI()

DOWNLOAD_ROOT = Path(__file__).resolve().parent / "download"
DOWNLOAD_ROOT.mkdir(exist_ok=True)

COOKIES_PATH = Path(__file__).resolve().parent / "files" / "youtube_cookie.txt"


def _base_command(url: str) -> list[str]:
    command = [
        "yt-dlp",
        url,
        "-f",
        "bestaudio/best",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--newline",
        "--no-playlist",
    ]
    if COOKIES_PATH.is_file():
        command += ["--cookies", str(COOKIES_PATH)]
    return command


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _build_content_disposition(filename: str) -> str:
    sanitized = filename.replace('"', "").replace("\r", " ").replace("\n", " ")
    ascii_fallback = sanitized.encode("ascii", "ignore").decode("ascii") or "audio.mp3"
    encoded = quote(sanitized)
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


async def _resolve_output_filename(url: str) -> str:
    command = _base_command(url) + [
        "--output",
        "%(title)s.%(ext)s",
        "--skip-download",
        "--print",
        "filename",
    ]
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        detail = stderr.decode().strip() or stdout.decode().strip() or "Failed to resolve filename"
        raise RuntimeError(detail)

    for line in reversed(stdout.decode().splitlines()):
        stripped = line.strip()
        if stripped.endswith(".webm"):
            stripped = f"{stripped[:-5]}.mp3"
        if stripped:
            return Path(stripped).name

    raise RuntimeError("Filename not provided by yt-dlp")


async def _stream_download(url: str) -> AsyncIterator[str]:
    try:
        filename = await _resolve_output_filename(url)
        destination = DOWNLOAD_ROOT / filename

        if destination.exists():
            os.utime(destination, None)
            payload = json.dumps({"type": "log", "message": f"Using cached audio for {filename}"})
            yield f"data: {payload}\n\n"
        else:
            with tempfile.TemporaryDirectory() as tmp_dir:
                temp_path = Path(tmp_dir) / filename
                command = _base_command(url) + ["--output", str(temp_path)]
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

                if not temp_path.exists():
                    payload = json.dumps({"type": "error", "message": "No audio file produced"})
                    yield f"event: error\ndata: {payload}\n\n"
                    return

                temp_path.replace(destination)
                os.utime(destination, None)

        payload = json.dumps({"type": "complete", "filename": filename})
        yield f"event: complete\ndata: {payload}\n\n"
    except Exception as exc:  # pragma: no cover - defensive fallback
        payload = json.dumps({"type": "error", "message": str(exc)})
        yield f"event: error\ndata: {payload}\n\n"


@app.get("/download/stream")
async def download_stream(url: HttpUrl) -> StreamingResponse:
    return StreamingResponse(_stream_download(str(url)), media_type="text/event-stream")


@app.get("/download/{filename}")
def fetch_download(filename: str) -> FileResponse:
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    destination = DOWNLOAD_ROOT / filename
    if not destination.exists():
        raise HTTPException(status_code=404, detail="Download not found")

    headers = {"Content-Disposition": _build_content_disposition(filename)}
    return FileResponse(destination, media_type="audio/mpeg", headers=headers)


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
