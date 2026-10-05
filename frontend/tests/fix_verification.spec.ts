import { test, expect } from '@playwright/test';

test.describe('Fix Verification - All Issues from Video', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('https://financial-manager-inky.vercel.app');
  });

  // Issue 1: Receipt Upload Failed (was 404)
  test('1. Scan Jobs endpoint should be accessible', async ({ page }) => {
    const response = await page.request.get(
      'https://financial-manager-production-26f7.up.railway.app/api/scan-jobs/'
    );
    // Should not be 404 anymore
    expect(response.status()).not.toBe(404);
  });

  // Issue 2: Feed routes exist
  test('2. Feed & Review routes should be accessible', async ({ page }) => {
    const pendingResponse = await page.request.get(
      'https://financial-manager-production-26f7.up.railway.app/api/feed/pending'
    );
    expect(pendingResponse.status()).not.toBe(404);
    
    const statsResponse = await page.request.get(
      'https://financial-manager-production-26f7.up.railway.app/api/feed/stats'
    );
    expect(statsResponse.status()).not.toBe(404);
  });

  // Issue 3: Recurring Process Now accepts POST
  test('3. Process Now should accept POST with force_today', async ({ page }) => {
    const response = await page.request.post(
      'https://financial-manager-production-26f7.up.railway.app/api/cron/process-recurring'
    );
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('status', 'completed');
    expect(data).toHaveProperty('processed');
  });

  // Issue 4: Login page loads correctly
  test('4. Login page should load without errors', async ({ page }) => {
    await expect(page).toHaveTitle(/FinManager/);
  });

  // Issue 5: Dark mode toggle exists on login page
  test('5. Dark mode toggle should exist', async ({ page }) => {
    const darkToggle = page.locator('[data-testid="theme-toggle"]');
    await expect(darkToggle.or(page.locator('button[aria-label*="dark" i]'))).toBeVisible({ timeout: 5000 });
  });

});
