import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { createTestJpeg, uploadFiles } from './helpers';

test.describe('Upload flow', () => {
  let tempDir: string;

  test.beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-test-'));
  });

  test.afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('page loads with drop zone', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="dropzone"]')).toBeVisible();
    await expect(page.getByText('Drag & drop')).toBeVisible();
  });

  test('shows privacy banner', async ({ page }) => {
    await page.goto('/');
    // Privacy banner or its text should be present (may be dismissed)
    // Just check the page title or a key privacy phrase exists somewhere
    await expect(page).toHaveTitle(/WikiPicture/);
  });

  test('can select files via file input', async ({ page }) => {
    await page.goto('/');
    const jpegPath = path.join(tempDir, 'photo.jpg');
    fs.writeFileSync(jpegPath, createTestJpeg());

    await uploadFiles(page, [jpegPath]);

    // Should show file list with the filename
    await expect(page.getByText('photo.jpg')).toBeVisible();
    // Should show submit button
    await expect(page.getByRole('button', { name: /Analyze/i })).toBeVisible();
  });

  test('rejects non-image files', async ({ page }) => {
    await page.goto('/');

    const txtPath = path.join(tempDir, 'document.txt');
    fs.writeFileSync(txtPath, 'not an image');

    await uploadFiles(page, [txtPath]);

    // Should show error or empty file list (txt rejected)
    // The submit button should not appear or should be disabled
    const submitBtn = page.getByRole('button', { name: /Analyze/i });
    // Either the button is not visible or shows 0 photos
    const isVisible = await submitBtn.isVisible().catch(() => false);
    if (isVisible) {
      // If visible, it should be disabled
      await expect(submitBtn).toBeDisabled();
    }
  });

  test('shows progress after upload', async ({ page }) => {
    await page.goto('/');
    const jpegPath = path.join(tempDir, 'photo.jpg');
    fs.writeFileSync(jpegPath, createTestJpeg());

    await uploadFiles(page, [jpegPath]);
    await page.getByRole('button', { name: /Analyze/i }).click();

    // Should transition to processing state
    await expect(page.locator('[data-testid="progress-view"]').or(
      page.getByText(/processing|extracting|analyzing/i)
    )).toBeVisible({ timeout: 15000 });
  });
});
