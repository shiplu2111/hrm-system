import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const portalUi = fileURLToPath(
  new URL('../../packages/portal-ui/src/components/ui', import.meta.url),
);
const appSrc = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: [
      { find: '@/components/ui', replacement: portalUi },
      { find: '@', replacement: appSrc },
    ],
  },
});
