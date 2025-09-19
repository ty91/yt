# Vite React App

This project now runs on a plain Vite + React stack with Tailwind CSS for styling.

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
