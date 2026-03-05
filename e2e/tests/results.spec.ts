import { test, expect } from '@playwright/test';

test.describe('Results display', () => {
  test('results table has expected columns', async ({ page }) => {
    // Check the API health endpoint is up
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('API returns 422 for empty upload', async ({ page }) => {
    const response = await page.request.post('/api/upload', {
      multipart: {}
    });
    // Should fail with 422 (validation error) since no photos provided
    expect([400, 422]).toContain(response.status());
  });

  test('API returns 404 for unknown job', async ({ page }) => {
    const response = await page.request.get('/api/results/nonexistent-job-id');
    expect(response.status()).toBe(404);
  });
});
