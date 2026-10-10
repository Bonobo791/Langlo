import { expect, test } from '@playwright/test';

const prototypePages = [
  '/prototype',
  '/prototype/map',
  '/prototype/lesson',
  '/prototype/practice',
  '/prototype/results',
  '/prototype/review',
  '/prototype/decks',
  '/prototype/settings'
];

test('prototype screens are reachable, labelled, and marked noindex', async ({
  page,
  request
}) => {
  const response = await request.get('/prototype');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response.headers()['cache-control']).toBe('no-store');

  for (const path of prototypePages) {
    await page.goto(path);
    await expect(
      page.getByText('Design prototype — synthetic data', { exact: false })
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('review flow reveals and rates cards by keyboard', async ({ page }) => {
  await page.goto('/prototype/review');
  // Space/Enter on the page body is the documented reveal shortcut; wait for
  // hydration to attach the key handler before pressing.
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Enter');
  const again = page.getByRole('button', { name: /^again/iu });
  await expect(again).toBeVisible();
  await expect(again).toBeFocused();
  await page.keyboard.press('3');
  await expect(page.getByRole('status')).toContainText('Card 2 of 3');
  await page.keyboard.press(' ');
  await page.keyboard.press('1');
  await page.keyboard.press(' ');
  await page.keyboard.press('4');
  await expect(
    page.getByRole('heading', { name: /all caught up/iu })
  ).toBeVisible();
});

test('practice answers produce immediate feedback and results counts', async ({
  page
}) => {
  await page.goto('/prototype/practice');
  await page.getByRole('radio', { name: 'est' }).check();
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.locator('.feedback')).toContainText('Correct');
  await page.getByRole('button', { name: 'Next item' }).click();
  await page.getByRole('button', { name: 'Not sure' }).click();
  await expect(page.locator('.feedback')).toContainText('Uncertain');
});

test('deck draft approval updates the pending queue', async ({ page }) => {
  await page.goto('/prototype/decks');
  const pending = page.getByRole('heading', { name: /pending approval/iu });
  await expect(pending).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await expect(page.getByRole('status')).toContainText('approved');
});

test('kept mistake becomes an approvable draft in decks', async ({ page }) => {
  await page.goto('/prototype/results');
  await page.getByRole('button', { name: 'Keep as flashcard' }).click();
  await page.getByRole('link', { name: 'See card drafts' }).click();
  await expect(
    page.getByText('« Elle ___ fatiguée » — est, not es', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).last().click();
  await expect(page.getByRole('status')).toContainText('approved');
});

test('anki export preference hides the deck export action', async ({
  page
}) => {
  await page.goto('/prototype/settings');
  await page.getByRole('checkbox', { name: /export to anki/iu }).uncheck();
  await page.getByRole('link', { name: 'Decks', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /export to anki/iu })
  ).toHaveCount(0);
});

test('prototype error and forbidden states render safe messages', async ({
  page
}) => {
  await page.goto('/prototype?state=error');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.goto('/prototype/map?track=de-a2');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Not enrolled');
  await page.goto('/prototype/review?state=empty');
  await expect(
    page.getByRole('heading', { name: /all caught up/iu })
  ).toBeVisible();
});

test('prototype screens have no horizontal overflow', async ({ page }) => {
  for (const path of prototypePages) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth -
        globalThis.document.documentElement.clientWidth
    );
    expect(overflow, `${path} has horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
