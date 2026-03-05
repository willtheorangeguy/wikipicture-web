import { Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Create a minimal valid JPEG file for testing (just the JPEG magic bytes + enough data)
export function createTestJpeg(filename: string = 'test.jpg'): Buffer {
  // Minimal valid JPEG with GPS EXIF data
  // Use a real small JPEG — create a 1x1 pixel white JPEG
  // This is a valid 1x1 white JPEG in base64
  const jpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
  return Buffer.from(jpegBase64, 'base64');
}

// Write a test JPEG to a temp path and return the path
export function writeTestJpeg(dir: string, filename: string = 'test.jpg'): string {
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, createTestJpeg());
  return filepath;
}

// Wait for the page to show results (poll for results section)
export async function waitForResults(page: Page, timeout: number = 60000): Promise<void> {
  await page.waitForSelector('[data-testid="results-table"]', { timeout });
}

// Upload files via the hidden file input (bypasses drag-and-drop for testing)
export async function uploadFiles(page: Page, filePaths: string[]): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePaths);
}
