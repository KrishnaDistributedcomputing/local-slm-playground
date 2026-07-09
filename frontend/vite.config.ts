import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

const azureAllowedHosts = [
  'slm-notify-hub-a6y7xc7.canadaeast.azurecontainer.io',
  'slm-notify-troubleshoot-a6y7xc7.canadaeast.azurecontainer.io',
  'slm-notify-compact-a6y7xc7.canadaeast.azurecontainer.io',
  'slm-notify-local-a6y7xc7.canadaeast.azurecontainer.io',
  'slm-notify-explain-a6y7xc7.canadaeast.azurecontainer.io',
  'slm-notify-secure-a6y7xc7.canadaeast.azurecontainer.io',
  'model-comparison-a6y7xc7.canadaeast.azurecontainer.io',
  'model-comparison-guide-a6y7xc7.canadaeast.azurecontainer.io',
  'model-comparison-tech-a6y7xc7.canadaeast.azurecontainer.io',
  'model-comparison-lens-a6y7xc7.canadaeast.azurecontainer.io',
  'slm-evaluator-data-a6y7xc7.canadaeast.azurecontainer.io',
];

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: azureAllowedHosts,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: azureAllowedHosts,
  },
});
