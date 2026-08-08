import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

/**
 * `/stats` is the one route on the site that is not the search view, so it is
 * the one navigation that crosses a route boundary rather than swapping search
 * params.
 *
 * It takes no dynamic input — every aggregate is cached — so unlike `/`, the
 * prefetch carries the finished page rather than a shell over a loading
 * fallback. That is what these assert: inside `instant()`, with dynamic data
 * withheld, the real headings are already on screen. If a dynamic API ever
 * creeps in above a Suspense boundary here (a `cookies()` read, a `headers()`
 * call, a `searchParams` prop), the page stops prerendering, the prefetch has
 * nothing to paint, and this fails.
 */

test("navigating from the search view to /stats paints without a round trip", async ({
  page,
}) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "Usage statistics" });
  await expect(link).toBeVisible();

  await instant(page, async () => {
    await link.click();
    await expect(page.getByRole("heading", { name: "most wanted" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "which agents are calling" }),
    ).toBeVisible();
  });
});

test("navigating back to the search view paints its shell without a round trip", async ({
  page,
}) => {
  await page.goto("/stats");
  const link = page.getByRole("link", { name: "[search]" });
  await expect(link).toBeVisible();

  await instant(page, async () => {
    await link.click();
    // The search view's own data is dynamic, so the prefetched shell is what
    // paints here — the search box, which lives above the boundary.
    await expect(
      page.getByPlaceholder("search icons and collections..."),
    ).toBeVisible();
  });
});
