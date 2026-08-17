# SEO / AEO / GEO Publication Gates

This policy exists to prevent the topical map from becoming scaled thin content. A page may exist in planning data without being public or indexable.

## Status model

Use exactly these content states:

- `planned` — taxonomy only; no public route
- `draft` — authored but not approved; noindex / excluded from sitemap
- `evidence_review` — factual and source review in progress; noindex / excluded from sitemap
- `approved` — content approved but not necessarily deployed
- `published` — public route exists
- `retired` — removed or redirected deliberately

Indexability is a separate decision. `published` does not automatically mean `indexable`.

## Required indexability function

Every public surface should eventually consume one shared policy rather than independently deciding what enters the sitemap, internal hubs, feeds, or AI-readable exports.

Pseudo-code:

```ts
export function isContentIndexable(page: ContentRecord): boolean {
  return (
    page.publicationStatus === 'published' &&
    page.reviewStatus === 'approved' &&
    page.hasUniqueUserValue === true &&
    page.evidenceStatus !== 'missing' &&
    page.canonicalUrl !== null &&
    page.rendering === 'static-html'
  );
}
```

High-risk topics should require `evidenceStatus === 'verified'` rather than merely non-missing.

## Gate 1 — Unique search intent

A page must have a reason to exist beyond keyword variation.

Reject pages that differ only by:

- city name;
- industry token;
- role token;
- year token;
- synonym substitution;
- translated text with no real localization;
- a generated introduction wrapped around the same body.

The page must answer a distinct user problem or provide unique data, implementation guidance, evidence, examples, comparison criteria, or operational detail.

## Gate 2 — Entity fit

The page must strengthen the Worker Agent entity graph.

Primary fit:

- AI Worker Agent
- Autonomous Digital Worker
- Agent Runtime
- Mission / Task
- Orchestration
- Tools / MCP
- Model Routing
- Memory / State
- Queue / Worker Runtime
- SSE / Events
- Governance
- Evidence
- Human Approval
- Observability
- Self-Hosting
- Content Operations
- Coding Agents

Do not publish unrelated staffing, generic labor, robotics, drones, self-driving vehicle, or smart-city pages simply because the phrase "worker agent" or "autonomous system" can be inserted.

## Gate 3 — Factual evidence

Do not invent:

- customer counts;
- review scores;
- rankings;
- market-share claims;
- productivity percentages;
- cost savings;
- ROI;
- uptime;
- deployment counts;
- compliance certifications;
- case studies;
- company outcomes;
- regional adoption rates.

Every unstable factual claim needs a source and review date. Unknown remains unknown.

## Gate 4 — High-risk / YMYL review

Healthcare, finance, legal, HR, government, safety, privacy, compliance, and security pages require a higher review threshold.

They must:

- distinguish automation support from professional decision-making;
- identify human-review boundaries;
- avoid universal legal or regulatory claims;
- include jurisdiction and `lastReviewed` metadata for changing rules;
- cite primary/authoritative sources where practical;
- avoid fabricated compliance badges or certifications.

## Gate 5 — Static HTML

Indexable pages must expose their main content in initial HTML.

Required before indexability:

- `<title>`
- meta description
- canonical
- one clear H1
- direct-answer opening section
- article body
- crawlable `<a href>` internal links
- visible author/reviewer metadata where used
- visible updated/reviewed date where relevant
- JSON-LD that matches visible content

Do not rely on client-side rendering for the primary article body.

## Gate 6 — On-page answer quality

Each page should include, when useful:

1. direct answer / definition near the top;
2. scope and boundaries;
3. how it works;
4. implementation or decision framework;
5. examples grounded in reality;
6. limitations / failure modes;
7. governance or security considerations;
8. related docs and sibling links;
9. concise FAQ only when there are genuine recurring questions.

Do not optimize for an arbitrary word count. Longer is not automatically better.

## Gate 7 — Structured data accuracy

Use only schema that represents the visible page.

Typical candidates:

- `Article` / `TechArticle`
- `BreadcrumbList`
- `SoftwareApplication` where the page is genuinely about the product
- `SoftwareSourceCode` where repository/source information is central
- `FAQPage` only when the page visibly contains the same FAQ content

Do not manufacture `Product`, `Review`, `AggregateRating`, `LocalBusiness`, `Dataset`, or other schema simply to obtain richer SERP treatment.

## Gate 8 — GEO / location safety

Location pages must not be doorway pages.

A city/region page requires meaningful local value such as:

- region-specific regulations;
- supported languages;
- actual local integrations;
- local deployment constraints;
- verified local examples;
- region-specific data with a cited source.

If Worker Agent is online-only, do not create a Google Business Profile merely for SEO. Do not invent physical offices or local reviews.

## Gate 9 — Internationalization

Translated pages must be complete localized versions, not keyword-swapped copies.

When translations are truly published:

- use stable locale URLs;
- provide reciprocal `hreflang` relationships;
- self-reference each locale;
- localize examples and terminology where appropriate;
- keep canonical logic consistent with the localization strategy.

## Gate 10 — Technical SEO

Before publication verify:

- 200 response;
- correct canonical;
- index/follow state intentional;
- sitemap inclusion only when indexable;
- robots does not accidentally block an indexable page;
- no duplicate title/H1/canonical collisions;
- mobile usability;
- accessible heading hierarchy;
- LCP target <= 2.5 s;
- INP target < 200 ms;
- CLS target < 0.1;
- images have dimensions and useful alt text when informative;
- no broken internal links.

Do not add AMP solely for ranking. Use the normal fast static page unless there is a real product reason for AMP.

## Gate 11 — AEO / generative-search readiness

AEO/GEO does not mean producing every query permutation.

Prefer:

- clear definitions;
- explicit entity relationships;
- concise answer passages;
- evidence and provenance;
- original diagrams/data where available;
- stable anchors;
- descriptive headings;
- machine-readable structured data that mirrors visible content;
- accurate `llms.txt` / `llms-full.txt` references where useful.

Do not create hidden AI-only copy or keyword stuffing.

## Gate 12 — Internal links

Each published cluster page must link to:

- its pillar;
- 2–4 related cluster pages;
- one technical/docs page where relevant;
- one governance/security page for operationally sensitive subjects.

Pillar pages must expose crawlable HTML links to all approved/indexable child pages.

## Gate 13 — Sitemap contract

The sitemap is an output of publication state, not a planning manifest.

Only `isContentIndexable(page) === true` URLs belong in XML sitemaps.

Never put planned, draft, login, dashboard, account, or authenticated workspace URLs in public sitemaps.

## Gate 14 — Content QA checklist

A reviewer must answer YES to all applicable questions:

- Is the page useful if the target keyword is removed from the title?
- Does the page contain information that is materially different from sibling pages?
- Are claims supported or clearly qualified?
- Are examples real or explicitly labeled illustrative?
- Is the page within Worker Agent's entity scope?
- Are high-risk statements reviewed?
- Is the content visible without JavaScript?
- Are canonical/robots/sitemap states consistent?
- Does structured data match visible content?
- Does the page avoid fake social proof and fake local signals?

If any required answer is NO, keep the page non-indexable.
