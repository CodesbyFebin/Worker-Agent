import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Worker Agent.Cloud Documentation',
  description: 'Mission Control for AI-powered content networks',
  base: '/docs/',
  outDir: '../client/dist/docs',
  ignoreDeadLinks: true,
  build: {
    sitemap: {
      hostname: 'https://workeragent.cloud',
    },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#1a1a2e' }],
    ['meta', { property: 'og:title', content: 'Worker Agent.Cloud Documentation' }],
    ['meta', { property: 'og:description', content: 'Mission Control for AI-powered content networks' }],
    ['meta', { property: 'og:type', content: 'website' }],
  ],
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Configuration', link: '/configuration/' },
      { text: 'MCP Integration', link: '/mcp/tools/' },
      { text: 'API', link: '/api/endpoint-reference/' },
      { text: 'Development', link: '/development/' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Quick Start', link: '/getting-started/' },
        ],
      },
      {
        text: 'Documentation',
        items: [
          { text: 'Architecture', link: '/architecture/' },
          { text: 'Configuration', link: '/configuration/' },
        ],
      },
      {
        text: 'MCP Integration',
        items: [
          { text: 'MCP Overview', link: '/mcp/overview/' },
          { text: 'MCP Tools Catalog', link: '/mcp/tools/' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Endpoint Reference', link: '/api/endpoint-reference/' },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Development Guide', link: '/development/' },
          { text: 'Codebase Structure', link: '/codebase-structure/' },
        ],
      },
    ],
    editLink: {
      pattern: 'https://github.com/Cyberteckmaster/Worker-Agent/edit/main/:path',
      text: 'Edit on GitHub'
    },
  },
});
