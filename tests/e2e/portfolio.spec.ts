import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { addDays, today } from '../../lib/domain';

const arrival = addDays(today(), 150);
const pages = [
  ['home', '/'],
  ['stay', `/stay?cabin=1&arrival=${arrival}&departure=${addDays(arrival, 3)}`],
  ['cabin', '/cabins/the-cove'],
] as const;

for (const [name, path] of pages) {
  test(`portfolio evidence: ${name} starts at the top with complete images`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    if (name === 'stay') {
      await expect(page.getByRole('button', { name: 'Continue to your details' })).toBeEnabled();
    }
    // Load genuine lazy images, then reset scroll before capturing sticky layouts.
    await page.evaluate(async () => {
      for (let top = 0; top < document.body.scrollHeight; top += 650) {
        window.scrollTo({ top, behavior: 'instant' });
        await new Promise(resolve => setTimeout(resolve, 90));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await expect.poll(() => page.locator('img').evaluateAll(images =>
      images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
    ), { timeout: 25000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    mkdirSync('evidence', { recursive: true });
    const screenshot = `evidence/portfolio-${name}-${info.project.name}.png`;
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
    await info.attach(`TIDEHOUSE ${name} — ${info.project.name}`, { path: screenshot, contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
}
