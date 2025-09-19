import { type FormEvent, useEffect, useRef, useState } from 'react';

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

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!videoUrl.trim()) {
      setErrorMessage('Enter a YouTube URL.');
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

    const encodedUrl = encodeURIComponent(videoUrl.trim());
    const eventSource = new EventSource(`/download/stream?url=${encodedUrl}`);
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
        setInfoMessage('Finalizing download…');
        const filename = payload.filename;
        const response = await fetch(`/download/${encodeURIComponent(filename)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch audio file.');
        }
        const blob = await response.blob();
        triggerBrowserDownload(blob, filename);
        setInfoMessage('Download started. Check your downloads folder.');
      } catch (error) {
        if (error instanceof Error) {
          handleFailure(error.message);
        } else {
          handleFailure('Unexpected error.');
        }
        return;
      } finally {
        setIsSubmitting(false);
      }
    });
  };

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
            disabled={isSubmitting}
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
    </main>
  );
}

export default App;
