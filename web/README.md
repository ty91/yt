# Vite React App

This project now runs on a plain Vite + React stack with Tailwind CSS for styling.

## Local API Connection

The app expects a local API server at `http://localhost:6172` and will:

- Show a connection screen while checking `GET /health`.
- Only render the main UI after a successful health check.
- Use the local API for `/download/stream` (SSE) and `/download/{filename}`.

Notes:

- If you deploy the frontend over HTTPS, browsers will block requests to an HTTP local server. Run the local API with HTTPS or serve the frontend over HTTP during development.
- The local API must enable CORS for the frontend’s origin so cross-origin requests (including SSE) succeed.

## Getting Started

Install dependencies with pnpm:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

## Production Build

Create an optimized build:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

### Docker

Build and run with Docker:

```bash
docker build -t my-app .
docker run -p 4173:4173 my-app
```

The container runs `pnpm start`, which serves the contents of `dist/` using Vite preview.
