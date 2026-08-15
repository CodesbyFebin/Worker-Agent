import { test, expect } from '@playwright/test';

test.describe('API Endpoints E2E Tests', () => {
  test.describe('Health Endpoints', () => {
    test('GET /health returns ok status', async ({ request }) => {
      const response = await request.get('http://localhost:4000/health');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('service', 'api');
      expect(body).toHaveProperty('timestamp');
    });

    test('GET /ready returns database and redis status', async ({ request }) => {
      const response = await request.get('http://localhost:4000/ready');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('ok');
      expect(body).toHaveProperty('database');
      expect(body).toHaveProperty('redis');
      expect(body).toHaveProperty('errors');
    });

    test('GET /metrics returns prometheus format', async ({ request }) => {
      const response = await request.get('http://localhost:4000/metrics');
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).toContain('http_request_total');
      expect(text).toContain('http_request_duration_ms');
    });
  });

  test.describe('Documentation Endpoints', () => {
    test('GET /sitemap.xml returns valid XML', async ({ request }) => {
      const response = await request.get('http://localhost:4000/sitemap.xml');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/xml');
      const text = await response.text();
      expect(text).toContain('<?xml version');
      expect(text).toContain('<urlset');
    });

    test('GET /robots.txt returns plain text', async ({ request }) => {
      const response = await request.get('http://localhost:4000/robots.txt');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/plain');
      const text = await response.text();
      expect(text).toContain('User-agent: *');
      expect(text).toContain('Allow: /');
    });
  });

  test.describe('MCP Catalog Endpoints', () => {
    test('server-manifest.json is valid', async ({ request }) => {
      const response = await request.get('https://raw.githubusercontent.com/Cyberteckmaster/Worker-Agent/main/mcp/server-manifest.json');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('name', 'worker-agent-cloud');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('mcpCapabilities');
      expect(body.mcpCapabilities).toHaveProperty('type', 'client');
    });
  });
});
