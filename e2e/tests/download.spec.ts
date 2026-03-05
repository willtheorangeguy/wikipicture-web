import { test, expect } from '@playwright/test';

test.describe('Download', () => {
  test('download endpoint returns 404 for unknown job', async ({ page }) => {
    const response = await page.request.get('/api/download/nonexistent-job');
    expect(response.status()).toBe(404);
  });

  test('delete endpoint returns 404 or 200 for unknown job', async ({ page }) => {
    const response = await page.request.delete('/api/job/nonexistent-job');
    // May return 200 (idempotent delete) or 404
    expect([200, 404]).toContain(response.status());
  });
});
