import dsv from '@rollup/plugin-dsv';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// lets the page reach the gas sponsor server, only on builds that are configured to use one
const allowGasSponsor = (url?: string): Plugin => ({
  name: 'allow-gas-sponsor',
  transformIndexHtml(html) {
    if (!url) return html;
    return html.replace("connect-src 'self'", `connect-src 'self' ${new URL(url).origin}`);
  },
});

const MAIN_WORLD_ADDRESS = '0x2729174c265dbbd8416c6449e0e813e88f43d0e7';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // same source the app reads import.meta.env from: .env files, then the build environment
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const gasSponsorUrl = env.VITE_GAS_SPONSOR_URL || process.env.VITE_GAS_SPONSOR_URL;
  const worldAddress = (env.VITE_WORLD_ADDRESS || process.env.VITE_WORLD_ADDRESS || '').toLowerCase();
  // gas sponsorship is an event-only tool (scripts/gas-sponsor/README.md): never on the main world
  if (gasSponsorUrl && worldAddress === MAIN_WORLD_ADDRESS) {
    throw new Error('VITE_GAS_SPONSOR_URL must not be set on a main-world build');
  }

  return {
    plugins: [
      dsv(),
      react(),
      allowGasSponsor(gasSponsorUrl),
      // Add bundle analyzer in dev
      !!process.env.ANALYZE &&
        visualizer({
          filename: 'dist/bundle-analysis.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    assetsInclude: ['**/*.gif', '**/*.jpg', '**/*.mp3', '**/*.png', '**/*.wav', '**/*.webp'],
    build: {
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 1000, // Warn at 1MB instead of 500KB
      // Performance budgets
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('/react/')) {
                return 'react-vendor';
              }
              if (id.includes('chart.js')) {
                return 'chart-vendor';
              }
              if (
                (id.includes('@initia/') || id.includes('@cosmjs/')) &&
                !id.includes('interwovenkit-react')
              ) {
                return 'cosmos-vendor';
              }
              if (id.includes('antd') || id.includes('@mui/')) {
                return 'ui-vendor';
              }
              if (id.includes('/three/')) {
                return 'three-vendor';
              }
              if (id.includes('ethers')) {
                return 'ethers-vendor';
              }
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        abi: path.resolve(__dirname, './abi'),
        src: path.resolve(__dirname, './src'),
        types: path.resolve(__dirname, './types'),
        app: path.resolve(__dirname, './src/app'),
        assets: path.resolve(__dirname, './src/assets'),
        cache: path.resolve(__dirname, './src/cache'),
        clients: path.resolve(__dirname, './src/clients'),
        constants: path.resolve(__dirname, './src/constants'),
        engine: path.resolve(__dirname, './src/engine'),
        network: path.resolve(__dirname, './src/network'),
        utils: path.resolve(__dirname, './src/utils'),
        workers: path.resolve(__dirname, './src/workers'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    server: {
      headers: {
        'Strict-Transport-Security': 'max-age=86400; includeSubDomains', // Adds HSTS options, with a expiry time of 1 day
        'X-Content-Type-Options': 'nosniff', // Protects from improper scripts runnings
        'X-Frame-Options': 'DENY', // Stops site being used as an iframe
        'X-XSS-Protection': '1; mode=block', // Gives XSS protection to legacy browsers
      },
    },
    optimizeDeps: {
      exclude: ['js-big-decimal'],
    },
  };
});
