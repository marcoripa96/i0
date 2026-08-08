import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

/**
 * The site is a single route whose views are selected by search params, so
 * "navigation" here means `/` -> `/?scope=icons` and friends.
 *
 * `instant()` withholds the navigation's dynamic data, so whatever these
 * assertions can see came from the prefetched app shell. The signal to assert
 * on is the *fallback*: if the shell is prefetched, the loading placeholder is
 * painted the moment the URL changes, with no round trip. If a component above
 * the Suspense boundary blocks — `headers()`, `cookies()` or `searchParams`
 * read outside it — there is no shell to paint, and these fail.
 *
 * Two things deliberately not asserted here:
 *   - that the header is still visible. It never unmounts, so it stays on
 *     screen even when the navigation is fully blocked: it always passes.
 *   - anything after the `instant()` scope closes. Releasing the lock does not
 *     reliably resume the withheld navigation under the test helper, and the
 *     data arriving is ordinary rendering, covered elsewhere.
 */

test("navigating to the icons view paints the shell without a round trip", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByPlaceholder("search icons and collections..."),
  ).toBeVisible();

  await instant(page, async () => {
    await page.getByRole("button", { name: "icons", exact: true }).click();
    await expect(page.getByText("loading...")).toBeVisible();
  });
});

test("searching paints the shell without a round trip", async ({ page }) => {
  await page.goto("/");
  const search = page.getByPlaceholder("search icons and collections...");
  await expect(search).toBeVisible();

  await instant(page, async () => {
    await search.fill("arrow");
    await expect(page.getByText("loading...")).toBeVisible();
  });
});
