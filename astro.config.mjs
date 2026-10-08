// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { buildLastmodMap } from './sitemap-lastmod.mjs';

const lastmod = buildLastmodMap();

// https://astro.build/config
export default defineConfig({
  site: 'https://cornfedbucks.com',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap({
      filter: (page) => page !== 'https://cornfedbucks.com/thanks/',
      serialize(item) {
        const date = lastmod.get(item.url);
        if (date) item.lastmod = date;
        return item;
      },
    })],
});
