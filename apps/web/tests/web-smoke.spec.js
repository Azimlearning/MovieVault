import { test, expect } from "@playwright/test";

const pageErrors = [];
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4175";

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
});

test("first-run flow, home shell, and search page are usable", async ({ page }) => {
  await expect(page.getByText("Skip for now")).toBeVisible();
  await expect(page.locator('img[alt="MovieVault"]')).toHaveAttribute("src", "/movievault-mark.svg");

  await page.getByText("Skip for now").click();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();

  // Search is a destination with its own address, not a modal over the app.
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search$/);
  const input = page.getByPlaceholder("Search movies, series, and people");
  await expect(input).toBeFocused();

  await input.fill("movievault unlikely title");
  await expect(page).toHaveURL(/\/search\?q=movievault%20unlikely%20title$/);

  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("");

  expect(pageErrors).toEqual([]);
});

test("the sidebar carries navigation only, with no pinned content list", async ({ page }) => {
  await page.getByText("Skip for now").click();
  const sidebar = page.locator(".sidebar");
  await expect(sidebar.getByText("Pinned")).toHaveCount(0);
  await expect(sidebar.locator("img").first()).toHaveAttribute("src", "/movievault-mark.svg");
  expect(pageErrors).toEqual([]);
});

test("mobile first-run screen has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByText("Skip for now")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(pageErrors).toEqual([]);
});

test("navigation writes shareable URLs and Back restores the previous screen", async ({ page }) => {
  await page.getByText("Skip for now").click();

  await page.getByRole("button", { name: /Library/ }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.getByRole("button", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);

  await page.goForward();
  await expect(page).toHaveURL(/\/settings$/);

  expect(pageErrors).toEqual([]);
});

test("a deep link opens the title page rather than home", async ({ page }) => {
  await page.goto(`${baseUrl}/movie/1061474/f1-the-movie`, { waitUntil: "networkidle" });
  await page.getByText("Skip for now").click();

  // The shared address survives the cold start, slug included.
  await expect(page).toHaveURL(/\/movie\/1061474\/f1-the-movie$/);
  // Without a TMDB token the page can only prove it mounted by its own error
  // surface — which is still the movie page, not the home screen.
  await expect(page.getByText(/TMDB Auth Error/)).toBeVisible();
});
