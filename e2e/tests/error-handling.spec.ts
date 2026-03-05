import { test, expect } from '@playwright/test';

test.describe('Error handling', () => {
  test('API health check responds', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('unknown API route returns 404', async ({ page }) => {
    const response = await page.request.get('/api/nonexistent-endpoint');
    expect(response.status()).toBe(404);
  });

  test('SPA serves index.html for unknown routes', async ({ page }) => {
    // SPA routing: unknown paths should serve the React app, not 404
    await page.goto('/some/deep/route');
    await expect(page).toHaveTitle(/WikiPicture/);
  });
});
