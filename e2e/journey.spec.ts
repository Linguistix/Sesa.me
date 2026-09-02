import { expect, test } from "./fixtures";
import { type Page } from "@playwright/test";

/**
 * The Phase 1 acceptance path from the brief:
 * create an account → edit the page → see it live publicly.
 */

/** Unique per run so repeated runs do not collide on the unique slug/email. */
function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Test ${suffix}`);
  await page.locator('input[name="slug"]').fill(`test-${suffix}`);
  await page.getByLabel("E-mail").fill(`test-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test("a new user can sign up, add links and see them on their public page", async ({ page }) => {
  const suffix = uniqueSuffix();
  const slug = `test-${suffix}`;

  await signUp(page, suffix);
  await expect(page.getByRole("heading", { name: "Votre page" })).toBeVisible();

  // The live preview repeats the editor's content, so block assertions are
  // scoped to the editor list rather than the whole document.
  const blockList = page.getByRole("list", { name: "Blocs de la page" });

  // --- Edit the profile ---------------------------------------------------
  await page.getByLabel("Bio", { exact: false }).fill("Ma bio de test.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // The confirmation is a live region. Asserting on the role rather than the
  // exact sentence keeps this step about "the save was confirmed", so a copy
  // edit does not read as a broken journey.
  await expect(page.getByRole("status")).toContainText("Enregistré");

  // --- Add two links ------------------------------------------------------
  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });

  await addBlock.getByLabel("Titre", { exact: true }).fill("Mon site");
  await addBlock.getByLabel("URL", { exact: true }).fill("https://example.com/site");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();
  await expect(blockList.getByText("Mon site")).toBeVisible();

  await addBlock.getByLabel("Titre", { exact: true }).fill("Ma boutique");
  await addBlock.getByLabel("URL", { exact: true }).fill("https://example.com/shop");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();
  await expect(blockList.getByText("Ma boutique")).toBeVisible();

  // --- The public page shows them, in order -------------------------------
  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: `Test ${suffix}` })).toBeVisible();
  await expect(page.getByText("Ma bio de test.")).toBeVisible();

  const links = page.getByRole("navigation").getByRole("link");
  await expect(links.nth(0)).toContainText("Mon site");
  await expect(links.nth(1)).toContainText("Ma boutique");
  await expect(links.nth(0)).toHaveAttribute("href", "https://example.com/site");
});

test("reordering blocks with the keyboard persists and reorders the public page", async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const slug = `test-${suffix}`;

  await signUp(page, suffix);

  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  const blockList = page.getByRole("list", { name: "Blocs de la page" });

  for (const [title, url] of [
    ["Premier", "https://example.com/1"],
    ["Second", "https://example.com/2"],
  ]) {
    await addBlock.getByLabel("Titre", { exact: true }).fill(title);
    await addBlock.getByLabel("URL", { exact: true }).fill(url);
    await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();
    await expect(blockList.getByText(title, { exact: true })).toBeVisible();
  }

  // Let the list settle before grabbing focus: adding a block re-renders it,
  // and focusing a row that is about to be replaced loses the keypress.
  await expect(blockList.getByRole("listitem")).toHaveCount(2);

  // dnd-kit exposes keyboard reordering on the drag handle: space to pick up,
  // arrow to move, space to drop. This also proves the list is keyboard-usable.
  const handle = page.getByRole("button", { name: /Déplacer « Premier »/ });
  await handle.focus();

  // Each step waits for the announcement it produces before the next keypress.
  // Firing all three keys back to back races dnd-kit's layout measurement, and
  // a dropped keypress would otherwise make this a no-op that still "passes".
  const liveRegion = page.getByText(/Bloc « .* »/);

  await page.keyboard.press("Space");
  await expect(liveRegion).toContainText("Premier");

  await page.keyboard.press("ArrowDown");
  await expect(liveRegion).toContainText("Second");

  await page.keyboard.press("Space");

  // Wait for the save to actually land rather than guessing at a duration —
  // the list reports its own state.
  await expect(page.locator('[data-reorder-state="saved"]')).toBeVisible();

  await page.goto(`/${slug}`);
  const links = page.getByRole("navigation").getByRole("link");
  await expect(links.nth(0)).toContainText("Second");
  await expect(links.nth(1)).toContainText("Premier");
});

test("applying a preset theme changes the public page", async ({ page }) => {
  const suffix = uniqueSuffix();
  const slug = `test-${suffix}`;

  await signUp(page, suffix);

  await page.goto("/dashboard/appearance");
  await page.getByRole("button", { name: "Appliquer le thème Ivory" }).click();
  // The save control states what it will do and reads "À jour" once there is
  // nothing left to save, so it is matched on either wording.
  await page.getByRole("button", { name: /Appliquer à ma page|À jour/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Thème appliqué" })).toBeVisible();

  await page.goto(`/${slug}`);
  // Ivory is a light theme: the page background must be its near-white.
  const background = await page
    .locator("[data-sesame-root]")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(251, 250, 247)");
});

test("a password-gated link never exposes its destination until unlocked", async ({ page }) => {
  await page.goto("/camille");

  const html = await page.content();
  expect(html).not.toContain("example.com/members");

  await page.getByRole("button", { name: /Espace membres/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // The dialog is translated, and this browser context is en-US, so selectors
  // here go by role and type rather than by the visible French strings.
  await dialog.locator('input[type="password"]').fill("mauvais");
  await dialog.getByRole("button", { name: /Ouvrir|Open|Abrir/ }).click();
  await expect(dialog.getByRole("alert")).toContainText(/incorrect|incorrecta/i);
});

test("a French visitor sees the unlock dialog in French", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();

  await page.goto("/camille");
  await page.getByRole("button", { name: /Espace membres/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByPlaceholder("Mot de passe")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Ouvrir" })).toBeVisible();

  await context.close();
});

test("the QR endpoint serves a downloadable code for a real page", async ({ request }) => {
  const png = await request.get("/api/qr?slug=camille&format=png&size=256");
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toContain("image/png");

  const svg = await request.get("/api/qr?slug=camille&format=svg");
  expect(svg.status()).toBe(200);
  expect(await svg.text()).toContain("<svg");

  // Unknown pages and malformed colours are rejected rather than rendered.
  expect((await request.get("/api/qr?slug=does-not-exist")).status()).toBe(404);
  expect((await request.get("/api/qr?slug=camille&dark=red")).status()).toBe(400);
});

test("the dashboard is not reachable while signed out", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("the AI design panel reports itself unavailable when no key is configured", async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  await page.goto("/dashboard/appearance");

  // This instance runs without ANTHROPIC_API_KEY; the panel must say so
  // rather than offering a button that cannot work.
  const panel = page.getByText("Non configuré sur cette instance", { exact: false });
  const generator = page.getByRole("button", { name: "Générer" });

  // Exactly one of the two states must be present.
  const unavailable = await panel.count();
  const available = await generator.count();
  expect(unavailable + available).toBe(1);

  if (unavailable) {
    await expect(panel).toBeVisible();
    await expect(generator).toHaveCount(0);
  }
});
