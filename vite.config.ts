import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from https://<user>.github.io/<repo>/.
// Set VITE_BASE (e.g. "/mental-rotation/") at build time for Pages;
// defaults to "/" for local dev and user/organization root pages.
export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
