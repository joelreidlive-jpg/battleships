import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// A small phone held upright, with a finger rather than a pointer.
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

/** Anything reaching past the right edge, which on a phone means a sideways scroll. */
async function overhang(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className)}`),
  );
}

test('a campaign can be fought on a phone, by finger, without scrolling sideways', async ({
  page,
}) => {
  await page.goto('/');
  expect(await overhang(page), 'the briefing runs off the side of the phone').toEqual([]);

  await page.getByRole('textbox', { name: 'Captain' }).fill('Testa Vance');
  await page.getByRole('button', { name: 'Scout Wave' }).tap();
  await page.getByRole('button', { name: 'Take command' }).tap();
  expect(await overhang(page), 'the deployment screen runs off the side').toEqual([]);

  await page.getByRole('button', { name: 'Let Fleet Command deploy' }).tap();

  const invasion = page.getByRole('grid', { name: /Invasion Grid/ });
  await expect(invasion).toBeVisible();
  expect(await overhang(page), 'the campaign runs off the side').toEqual([]);

  // Fired by touch: the deployment and the grid both have to answer a tap.
  await invasion.getByRole('gridcell', { name: 'A1', exact: true }).tap();
  await expect(invasion.getByRole('gridcell', { name: /^A1 (hit|miss|sunk)$/ })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Abandon defence' })).toBeVisible();
});
