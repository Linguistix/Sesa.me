import { expect, test } from "./fixtures";
import { type Page } from "@playwright/test";

/**
 * Contrast guards for the app's own chrome.
 *
 * Sesame's pitch is that a creator's page is guaranteed to meet WCAG AA — the
 * theme pipeline verifies every generated palette and repairs what fails. The
 * tool that produces those pages has no such pipeline: its colours are Tailwind
 * tokens, and nothing stops one from drifting under the threshold. It has
 * happened: `--color-ink-500` was once written `#55556577`, an eight-digit hex
 * whose trailing `77` is an alpha byte, and every caption using it rendered at
 * 2.7:1 while still looking deliberate in the source.
 *
 * So the same rule the product applies to user themes is applied here, in a
 * real browser against computed styles, because that is the only place the
 * cascade, alpha compositing and inherited colours have all resolved.
 */

type Failure = {
  text: string;
  ratio: number;
  required: number;
  colour: string;
  classes: string;
};

/**
 * Runs in the page. Mirrors the maths in `src/lib/theme/contrast.ts` rather than
 * importing it: this has to measure what the browser actually painted, which
 * means computed styles, not the values the source intended.
 */
function measureContrast(): Failure[] {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = (rgb: number[]) =>
    0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = luminance(a) > luminance(b) ? [luminance(a), luminance(b)] : [luminance(b), luminance(a)];
    return (hi + 0.05) / (lo + 0.05);
  };

  // Composite a translucent colour over what is behind it, the way the
  // compositor does, so an alpha channel can never hide a failure.
  const over = (fg: number[], bg: number[]) => {
    const alpha = fg.length === 4 ? fg[3] : 1;
    return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha));
  };

  // Walk up collecting layers until an opaque one, then composite back down.
  // Starts at the element itself: a chip or a button paints its own background
  // behind its own label, and skipping it measures the text against whatever is
  // behind the chip instead.
  const backdrop = (el: Element) => {
    let node: Element | null = el;
    const layers: number[][] = [];
    while (node) {
      const colour = parse(getComputedStyle(node).backgroundColor);
      if (colour.length >= 3 && !(colour.length === 4 && colour[3] === 0)) {
        layers.push(colour);
        if (colour.length === 3 || colour[3] === 1) break;
      }
      node = node.parentElement;
    }
    return layers.reverse().reduce((acc, layer) => over(layer, acc), [0, 0, 0]);
  };

  // A gradient has no single background colour, so a ratio against it would be
  // a number with no meaning — it changes along the element. Rather than report
  // a misleading figure, these are skipped and checked by eye. Keep the count
  // small: each one is a spot the guard cannot watch.
  const onGradient = (el: Element) => {
    let node: Element | null = el;
    while (node) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== "none") return true;
      const colour = parse(style.backgroundColor);
      if (colour.length === 3 || (colour.length === 4 && colour[3] === 1)) return false;
      node = node.parentElement;
    }
    return false;
  };

  const failures: Failure[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    // Only elements owning text directly; a wrapper inherits its child's job.
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => (n.textContent ?? "").trim())
      .join(" ")
      .trim();
    if (!text) continue;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    // WCAG 1.4.3 exempts inactive controls, and a disabled button is dimmed on
    // purpose — measuring it would report a failure that is not one.
    if (el.closest(":disabled, [aria-disabled='true']")) continue;
    const colour = parse(style.color);
    // Gradient-filled text paints from a background image; the colour is a
    // fully transparent placeholder and measuring it would be meaningless.
    if (colour.length === 4 && colour[3] === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (el.closest("[data-contrast-exempt]")) continue;
    if (onGradient(el)) continue;

    const bg = backdrop(el);
    // `opacity` on the element blends its text toward the backdrop. Folding it
    // in means a element faded to 60% is measured at the contrast a reader
    // actually gets, not the contrast its colour value implies.
    const faded = Number(style.opacity);
    const fg = over(
      colour.length === 4 ? [...colour.slice(0, 3), colour[3] * faded] : [...colour, faded],
      bg,
    );
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const required = large ? 3 : 4.5;
    const measured = ratio(fg, bg);
    if (measured < required) {
      failures.push({
        text: text.slice(0, 48),
        ratio: Math.round(measured * 100) / 100,
        required,
        colour: style.color,
        classes: String(el.className).slice(0, 60),
      });
    }
  }
  return failures;
}

async function failuresOn(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return page.evaluate(measureContrast);
}

function report(failures: Failure[]) {
  return failures.map((f) => `  ${f.ratio}:1 (needs ${f.required}) "${f.text}" — ${f.colour}`).join("\n");
}

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Con ${suffix}`);
  await page.locator('input[name="slug"]').fill(`con-${suffix}`);
  await page.getByLabel("E-mail").fill(`con-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test.describe("the app's own chrome meets WCAG AA", () => {
  for (const [name, path] of [
    ["the landing page", "/"],
    ["the sign-in page", "/login"],
    ["the sign-up page", "/signup"],
  ] as const) {
    test(`${name} has no text below AA`, async ({ page }) => {
      const failures = await failuresOn(page, path);
      expect(failures, `text below AA:\n${report(failures)}`).toEqual([]);
    });
  }

  for (const [name, path] of [
    ["the editor", "/dashboard"],
    ["the appearance screen", "/dashboard/appearance"],
    ["the share screen", "/dashboard/share"],
    ["the analytics screen", "/dashboard/analytics"],
    ["the settings screen", "/dashboard/settings"],
  ] as const) {
    test(`${name} has no text below AA`, async ({ page }) => {
      await signUp(page, uniqueSuffix());
      const failures = await failuresOn(page, path);
      expect(failures, `text below AA:\n${report(failures)}`).toEqual([]);
    });
  }
});
