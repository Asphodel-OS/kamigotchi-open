import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// vite.config exports a function of the mode: resolve it with vitest's env before merging
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'node',
      setupFiles: ['./src/test/setup.ts'],
    },
  })
);
