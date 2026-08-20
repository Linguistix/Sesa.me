import { expect, test, type Page } from "@playwright/test";

/** Phase 4: embeds, gallery, forms, i18n, deep links, custom domains. */

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Int ${suffix}`);
  await page.locator('input[name="slug"]').fill(`int-${suffix}`);
  await page.getByLabel("E-mail").fill(`int-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test("the public page follows the visitor's language", async ({ browser }) => {
  for (const [locale, expected] of [
    ["en-GB", "Powered by Sesame"],
    ["es-ES", "Con tecnología de Sesame"],
    ["fr-FR", "Propulsé par Sesame"],
  ] as const) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto("/camille");
    await expect(page.getByText(expected)).toBeVisible();
    await context.close();
  }
});

test("a Spotify link added as an embed renders a player, not a button", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await addBlock.getByLabel("Type").selectOption("EMBED");
  await addBlock.getByLabel("Titre", { exact: true }).fill("Mon single");
  await addBlock
    .getByLabel("URL", { exact: true })
    .fill("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();
  await expect(
    page.getByRole("list", { name: "Blocs de la page" }).getByText("Mon single"),
  ).toBeVisible();

  await page.goto(`/int-${suffix}`);

  const player = page.locator('iframe[src*="open.spotify.com/embed"]');
  await expect(player).toHaveCount(1);
  // Third-party frames must be sandboxed and lazily loaded.
  await expect(player).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(player).toHaveAttribute("loading", "lazy");
});

test("an unrecognised URL in an embed block degrades to a plain link", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await addBlock.getByLabel("Type").selectOption("EMBED");
  await addBlock.getByLabel("Titre", { exact: true }).fill("Mon site");
  await addBlock.getByLabel("URL", { exact: true }).fill("https://example.com/whatever");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();

  await page.goto(`/int-${suffix}`);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Mon site" })).toBeVisible();
});

test("a gallery opens a lightbox that closes with Escape", async ({ page }) => {
  await page.goto("/camille");

  const thumbnails = page.getByRole("button", { name: /Agrandir l'image|Enlarge image/ });
  await expect(thumbnails.first()).toBeVisible();

  await thumbnails.first().click();
  const lightbox = page.getByRole("dialog", { name: "En tournée" });
  await expect(lightbox).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
});

test("a form on a public page validates and records a submission", async ({ page }) => {
  await page.goto("/camille");

  const form = page.locator("form").filter({ hasText: "Me contacter" });
  await expect(form).toBeVisible();

  // Fill only the email, leaving a required field empty.
  await form.getByLabel(/Votre e-mail/).fill("visiteur@example.com");
  await form.getByLabel(/Votre nom/).fill("Visiteur Test");
  await form.getByLabel(/Votre message/).fill("Bonjour depuis le test.");
  await form.getByRole("button", { name: /Envoyer|Send|Enviar/ }).click();

  await expect(page.getByText(/Merci/)).toBeVisible();
});

test("the form endpoint rejects a bad email in the visitor's language", async ({ request }) => {
  const listing = await request.get("/camille");
  expect(listing.status()).toBe(200);

  // Post to a form id that does not exist: the endpoint must not 500.
  const missing = await request.post("/api/forms/does-not-exist/submit", {
    data: { name: "x" },
  });
  expect(missing.status()).toBe(404);
});

test("short links deep-link inside an in-app browser and redirect elsewhere", async ({
  browser,
}) => {
  // Build a short link through the UI so the test does not depend on seed data.
  const suffix = uniqueSuffix();
  const setup = await browser.newContext();
  const page = await setup.newPage();
  await signUp(page, suffix);

  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await addBlock.getByLabel("Titre", { exact: true }).fill("Mon single");
  await addBlock
    .getByLabel("URL", { exact: true })
    .fill("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();

  await page.goto("/dashboard/analytics");
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const shortUrl = page.getByText(/\/u\/[1-9A-HJ-NP-Za-km-z]+$/);
  await expect(shortUrl).toBeVisible();
  const code = (await shortUrl.textContent())!.split("/u/")[1]!.trim();
  await setup.close();

  // An ordinary browser gets a plain redirect.
  const plain = await browser.newContext();
  const plainResponse = await plain.request.get(`/u/${code}`, { maxRedirects: 0 });
  expect(plainResponse.status()).toBe(302);
  expect(plainResponse.headers()["location"]).toContain("open.spotify.com");
  await plain.close();

  // Instagram's webview ignores Universal Links, so it gets the interstitial.
  const inApp = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 300.0.0.0",
  });
  const inAppResponse = await inApp.request.get(`/u/${code}`, { maxRedirects: 0 });
  expect(inAppResponse.status()).toBe(200);

  const body = await inAppResponse.text();
  expect(body).toContain('data-native="spotify:track:4cOdK2wGLETKBW3PvgPWqT"');
  expect(body).toContain("noindex");
  await inApp.close();
});

test("a custom domain is refused on the free plan", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  await page.goto("/dashboard/domain");
  await expect(page.getByText(/fait partie du plan Pro/)).toBeVisible();
  // The form must not be reachable at all, not merely disabled.
  await expect(page.locator('input[name="hostname"]')).toHaveCount(0);
});

test("form submissions appear in the dashboard and export as CSV", async ({ page }) => {
  await page.goto("/camille");

  const form = page.locator("form").filter({ hasText: "Me contacter" });
  const marker = `Test ${uniqueSuffix()}`;
  await form.getByLabel(/Votre nom/).fill(marker);
  await form.getByLabel(/Votre e-mail/).fill("visiteur@example.com");
  await form.getByRole("button", { name: /Envoyer|Send|Enviar/ }).click();
  await expect(page.getByText(/Merci/)).toBeVisible();

  // Sign in as the demo owner to read them back.
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("demo@sesa.me");
  await page.getByLabel(/Mot de passe/).fill("demo1234");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });

  await page.goto("/dashboard/submissions");
  await expect(page.getByText(marker)).toBeVisible();

  const csv = await page.request.get("/api/forms/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(marker);
});

test("closing the lightbox returns focus to the thumbnail that opened it", async ({ page }) => {
  await page.goto("/camille");

  const thumbnails = page.getByRole("button", { name: /Agrandir l'image|Enlarge image/ });
  const second = thumbnails.nth(1);
  await second.click();

  const lightbox = page.getByRole("dialog", { name: "En tournée" });
  await expect(lightbox).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);

  // A keyboard user must land back where they were, not at the top of the page.
  const focusedLabel = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  expect(focusedLabel).toMatch(/2\/3/);
});

test("Tab stays inside the unlock dialog while it is open", async ({ page }) => {
  await page.goto("/camille");
  await page.getByRole("button", { name: /Espace membres/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Cycle well past the number of controls; focus must never escape.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return dialogEl?.contains(document.activeElement) ?? false;
    });
    expect(inside, `focus escaped on Tab #${i + 1}`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
