import { expect, test } from '@playwright/test';
import path from 'path';

test.describe('Household Budget Engine - ING PDF Upload', () => {
    test('should allow user to upload ING PDF and view transactions', async ({ page }) => {
        // 1. Login (Mock Auth bypasses login page)
        await page.goto('/');

        // 2. Navigate to Transactions
        await page.getByRole('link', { name: 'Transacties' }).click();
        await expect(page).toHaveURL('/transactions');

        // 3. Upload ING PDF
        await page.locator('input[name="file"]').setInputFiles(path.join(__dirname, '../fixtures/ing-sample.pdf'));
        await page.getByRole('button', { name: 'Upload Transacties' }).click();

        // 4. Verify Success Message
        const alert = page.locator('div.rounded.p-2');
        await expect(alert).toBeVisible({ timeout: 30000 });
        await expect(alert).toContainText(/Succesvol .* transacties geïmporteerd/);

        // 5. Reload and Verify Transactions
        await page.goto('/transactions');

        // Check for rows
        await page.waitForSelector('table tbody tr');
        const rowCount = await page.locator('table tbody tr').count();
        expect(rowCount).toBeGreaterThan(0);

        // Check for a date from 2025 (based on filename)
        await expect(page.locator('table')).toContainText('2025');
    });
});
