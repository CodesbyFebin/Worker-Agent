import type { Express, Request, Response } from "express";

const SITEMAP_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://workeragent.cloud";

const sitemapUrls = [
  { path: "/", priority: 1.0, freq: "daily" },
  { path: "/features", priority: 0.9, freq: "weekly" },
  { path: "/docs", priority: 0.9, freq: "weekly" },
  { path: "/docs/getting-started", priority: 0.8, freq: "monthly" },
  { path: "/docs/architecture", priority: 0.7, freq: "yearly" },
  { path: "/docs/configuration", priority: 0.7, freq: "yearly" },
  { path: "/docs/mcp/tools", priority: 0.7, freq: "yearly" },
  { path: "/docs/api", priority: 0.6, freq: "monthly" },
  { path: "/changelog", priority: 0.5, freq: "weekly" },
  { path: "/license", priority: 0.3, freq: "yearly" },
];

function generateSitemap(): string {
  const date = new Date().toISOString();
  const urls = sitemapUrls
    .map(
      (u) => `
  <url>
    <loc>${SITEMAP_BASE}${u.path}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function registerRobotsRoutes(app: Express): void {
  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.type("text/plain").send(
      `User-agent: *
Allow: /

User-agent: Googlebot
Allow: /docs/
Allow: /api/

Sitemap: ${SITEMAP_BASE}/sitemap.xml
`
    );
  });

  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    res.type("application/xml").send(generateSitemap());
  });
}
