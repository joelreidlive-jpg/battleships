import { expect, test } from '@playwright/test';
import type { CreateMatchResponse, MatchView } from '@bs/protocol';

/**
 * The end-to-end gate. Unit tests prove the rules; this proves the assembled
 * thing a player actually meets — the Worker serving the client, the Durable
 * Object holding the campaign, and the one guarantee the game rests on: the
 * invader's deployment never reaches the browser while it can still be used.
 *
 * It is deliberately small. A full 100-shot campaign through the UI would add
 * minutes to every push for no coverage the API pass below does not give.
 */

const CELLS = Array.from({ length: 100 }, (_, index) => index);

test('a captain can be commissioned, deploy a fleet and fight', async ({ page }) => {
  // Every payload the client is sent, so a leak fails the test wherever it happens.
  const leaked: string[] = [];
  page.on('response', async (response) => {
    // Resigning ends the campaign, and the reveal that follows it is the point.
    if (!response.url().includes('/api/matches') || response.url().endsWith('/resign')) return;
    const body = await response.text().catch(() => '');
    if (body.includes('alienFleet')) leaked.push(response.url());
  });

  await page.goto('/');

  await page.getByRole('textbox', { name: 'Captain' }).fill('Testa Vance');
  await page.getByRole('button', { name: 'Scout Wave' }).click();
  await page.getByRole('button', { name: 'Take command' }).click();

  await page.getByRole('button', { name: 'Let Fleet Command deploy' }).click();

  const invasion = page.getByRole('grid', { name: /Invasion Grid/ });
  await expect(invasion).toBeVisible();

  // Fired with the mouse, as most players will.
  await invasion.getByRole('gridcell', { name: 'A1', exact: true }).click();
  await expect(invasion.getByRole('gridcell', { name: /^A1 (hit|miss|sunk)$/ })).toBeVisible();

  // The invader answers of its own accord, after its pause, and the grid is
  // locked until it has.
  const home = page.getByRole('grid', { name: /Home Grid/ });
  await expect(home.getByRole('gridcell', { name: /(hit|miss|sunk)$/ }).first()).toBeVisible({ timeout: 15_000 });

  // The second shot goes in from the keyboard, which is the only way in for
  // anyone who cannot use a mouse.
  await invasion.getByRole('gridcell', { name: 'B1', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(invasion.getByRole('gridcell', { name: /^B1 (hit|miss|sunk)$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Abandon defence' }).click();
  await expect(page.getByText(/Earth is defeated/i)).toBeVisible();

  expect(leaked, 'the invader deployment reached the browser mid-campaign').toEqual([]);
});

test('a campaign played to its end scores, and only then reveals the invader', async ({ request }) => {
  const created = await request.post('/api/matches', {
    data: { difficulty: 'scout', captain: 'Smoke Test', starfleet: 'Continuous Integration' },
  });
  expect(created.ok()).toBeTruthy();
  const { playerToken, match } = (await created.json()) as CreateMatchResponse;
  expect(match.alienFleet).toBeUndefined();
  expect(match.defence.fleet).toHaveLength(10);

  const headers = { 'x-player-token': playerToken, 'content-type': 'application/json' };
  let view = match;
  for (const cell of CELLS) {
    const response = await request.post(`/api/matches/${view.matchId}/fire`, { headers, data: { cell } });
    expect(response.ok()).toBeTruthy();
    view = (await response.json()) as MatchView;
    if (view.status === 'finished') break;
    // Still in play, so the deployment must still be sealed.
    expect(view.alienFleet, `revealed at ${cell}`).toBeUndefined();
    // A wreck is only ever a hull the player has already destroyed.
    expect(view.offence.wrecks.map((wreck) => wreck.hull).sort()).toEqual([...view.offence.sunk].sort());
  }

  expect(view.status).toBe('finished');
  expect(view.winner).toBeDefined();
  expect(view.alienFleet).toHaveLength(10);
  expect(view.score.total).toBeGreaterThan(0);

  // The finished campaign is on the player's record and, having been named, on the board.
  const progress = await request.get('/api/me/progress', { headers });
  expect(((await progress.json()) as { progress: { games: number } }).progress.games).toBe(1);
});

test('a shot outside the grid is rejected, not crashed on', async ({ request }) => {
  const created = await request.post('/api/matches', { data: { difficulty: 'scout' } });
  const { playerToken, match } = (await created.json()) as CreateMatchResponse;
  const headers = { 'x-player-token': playerToken, 'content-type': 'application/json' };

  for (const cell of [-1, 100, 4.5, 'A1']) {
    const response = await request.post(`/api/matches/${match.matchId}/fire`, { headers, data: { cell } });
    expect(response.status(), `cell ${String(cell)}`).toBe(400);
  }

  // A campaign belongs to the token that opened it.
  const stolen = await request.post(`/api/matches/${match.matchId}/fire`, {
    headers: { 'x-player-token': 'not-your-campaign', 'content-type': 'application/json' },
    data: { cell: 0 },
  });
  expect(stolen.status()).toBe(403);
});
