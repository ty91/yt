import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react(), tsconfigPaths()],
  server: {
    proxy: mode === 'development'
      ? {
          '/download': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
        }
      : undefined,
  },
}));
