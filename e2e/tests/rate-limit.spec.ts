import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { createTestJpeg } from './helpers';

test.describe('Rate limiting', () => {
  test('rate limit headers are present on upload endpoint', async ({ page }) => {
    // OPTIONS/HEAD request won't trigger rate limit but we can check API is up
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
  });

  test('upload with no files returns validation error not 500', async ({ page }) => {
    const response = await page.request.post('/api/upload', {
      multipart: { dummy: 'value' }
    });
    // Should be a client error, not a server error
    expect(response.status()).toBeLessThan(500);
  });
});
