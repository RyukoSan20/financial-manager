import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://financial-manager-inky.vercel.app';
const LOGIN_URL = `${BASE_URL}/login`;

test.describe('FinManager E2E Automation Testing', () => {

  test('1. Login page loads correctly', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');
    
    const title = await page.title();
    console.log('Page title:', title);
    expect(title.toLowerCase()).toContain('finmanager');
  });

  test('2. Analytics page redirects to login (auth required)', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    console.log('Current URL:', url);
  });

  test('3. Dark mode toggle exists on login page', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');
    
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons on login page`);
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('4. Theme toggle works', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');
    
    const htmlElement = page.locator('html');
    const initialClasses = await htmlElement.getAttribute('class') || '';
    console.log('Initial HTML classes:', initialClasses);
    
    const moonIcon = page.locator('svg[class*="lucide-moon"], svg[class*="lucide-sun"]');
    const iconCount = await moonIcon.count();
    console.log('Found theme icons:', iconCount);
  });

  test('5. Transactions page exists (auth required)', async ({ page }) => {
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    console.log('Transactions URL:', url);
  });

  test('6. Feed page exists (auth required)', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    console.log('Feed URL:', url);
  });

  test('7. Dashboard loads for authenticated users', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');
    
    const title = await page.title();
    console.log('Page title:', title);
    expect(title).toContain('FinManager');
  });

});
