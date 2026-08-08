import { expect, test } from "@playwright/test";

/**
 * The licence filter takes a different query path from the unfiltered browse:
 * it resolves the matching collection prefixes first, then filters icons by that
 * list. That list has to reach Postgres as an `IN (…)` list — see `inList` in
 * `src/lib/icons/queries.ts`. Spelled as `= ANY(${list})` it raises 42809 and
 * the view renders empty, which is what these guard against.
 */

test("the icons view renders under a licence filter", async ({ page }) => {
  await page.goto("/?scope=icons&license=MIT");

  await expect(page.getByText(/[\d,]+ icons/).first()).toBeVisible();
  // The grid, not just the count: the failure mode was an empty view.
  await expect(page.locator("main svg").first()).toBeVisible();
  expect(await page.locator("main svg").count()).toBeGreaterThan(20);
});

test("a category renders under a licence filter", async ({ page }) => {
  await page.goto("/?category=People%20%26%20Body&license=MIT");

  await expect(page.getByText(/icons in \[/).first()).toBeVisible();
  expect(await page.locator("main svg").count()).toBeGreaterThan(20);
});
