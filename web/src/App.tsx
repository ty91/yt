import { type FormEvent, useEffect, useRef, useState } from 'react';

const API_BASE = 'http://localhost:6172';

type SsePayload = {
  type: 'log' | 'error' | 'complete';
  message?: string;
  filename?: string;
};

type LogEntry = {
  message: string;
  kind: 'progress' | 'log';
};

function parseSseData(raw: string | null): SsePayload | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SsePayload;
  } catch (error) {
    console.warn('Failed to parse SSE payload', error, raw);
    return null;
  }
}

export function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedDest, setSelectedDest] = useState<string | null>(() => {
    return localStorage.getItem('destDir') || null;
  });
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<string>('~');
  const [browseEntries, setBrowseEntries] = useState<{ name: string; path: string }[]>([]);
  const [browseParent, setBrowseParent] = useState<string | null>(null);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting'
  );
  const [, setConnectionError] = useState<string | null>(null);
  const connectionCheckInFlight = useRef(false);
  const [copied, setCopied] = useState(false);
  const UVX_CMD = 'uvx --from "git+https://github.com/ty91/yt.git@main#subdirectory=api" yt-api';

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Attempt to connect to the local API before rendering the main app.
  // Keep pinging periodically until connected.
  useEffect(() => {
    if (connectionStatus === 'connected') {
      return;
    }

    let isCancelled = false;

    const check = async () => {
      if (connectionCheckInFlight.current || isCancelled) return;
      connectionCheckInFlight.current = true;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (!isCancelled) {
          setConnectionStatus('connected');
          setConnectionError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setConnectionStatus('error');
          setConnectionError(error instanceof Error ? error.message : 'Connection failed');
        }
      } finally {
        connectionCheckInFlight.current = false;
      }
    };

    void check();
    const intervalId = setInterval(check, 1000);
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [connectionStatus]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!videoUrl.trim()) {
      setErrorMessage('Enter a YouTube URL.');
      return;
    }
    if (!selectedDest) {
      setErrorMessage('Choose a destination directory.');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage('Preparing download…');
    setLogs([]);

    const params = new URLSearchParams({ url: videoUrl.trim() });
    if (selectedDest) params.set('dest', selectedDest);
    const eventSource = new EventSource(`${API_BASE}/download/stream?${params.toString()}`);
    eventSourceRef.current = eventSource;

    const handleFailure = (message: string) => {
      setErrorMessage(message);
      setInfoMessage(null);
      setIsSubmitting(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const handleErrorEvent = (messageEvent: Event) => {
      const payload = parseSseData((messageEvent as MessageEvent).data ?? null);
      const detail = payload?.message ?? 'Download failed.';
      handleFailure(detail);
    };

    eventSource.addEventListener('error', handleErrorEvent);

    eventSource.onmessage = (messageEvent) => {
      const payload = parseSseData(messageEvent.data);
      if (payload?.type === 'log' && payload.message) {
        const message = payload.message;
        if (message.startsWith('[download]')) {
          setLogs((existing) => {
            const next = [...existing];
            let replaced = false;
            for (let index = next.length - 1; index >= 0; index -= 1) {
              if (next[index].kind === 'progress') {
                next[index] = { kind: 'progress', message };
                replaced = true;
                break;
              }
            }
            if (!replaced) {
              next.push({ kind: 'progress', message });
            }
            return next;
          });
        } else {
          setLogs((existing) => [...existing, { kind: 'log', message }]);
        }
      }
    };

    eventSource.addEventListener('complete', async (messageEvent) => {
      eventSource.removeEventListener('error', handleErrorEvent);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      const payload = parseSseData((messageEvent as MessageEvent).data);
      if (!payload?.filename) {
        handleFailure('Download filename missing.');
        return;
      }
      try {
        const filename = payload.filename;
        const dest = selectedDest ?? '~';
        setInfoMessage(`Saved to ${dest}/${filename}`);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  if (connectionStatus !== 'connected') {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 pb-12 pt-16 text-center sm:pt-24">
          <div className="w-full text-left sm:text-center">
            <h1 className="text-3xl font-semibold">YouTube to MP3</h1>
            <p className="mt-2 text-sm text-slate-300">connecting to the api on localhost:6172</p>
            <div className="mx-auto mt-4 h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            <div className="mt-8 text-left">
              <p className="text-sm text-slate-300">Start the local API with:</p>
              <div className="mt-2 flex items-center gap-2">
                <pre className="flex-1 overflow-x-auto rounded-md border border-slate-700 bg-slate-900 p-3 text-left font-mono text-xs text-slate-200">
                  {UVX_CMD}
                </pre>
                <button
                  type="button"
                  className="shrink-0 rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(UVX_CMD);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      // noop
                    }
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 pb-12 pt-16 text-center sm:pt-24">
        <div className="w-full text-left sm:text-center">
          <h1 className="text-3xl font-semibold">YouTube to MP3</h1>
          <p className="mt-2 text-sm text-slate-300">
            Paste a YouTube link to stream the download logs and receive the audio.
          </p>
        </div>
        <form className="flex w-full flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Destination directory
              </p>
              <p className="text-xs text-slate-400">
                {selectedDest ? selectedDest : 'Not selected'}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-600"
              onClick={async () => {
                setIsBrowseOpen(true);
                const startPath = selectedDest || '~';
                setBrowsePath(startPath);
                setIsBrowsing(true);
                try {
                  const res = await fetch(
                    `${API_BASE}/browse?path=${encodeURIComponent(startPath)}`
                  );
                  const data = (await res.json()) as {
                    path: string;
                    parent: string | null;
                    entries: { name: string; path: string }[];
                  };
                  setBrowsePath(data.path);
                  setBrowseParent(data.parent);
                  setBrowseEntries(data.entries);
                } catch (e) {
                  setBrowseEntries([]);
                  setBrowseParent(null);
                } finally {
                  setIsBrowsing(false);
                }
              }}
            >
              Browse directories
            </button>
          </div>
          <input
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-4 py-3 text-left text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="url"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            required
            disabled={isSubmitting}
          />
          <button
            className="rounded-md bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-800"
            type="submit"
            disabled={isSubmitting || !selectedDest}
          >
            {isSubmitting ? 'Downloading…' : 'Download audio'}
          </button>
        </form>
        {errorMessage ? (
          <p className="text-sm text-red-400" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {infoMessage ? <p className="text-sm text-slate-200">{infoMessage}</p> : null}
        <div className="w-full rounded-md border border-slate-800 bg-slate-900/60 p-4 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Logs</p>
          <div
            className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs text-slate-200"
            aria-live="polite"
          >
            {logs.length === 0
              ? 'Logs will appear here…'
              : logs.map((entry, index) => (
                  <div
                    key={`${entry.kind}-${index}`}
                    className={entry.kind === 'progress' ? 'text-blue-300' : undefined}
                  >
                    {entry.message}
                  </div>
                ))}
          </div>
        </div>
      </section>
      {isBrowseOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-4 text-left">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Choose a directory</h2>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
                onClick={() => setIsBrowseOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mb-3 text-sm text-slate-300">Current: {browsePath}</div>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-md bg-slate-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
                disabled={!browseParent}
                onClick={async () => {
                  if (!browseParent) return;
                  setIsBrowsing(true);
                  try {
                    const res = await fetch(
                      `${API_BASE}/browse?path=${encodeURIComponent(browseParent)}`
                    );
                    const data = await res.json();
                    setBrowsePath(data.path);
                    setBrowseParent(data.parent);
                    setBrowseEntries(data.entries);
                  } catch {}
                  setIsBrowsing(false);
                }}
              >
                Up
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-500"
                onClick={() => {
                  setSelectedDest(browsePath);
                  try {
                    localStorage.setItem('destDir', browsePath);
                  } catch {}
                  setIsBrowseOpen(false);
                }}
              >
                Select this folder
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-800">
              {isBrowsing ? (
                <div className="p-3 text-sm text-slate-400">Loading…</div>
              ) : browseEntries.length === 0 ? (
                <div className="p-3 text-sm text-slate-400">No subdirectories</div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {browseEntries.map((entry) => (
                    <li key={entry.path}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                        onClick={async () => {
                          setIsBrowsing(true);
                          try {
                            const res = await fetch(
                              `${API_BASE}/browse?path=${encodeURIComponent(entry.path)}`
                            );
                            const data = await res.json();
                            setBrowsePath(data.path);
                            setBrowseParent(data.parent);
                            setBrowseEntries(data.entries);
                          } catch {}
                          setIsBrowsing(false);
                        }}
                      >
                        <span className="truncate">{entry.name}</span>
                        <span className="text-slate-400">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
