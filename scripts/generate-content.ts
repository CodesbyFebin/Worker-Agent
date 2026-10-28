import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentManifest } from "../content/manifest.js";
import type { ContentRecord } from "../content/types.js";
import { isContentIndexable } from "../content/utils.js";
import { validateContentManifest } from "../content/validation.js";

const root = process.cwd();
const distDir = path.join(root, "client", "dist");
const siteUrl = "https://workeragent.cloud";
const generatedStart = "# BEGIN GENERATED LEARN";
const generatedEnd = "# END GENERATED LEARN";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeXml(value: string): string {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function renderInline(value: string): string {
  let rendered = escapeHtml(value);
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  rendered = rendered.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+|\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
    const external = url.startsWith("https://");
    return `<a href="${escapeHtml(url)}"${external ? ' rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  return rendered;
}

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isBlockStart(line: string): boolean {
  return (
    line.trim() === "" ||
    /^#{1,3}\s/.test(line) ||
    /^```/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^---+$/.test(line.trim())
  );
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1]?.length ?? 2;
      const label = heading[2] ?? "";
      const id = slugifyHeading(label);
      out.push(`<h${level} id="${id}">${renderInline(label)}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim().replace(/[^a-z0-9_-]/gi, "");
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      out.push(`<pre><code${language ? ` class="language-${language}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^[-*]\s+/, ""));
        index += 1;
      }
      out.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      out.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quote.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      out.push(`<blockquote>${quote.map(renderInline).join(" ")}</blockquote>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push("<hr>");
      index += 1;
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && !isBlockStart(lines[index] ?? "")) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return out.join("\n");
}

function pagePath(slug: string): string {
  return `/${slug}/`;
}

function renderEvidence(page: ContentRecord): string {
  const items = page.evidence
    .map(
      (item) => `<li><a href="${escapeHtml(item.url)}" rel="noopener noreferrer">${escapeHtml(item.title)}</a><span>${escapeHtml(item.publisher)} · checked ${escapeHtml(item.lastChecked)}</span></li>`,
    )
    .join("");
  return `<aside class="evidence" aria-labelledby="evidence-heading"><h2 id="evidence-heading">Evidence used for this page</h2><p>Claims on this page are limited to the sources reviewed below. Unknown or unverified details are not filled in.</p><ul>${items}</ul></aside>`;
}

function renderRelated(page: ContentRecord, records: ContentRecord[]): string {
  const bySlug = new Map(records.map((record) => [record.slug, record]));
  const items = page.relatedPages
    .map((slug) => bySlug.get(slug))
    .filter((record): record is ContentRecord => Boolean(record && isContentIndexable(record)))
    .map((record) => `<li><a href="${pagePath(record.slug)}">${escapeHtml(record.title)}</a><span>${escapeHtml(record.description)}</span></li>`)
    .join("");
  return items ? `<section class="related"><h2>Related Worker Agent guides</h2><ul>${items}</ul></section>` : "";
}

function renderPage(page: ContentRecord, markdown: string, records: ContentRecord[]): string {
  const body = renderMarkdown(markdown);
  const canonical = page.canonicalUrl ?? `${siteUrl}${pagePath(page.slug)}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.description,
    dateModified: page.lastReviewed,
    mainEntityOfPage: canonical,
    isPartOf: { "@type": "WebSite", name: "Worker Agent", url: `${siteUrl}/` },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Worker Agent", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Learn", item: `${siteUrl}/learn/` },
      { "@type": "ListItem", position: 3, name: page.title, item: canonical },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.title)} | Worker Agent</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:site_name" content="Worker Agent">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="/learn.css">
  <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
</head>
<body>
  <header class="site-header"><a class="brand" href="/">Worker Agent</a><nav aria-label="Primary"><a href="/learn/">Learn</a><a href="https://github.com/CodesbyFebin/Worker-Agent" rel="noopener noreferrer">GitHub</a><a class="launch" href="/dashboard">Mission Control</a></nav></header>
  <main>
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/learn/">Learn</a><span>/</span><span aria-current="page">${escapeHtml(page.title)}</span></nav>
    <article>
      <p class="eyebrow">Evidence-reviewed guide · ${escapeHtml(page.pillarId)} / ${escapeHtml(page.clusterId)}</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p class="lede">${escapeHtml(page.description)}</p>
      <p class="reviewed">Last reviewed ${escapeHtml(page.lastReviewed ?? "unknown")}. This page distinguishes general guidance from Worker Agent implementation details.</p>
      <div class="article-body">${body}</div>
      ${renderEvidence(page)}
      ${renderRelated(page, records)}
    </article>
  </main>
  <footer><p>Worker Agent · evidence-first autonomous content operations.</p><p><a href="/">Product</a> · <a href="/learn/">Learn</a> · <a href="https://github.com/CodesbyFebin/Worker-Agent" rel="noopener noreferrer">Source</a></p></footer>
</body>
</html>`;
}

function renderLearnHub(records: ContentRecord[]): string {
  const cards = records
    .map((record) => `<li><a href="${pagePath(record.slug)}"><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml(record.description)}</span></a></li>`)
    .join("");
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Worker Agent Learn",
    description: "Evidence-reviewed guides to AI worker agents, architecture, implementation, security, governance, observability, and self-hosting.",
    url: `${siteUrl}/learn/`,
  };
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Worker Agent Learn | Evidence-Reviewed AI Worker Agent Guides</title><meta name="description" content="Evidence-reviewed guides to AI worker agents, architecture, implementation, security, governance, observability, and self-hosting."><meta name="robots" content="index,follow"><link rel="canonical" href="${siteUrl}/learn/"><link rel="stylesheet" href="/learn.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><header class="site-header"><a class="brand" href="/">Worker Agent</a><nav aria-label="Primary"><a href="/learn/" aria-current="page">Learn</a><a href="https://github.com/CodesbyFebin/Worker-Agent" rel="noopener noreferrer">GitHub</a><a class="launch" href="/dashboard">Mission Control</a></nav></header><main><section class="hub"><p class="eyebrow">Worker Agent Learn</p><h1>Evidence-reviewed guides to AI worker agents</h1><p class="lede">The Learn hub publishes only pages that pass Worker Agent's publication, evidence, canonical, and static-rendering gates. Planned taxonomy entries do not automatically become URLs.</p><ul class="guide-grid">${cards}</ul></section></main><footer><p>Worker Agent · evidence-first autonomous content operations.</p></footer></body></html>`;
}

async function readOptional(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

function withoutGeneratedSection(value: string): string {
  const start = value.indexOf(generatedStart);
  if (start < 0) return value.trim();
  return value.slice(0, start).trim();
}

async function generateDiscoveryFiles(records: ContentRecord[], markdownBySlug: Map<string, string>): Promise<void> {
  const urls = [
    { loc: `${siteUrl}/`, lastmod: "2026-08-16" },
    { loc: `${siteUrl}/learn/`, lastmod: "2026-08-16" },
    ...records.map((record) => ({ loc: record.canonicalUrl ?? `${siteUrl}${pagePath(record.slug)}`, lastmod: record.lastReviewed ?? "2026-08-16" })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((item) => `  <url><loc>${escapeXml(item.loc)}</loc><lastmod>${escapeXml(item.lastmod)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  await writeFile(path.join(distDir, "sitemap.xml"), sitemap, "utf8");

  const learnLines = records.map((record) => `- [${record.title}](${record.canonicalUrl}) — ${record.description}`).join("\n");
  const baseLlms = withoutGeneratedSection(await readOptional(path.join(distDir, "llms.txt")));
  await writeFile(path.join(distDir, "llms.txt"), `${baseLlms}\n\n${generatedStart}\n## Evidence-reviewed Learn pages\n${learnLines}\n${generatedEnd}\n`, "utf8");

  const full = records
    .map((record) => `## ${record.title}\nCanonical: ${record.canonicalUrl}\nReviewed: ${record.lastReviewed}\n\n${markdownBySlug.get(record.slug) ?? ""}\n\nEvidence:\n${record.evidence.map((item) => `- ${item.title}: ${item.url}`).join("\n")}`)
    .join("\n\n---\n\n");
  const baseFull = withoutGeneratedSection(await readOptional(path.join(distDir, "llms-full.txt")));
  await writeFile(path.join(distDir, "llms-full.txt"), `${baseFull}\n\n${generatedStart}\n# Worker Agent Learn — evidence-reviewed content\n\n${full}\n${generatedEnd}\n`, "utf8");
}

async function main(): Promise<void> {
  await validateContentManifest(contentManifest);
  const indexable = contentManifest.filter(isContentIndexable);
  await mkdir(distDir, { recursive: true });

  try {
    await copyFile(path.join(root, "client", "public", "learn.css"), path.join(distDir, "learn.css"));
  } catch {
    throw new Error("client/public/learn.css is required before content generation");
  }

  const markdownBySlug = new Map<string, string>();
  for (const page of indexable) {
    const markdown = await readFile(path.resolve(root, page.contentFile), "utf8");
    markdownBySlug.set(page.slug, markdown);
    const outputDir = path.join(distDir, ...page.slug.split("/"));
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, "index.html"), renderPage(page, markdown, indexable), "utf8");
    console.log(`Generated /${page.slug}/`);
  }

  const learnDir = path.join(distDir, "learn");
  await mkdir(learnDir, { recursive: true });
  await writeFile(path.join(learnDir, "index.html"), renderLearnHub(indexable), "utf8");
  await generateDiscoveryFiles(indexable, markdownBySlug);
  console.log(`Content generation complete: ${indexable.length} indexable pages + /learn/.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
