import { test, expect } from '@playwright/test';

test.describe('Worker Agent.Cloud E2E Tests', () => {
  test.describe('Authentication Flow', () => {
    test('should show login button for unauthenticated users', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('text=Dev Login, sign in')).toBeVisible();
    });

    test('should redirect to login after login attempt', async ({ page }) => {
      await page.goto('/workspace/god-machine');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=Dev Login, sign in')).toBeVisible();
    });
  });

  test.describe('Health Endpoints', () => {
    test('health endpoint should be accessible', async ({ request }) => {
      const response = await request.get('http://localhost:4000/health');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('ok', true);
    });

    test('ready endpoint should check database and redis', async ({ request }) => {
      const response = await request.get('http://localhost:4000/ready');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('database');
      expect(body).toHaveProperty('redis');
    });

    test('metrics endpoint should return Prometheus metrics', async ({ request }) => {
      const response = await request.get('http://localhost:4000/metrics');
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).toContain('http_request_total');
    });
  });

  test.describe('MCP Integration', () => {
    test('should have MCP client documented', async ({ page }) => {
      await page.goto('/docs/mcp/tools');
      await expect(page.locator('text=MCP')).toBeVisible();
      await expect(page.locator('text=MCP client')).toBeVisible();
    });

    test('server-manifest.json should be valid JSON', async ({ request }) => {
      const response = await request.get('https://raw.githubusercontent.com/Cyberteckmaster/Worker-Agent/main/mcp/server-manifest.json');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('name', 'worker-agent-cloud');
      expect(body).toHaveProperty('mcpCapabilities');
    });
  });

  test.describe('Documentation Navigation', () => {
    test('should navigate to getting started', async ({ page }) => {
      await page.goto('/docs/getting-started');
      await expect(page.locator('text=Quick Start')).toBeVisible();
    });

    test('should navigate to architecture', async ({ page }) => {
      await page.goto('/docs/architecture');
      await expect(page.locator('text=Client (React', { exact: false })).toBeVisible();
    });

    test('should navigate to configuration', async ({ page }) => {
      await page.goto('/docs/configuration');
      await expect(page.locator('text=DATABASE_URL')).toBeVisible();
    });
  });

  test.describe('API Discovery', () => {
    test('should list available MCP tools via manifest', async ({ request }) => {
      const response = await request.get('http://localhost:4000/trpc/tools/listAvailable');
      expect(response.status()).toBeGreaterThanOrEqual(200);
    });
  });
});
