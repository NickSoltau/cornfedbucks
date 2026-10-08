// Builds a { url: ISO date } map for the sitemap from real dates only:
//  - blog posts: `pubDate` in frontmatter (the schema has no separate updated date)
//  - static pages: the visible "Last updated: Month D, YYYY" line in the page source
// Pages with neither (home, blog index, about, legal, hub) get no <lastmod>.
import { readdirSync, readFileSync } from 'node:fs';

const SITE = 'https://cornfedbucks.com';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function buildLastmodMap() {
  const map = new Map();

  for (const file of readdirSync('./src/content/blog')) {
    if (!/\.mdx?$/.test(file)) continue;
    const src = readFileSync(`./src/content/blog/${file}`, 'utf8');
    const m = src.match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m);
    if (m) map.set(`${SITE}/blog/${file.replace(/\.mdx?$/, '')}/`, m[1]);
  }

  for (const file of readdirSync('./src/pages')) {
    if (!file.endsWith('.astro')) continue;
    const src = readFileSync(`./src/pages/${file}`, 'utf8');
    const m = src.match(/Last updated:\s*([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/);
    const month = m && MONTHS.indexOf(m[1]) + 1;
    if (m && month > 0) {
      map.set(`${SITE}/${file.replace(/\.astro$/, '')}/`, iso(m[3], month, m[2]));
    }
  }

  return map;
}
