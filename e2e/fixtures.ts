import { test as base, expect } from "@playwright/test";

/**
 * The suite's `test`, with third-party font requests blocked.
 *
 * Public pages pull their typeface from Google Fonts. Left alone, every test
 * that opens one waits on that request — fine on a fast connection, but in a
 * sandbox with no egress it hangs until the test times out, and the report
 * blames whatever assertion happened to be next. Aborting the request keeps
 * runs fast and deterministic, and costs nothing: the page is designed to
 * render in the fallback face and swap, so blocking the webfont exercises
 * exactly the path a visitor on a bad connection gets.
 */
const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com/;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(FONT_HOSTS, (route) => route.abort());
    await use(page);
  },

  // Some tests build their own contexts to vary the locale. Routing on the
  // browser-level fixture would not reach those, so the block is installed on
  // each context as it is created.
  browser: async ({ browser }, use) => {
    const original = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
      const context = await original(options);
      await context.route(FONT_HOSTS, (route) => route.abort());
      return context;
    };
    await use(browser);
    browser.newContext = original;
  },
});

export { expect };
