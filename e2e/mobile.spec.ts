import { expect, test } from "./fixtures";
import { devices, type Page } from "@playwright/test";

// A device preset sets `defaultBrowserType`, which Playwright only accepts at
// the top level of a file — hence a file of its own rather than a describe
// block inside the desktop layout guards.
test.use({ ...devices["Pixel 7"] });

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Mob ${suffix}`);
  await page.locator('input[name="slug"]').fill(`mob-${suffix}`);
  await page.getByLabel("E-mail").fill(`mob-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

/**
 * Mobile geometry.
 *
 * These exist because `html, body { overflow-x: hidden }` used to sit in
 * `globals.css`, and it made both classes of bug below invisible. It clipped
 * over-wide content instead of scrolling it — the nav rail was 50px wider than
 * a phone screen and its last tab could not be reached by any gesture — and,
 * because `overflow-x: hidden` computes `overflow-y: auto`, it turned the root
 * into a scroll container and stopped every `position: sticky` in the app from
 * sticking. Nothing on screen said either thing was wrong.
 */
test.describe("the dashboard fits a phone", () => {
  test("nothing is wider than the screen, on every screen", async ({ page }) => {
    await signUp(page, uniqueSuffix());

    for (const path of [
      "/dashboard",
      "/dashboard/appearance",
      "/dashboard/share",
      "/dashboard/analytics",
      "/dashboard/settings",
      "/dashboard/billing",
      "/dashboard/connections",
      "/dashboard/submissions",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return {
          document: document.documentElement.scrollWidth - vw,
          // Absolutely-positioned decoration can exceed the viewport without
          // creating scroll; only in-flow boxes are the bug.
          culprits: [...document.querySelectorAll("body *")]
            .filter((el) => {
              const style = getComputedStyle(el);
              if (style.position === "absolute" || style.position === "fixed") return false;
              return el.getBoundingClientRect().width > vw + 1;
            })
            .map((el) => `${el.tagName}.${String(el.className).split(" ")[0]}`),
        };
      });

      expect(overflow.document, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
      expect(overflow.culprits, `${path} has boxes wider than the screen`).toEqual([]);
    }
  });

  test("every nav tab can be reached with a finger", async ({ page }) => {
    await signUp(page, uniqueSuffix());

    /*
      Deliberately geometric rather than `scrollIntoViewIfNeeded()` + `click()`.
      Playwright will happily scroll a clipped container that no gesture can
      pan and report a healthy click, so the scripted version passed against
      the very bug it was written for. What actually has to hold is that the
      last tab is either on screen already, or inside a container the user can
      really swipe.
    */
    const reachable = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('nav[aria-label="Navigation principale"] a')];
      const last = tabs[tabs.length - 1];
      if (!last) return { found: false };

      const onScreen = last.getBoundingClientRect().right <= document.documentElement.clientWidth + 1;

      let node: Element | null = last.parentElement;
      let pannable = false;
      while (node && node !== document.body) {
        const overflowX = getComputedStyle(node).overflowX;
        if (
          (overflowX === "auto" || overflowX === "scroll") &&
          node.scrollWidth > node.clientWidth
        ) {
          pannable = true;
          break;
        }
        node = node.parentElement;
      }

      return { found: true, label: last.textContent?.trim(), onScreen, pannable };
    });

    expect(reachable.found).toBe(true);
    expect(
      reachable.onScreen || reachable.pannable,
      `"${reachable.label}" is off screen and sits in no scrollable container`,
    ).toBe(true);
  });

  test("the preview stays on screen while the controls are used", async ({ page }) => {
    await signUp(page, uniqueSuffix());
    await page.goto("/dashboard/appearance");
    await page.waitForLoadState("networkidle");

    // Changing a colour you cannot see is the failure this prevents.
    for (const label of ["Accent", "Police du texte", "Forme"]) {
      await page.getByText(label, { exact: true }).first().scrollIntoViewIfNeeded();

      const visible = await page.evaluate(() => {
        const box = document.querySelector("aside")!.getBoundingClientRect();
        return Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0));
      });

      expect(visible, `the preview is off screen while "${label}" is in view`).toBeGreaterThan(150);
    }
  });
});
