import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The palette is 1970s paperback — burnt orange on deep brown — which is
 * exactly the kind of scheme that reads beautifully and fails contrast. This
 * holds every screen to WCAG 2.1 AA, so the look cannot quietly drift below it.
 */

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(' ')),
  }));
}

test('the briefing is accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Captain' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the deployment screen is accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Captain' }).fill('Testa Vance');
  await page.getByRole('button', { name: 'Scout Wave' }).click();
  await page.getByRole('button', { name: 'Take command' }).click();

  await expect(page.getByRole('button', { name: 'Let Fleet Command deploy' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('a campaign under way is accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Captain' }).fill('Testa Vance');
  await page.getByRole('button', { name: 'Scout Wave' }).click();
  await page.getByRole('button', { name: 'Take command' }).click();
  await page.getByRole('button', { name: 'Let Fleet Command deploy' }).click();

  const invasion = page.getByRole('grid', { name: /Invasion Grid/ });
  await invasion.getByRole('gridcell', { name: 'A1', exact: true }).click();
  await expect(invasion.getByRole('gridcell', { name: /^A1 (hit|miss|sunk)$/ })).toBeVisible();

  expect(await violations(page)).toEqual([]);

  // Playing by ear: what the shot did and who the grid waits on are spoken,
  // not only drawn.
  await expect(page.getByRole('status')).toContainText(/A1/);
});
