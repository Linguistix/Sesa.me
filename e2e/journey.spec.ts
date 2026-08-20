import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByText("Enregistré.")).toBeVisible();

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

  // dnd-kit exposes keyboard reordering on the drag handle: space to pick up,
  // arrow to move, space to drop. This also proves the list is keyboard-usable.
  const handle = page.getByRole("button", { name: /Déplacer « Premier »/ });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
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
  await page.getByRole("button", { name: "Enregistrer le thème" }).click();
  await expect(page.getByText("Thème appliqué.")).toBeVisible();

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

  await dialog.getByPlaceholder("Mot de passe").fill("mauvais");
  await dialog.getByRole("button", { name: "Ouvrir" }).click();
  await expect(dialog.getByRole("alert")).toContainText("incorrect");
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
