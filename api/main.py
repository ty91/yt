import asyncio
import json
import logging
import os
from pathlib import Path
from typing import AsyncIterator, Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import HttpUrl

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://yt.dogu.ooo"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

# No internal download cache; files are written directly to the selected destination

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
    logger.info(command)
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


async def _stream_download(url: str, dest: Optional[str]) -> AsyncIterator[str]:
    try:
        # Resolve destination directory (required; restricted to user home)
        if not dest or not dest.strip():
            raise ValueError("Destination directory is required")
        candidate = Path(dest).expanduser().resolve()
        home = Path.home().resolve()
        try:
            if not candidate.exists():
                candidate.mkdir(parents=True, exist_ok=True)
            if not candidate.is_dir() or not candidate.is_relative_to(home):
                raise ValueError("Destination must be a directory under the home folder")
            destination_dir = candidate
        except Exception as e:  # pragma: no cover - validated and surfaced via SSE
            raise ValueError(str(e))
        filename = await _resolve_output_filename(url)
        destination = destination_dir / filename

        if destination.exists():
            os.utime(destination, None)
            payload = json.dumps({"type": "log", "message": f"Using cached audio for {filename}"})
            yield f"data: {payload}\n\n"
        else:
            command = _base_command(url) + ["--output", str(destination)]
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

            if not destination.exists():
                payload = json.dumps({"type": "error", "message": "No audio file produced"})
                yield f"event: error\ndata: {payload}\n\n"
                return

            os.utime(destination, None)

        payload = json.dumps({"type": "complete", "filename": filename})
        yield f"event: complete\ndata: {payload}\n\n"
    except Exception as exc:  # pragma: no cover - defensive fallback
        payload = json.dumps({"type": "error", "message": str(exc)})
        yield f"event: error\ndata: {payload}\n\n"


@app.get("/download/stream")
async def download_stream(url: HttpUrl, dest: Optional[str] = None) -> StreamingResponse:
    return StreamingResponse(_stream_download(str(url), dest), media_type="text/event-stream")


@app.get("/download/{filename}")
def fetch_download(filename: str, dest: Optional[str] = None) -> FileResponse:
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    # Resolve destination directory (required; restricted to user home)
    if not dest or not dest.strip():
        raise HTTPException(status_code=400, detail="Destination directory is required")
    candidate = Path(dest).expanduser().resolve()
    home = Path.home().resolve()
    if not candidate.is_dir() or not candidate.is_relative_to(home):
        raise HTTPException(status_code=400, detail="Invalid destination directory")
    destination_dir = candidate
    destination = destination_dir / filename
    if not destination.exists():
        raise HTTPException(status_code=404, detail="Download not found")

    headers = {"Content-Disposition": _build_content_disposition(filename)}
    return FileResponse(destination, media_type="audio/mpeg", headers=headers)


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=6172)


def _tildify(path: Path) -> str:
    try:
        home = Path.home().resolve()
        resolved = path.resolve()
        return f"~{resolved.as_posix()[len(home.as_posix()) :]}" if resolved.is_relative_to(home) else str(resolved)
    except Exception:
        return str(path)


@app.get("/browse")
def browse(path: Optional[str] = None) -> dict:
    """List subdirectories of the given path, restricted to the user's home.

    Query params:
      - path: string path, may include '~'. Defaults to '~'.

    Returns JSON with: { path, parent, entries: [{ name, path }] }
    where paths are tildified (start with '~').
    """
    base = Path.home().resolve()
    target = Path(path or "~").expanduser().resolve()
    if not target.exists() or not target.is_dir() or not target.is_relative_to(base):
        target = base

    entries = []
    try:
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower()):
            if child.is_dir():
                entries.append({"name": child.name, "path": _tildify(child)})
    except PermissionError:
        entries = []

    parent = target.parent if target != base else None
    return {
        "path": _tildify(target),
        "parent": _tildify(parent) if parent else None,
        "entries": entries,
    }


if __name__ == "__main__":
    main()
