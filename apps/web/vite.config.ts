import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const gatewayTarget = process.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:4402';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@route402/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/x402': gatewayTarget,
      '/discover': gatewayTarget,
      '/.well-known': gatewayTarget,
      '/api': gatewayTarget,
      '/health': gatewayTarget,
    },
  },
});
