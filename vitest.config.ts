import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

const viteConfigForTest =
  typeof viteConfig === 'function'
    ? await viteConfig({ command: 'serve', mode: 'test' })
    : await viteConfig;

export default mergeConfig(
  viteConfigForTest,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }),
);
