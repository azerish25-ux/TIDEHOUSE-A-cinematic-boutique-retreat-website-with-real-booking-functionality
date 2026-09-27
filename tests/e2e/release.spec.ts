import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { addDays, today } from '../../lib/domain';
const arrival = addDays(today(), 160), departure = addDays(arrival, 3);
const dates = `arrival=${arrival}&departure=${departure}`;

test('fractional cabin and guest links recover without a page exception', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/stay?cabin=1.5&guests=2.5&${dates}`);
  await expect(page.locator('.selected-cabin-title h2')).toHaveText('The Lookout');
  await expect(page.getByText('Some details in that link were not valid.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Total guests')).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Continue to your details' })).toBeEnabled();
  expect(errors).toEqual([]);
});
test('invalid date links recover instead of throwing during formatting', async ({ page }) => {
  await page.goto('/stay?arrival=2027-02-30&departure=bad&cabin=4');
  await expect(page.locator('.selected-cabin-title h2')).toHaveText('The Cove');
  await expect(page.getByRole('button', { name: 'Continue to your details' })).toBeEnabled();
});
test('Cove floor plan uses a queen and the enlarged view restores keyboard focus', async ({ page }) => {
  await page.goto('/cabins/the-cove');
  await page.locator('summary').filter({ hasText: 'The floor plan' }).click();
  await expect(page.locator('.floor-plan svg')).toContainText('QUEEN');
  await expect(page.locator('.floor-plan svg')).not.toContainText('KING');
  const trigger = page.getByRole('button', { name: 'Enlarge The Cove floor plan' });
  await trigger.click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(trigger).toBeFocused();
});
test('Saltgrass floor plan represents the king and both singles', async ({ page }) => {
  await page.goto('/cabins/saltgrass'); await page.locator('summary').filter({ hasText: 'The floor plan' }).click();
  await expect(page.locator('.floor-plan svg text').filter({ hasText: /^SINGLE$/ })).toHaveCount(2);
  await expect(page.locator('.floor-plan svg text').filter({ hasText: /^KING$/ })).toHaveCount(1);
});
test('comparison shows live stay totals and respects capacity', async ({ page }) => {
  await page.goto(`/stay?${dates}&guests=4&cabin=3`);
  await expect(page.getByRole('button', { name: 'Continue to your details' })).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Compare The Lookout', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compare Saltgrass', exact: true }).check();
  await page.getByRole('button', { name: 'Compare cabins (2/2)' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Choose The Lookout' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Choose Saltgrass' })).toBeEnabled();
  await expect(dialog.getByText('Complete stay', { exact: true })).toHaveCount(2);
  await expect(dialog).toContainText('Available for your dates');
});
test('changed dates cannot submit the previous quote while a search is delayed', async ({ page }) => {
  await page.goto(`/stay?${dates}`);
  const proceed = page.getByRole('button', { name: 'Continue to your details' });
  await expect(proceed).toBeEnabled();
  await page.route('**/api/search', async route => { await new Promise(resolve => setTimeout(resolve, 800)); await route.continue(); });
  await page.getByLabel('Arrival', { exact: true }).fill(addDays(arrival, 6));
  await expect(proceed).toBeDisabled(); await expect(proceed).toBeEnabled();
});
// Each route is a separate test: a failed homepage scan never suppresses checkout auditing.
for (const [name, path] of [['homepage', '/'], ['booking', `/stay?${dates}`], ['cabin', '/cabins/the-cove'], ['arrival', '/field-notes/arrival']] as const) {
  test(`${name} has no automated WCAG A/AA violations or horizontal overflow`, async ({ page }) => {
    await page.goto(path); await page.evaluate(() => document.fonts.ready);
    if (name === 'booking') await expect(page.getByRole('button', { name: 'Continue to your details' })).toBeEnabled();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
