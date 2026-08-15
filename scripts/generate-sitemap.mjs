/**
 * Generate sitemap.xml for Worker Agent.Cloud
 * Run: node scripts/generate-sitemap.mjs > public/sitemap.xml
 */

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://workeragent.cloud';

const pages = [
  '/',
  '/about',
  '/features',
  '/docs',
  '/docs/getting-started',
  '/docs/architecture',
  '/docs/configuration',
  '/docs/mcp/tools',
  '/docs/api',
  '/api-docs'
];

function generateUrl(path, priority = 1.0, changefreq = 'weekly') {
  const date = new Date().toISOString();
  return `  <url>
    <loc>${base}${path}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const urls = [
  generateUrl('/', 1.0, 'daily'),
  generateUrl('/features', 0.9, 'weekly'),
  generateUrl('/docs', 0.9, 'weekly'),
  generateUrl('/docs/getting-started', 0.8, 'monthly'),
  generateUrl('/docs/architecture', 0.7, 'yearly'),
  generateUrl('/docs/configuration', 0.7, 'yearly'),
  generateUrl('/docs/mcp/tools', 0.7, 'yearly'),
  generateUrl('/api', 0.6, 'monthly'),
  generateUrl('/license', 0.3, 'yearly'),
  generateUrl('/changelog', 0.5, 'weekly'),
].join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

console.log(sitemap);
