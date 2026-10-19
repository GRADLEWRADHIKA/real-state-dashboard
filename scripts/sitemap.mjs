/**
 * Build step: writes dist/sitemap.xml and dist/robots.txt for the public website the dashboard serves.
 * Published property pages come from the API (API_URL or VITE_API_URL); if it cannot be reached the
 * sitemap still lists the static pages. Crawlers are kept to the website pages, never the CRM screens.
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '../dist');
const site = (process.env.SITE_URL || process.env.URL || 'http://localhost:7340').replace(/\/+$/, '');
const api = (process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:7341').replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);
const pages = ['/', '/homes', '/about', '/contact'];
let slugs = [];
try {
  for (let page = 1; page < 50; page++) {
    const res = await fetch(`${api}/api/public/properties?limit=48&page=${page}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    slugs.push(...body.data.map((p) => p.slug));
    if (!body.meta?.hasMore) break;
  }
  console.log(`[sitemap] ${slugs.length} published properties from ${api}`);
} catch (err) {
  slugs = [];
  console.warn(`[sitemap] API not reachable (${err.message}); sitemap lists the static pages only.`);
}
const urls = [...pages, ...slugs.map((s) => `/homes/${encodeURIComponent(s)}`)];
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /$\nAllow: /homes\nAllow: /about\nAllow: /contact\nDisallow: /\n\nSitemap: ${site}/sitemap.xml\n`,
);
