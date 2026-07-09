import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site =
  process.env.PUBLIC_SITE_URL ||
  'https://example.github.io/navigator-obucheniya';

export default defineConfig({
  site,
  base: process.env.PUBLIC_BASE_PATH || '/',
  output: 'static',
  build: {
    format: 'directory',
  },
  trailingSlash: 'always',
  compressHTML: true,
  integrations: [sitemap()],
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});
