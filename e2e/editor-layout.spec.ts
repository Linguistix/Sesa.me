import { expect, test } from "./fixtures";
import { type Page } from "@playwright/test";

/**
 * Layout guards for the editor.
 *
 * Text-and-role assertions cannot catch a covering layer: an overlay that is
 * `pointer-events-none` leaves every element "visible" and clickable while
 * painting over all of it. These tests assert geometry instead.
 */

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Lay ${suffix}`);
  await page.locator('input[name="slug"]').fill(`lay-${suffix}`);
  await page.getByLabel("E-mail").fill(`lay-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test.describe("the live preview stays inside its frame", () => {
  test("the theme backdrop does not escape the preview on the editor", async ({ page }) => {
    await signUp(page, uniqueSuffix());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const backdrop = page.locator("[data-sesame-backdrop]");
    await expect(backdrop).toHaveCount(1);

    const box = (await backdrop.boundingBox())!;
    const viewport = page.viewportSize()!;

    // The bug: `position: fixed` made this span the whole viewport and paint
    // the theme's gradient over the entire editor.
    expect(box.width).toBeLessThan(viewport.width / 2);
  });

  test("the backdrop is contained by the phone frame", async ({ page }) => {
    await signUp(page, uniqueSuffix());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const root = page.locator("[data-sesame-root]");
    const backdrop = page.locator("[data-sesame-backdrop]");

    const rootBox = (await root.boundingBox())!;
    const backdropBox = (await backdrop.boundingBox())!;

    // Within a pixel, the backdrop covers its own renderer and nothing more.
    expect(backdropBox.x).toBeGreaterThanOrEqual(rootBox.x - 1);
    expect(backdropBox.width).toBeLessThanOrEqual(rootBox.width + 1);
  });

  // Note: this catches an overlay that *intercepts* pointer events. It does
  // not catch a `pointer-events-none` one — elementFromPoint sees straight
  // through those, which is why the geometric assertions above exist.
  test("no pointer-intercepting layer sits over the editor", async ({ page }) => {
    await signUp(page, uniqueSuffix());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const heading = page.getByRole("heading", { name: "Votre page" });
    await expect(heading).toBeVisible();

    const box = (await heading.boundingBox())!;

    // Hit-test the heading's own position: whatever is painted there must be
    // the heading or one of its ancestors, not a sibling overlay.
    const topmostIsHeading = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const target = document.evaluate(
          "//h1[normalize-space(text())='Votre page']",
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue as HTMLElement | null;
        if (!el || !target) return false;
        return el === target || target.contains(el) || el.contains(target);
      },
      { x: box.x + 4, y: box.y + box.height / 2 },
    );

    expect(topmostIsHeading).toBe(true);
  });

  test("the same holds on the appearance screen", async ({ page }) => {
    await signUp(page, uniqueSuffix());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard/appearance");

    const backdrop = page.locator("[data-sesame-backdrop]");
    const box = (await backdrop.boundingBox())!;
    expect(box.width).toBeLessThan(page.viewportSize()!.width / 2);

    // And the preset picker is reachable.
    await expect(page.getByRole("button", { name: /Appliquer le thème/ }).first()).toBeVisible();
  });

  test("on the real public page the backdrop still covers the page", async ({ page }) => {
    await page.goto("/camille");

    const root = page.locator("[data-sesame-root]");
    const backdrop = page.locator("[data-sesame-backdrop]");

    const rootBox = (await root.boundingBox())!;
    const backdropBox = (await backdrop.boundingBox())!;

    // Scoping it to the renderer must not shrink it where it belongs.
    expect(backdropBox.width).toBeGreaterThanOrEqual(rootBox.width - 1);
    expect(backdropBox.height).toBeGreaterThanOrEqual(rootBox.height - 1);
  });
});
