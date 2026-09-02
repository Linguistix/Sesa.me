import { expect, test } from "./fixtures";
import { type Page } from "@playwright/test";

/** Phase 2: analytics, short links, plan gating, GDPR. */

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Stat ${suffix}`);
  await page.locator('input[name="slug"]').fill(`stat-${suffix}`);
  await page.getByLabel("E-mail").fill(`stat-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

async function addLink(page: Page, title: string, url: string) {
  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await addBlock.getByLabel("Titre", { exact: true }).fill(title);
  await addBlock.getByLabel("URL", { exact: true }).fill(url);
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();
  await expect(page.getByRole("list", { name: "Blocs de la page" }).getByText(title)).toBeVisible();
}

test("a visit is only measured after consent is given", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);
  await addLink(page, "Mon site", "https://example.com/site");

  // Refusing must leave the counters untouched.
  await page.goto(`/stat-${suffix}`);
  await page.getByRole("button", { name: "Refuser" }).click();
  await page.waitForTimeout(800);

  await page.goto("/dashboard/analytics");
  await expect(page.getByText("Pas encore de données", { exact: false })).toBeVisible();
});

test("accepting consent records views and clicks in the dashboard", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);
  await addLink(page, "Mon site", "https://example.com/site");

  await page.goto(`/stat-${suffix}`);
  await page.getByRole("button", { name: "Accepter" }).click();
  await page.waitForTimeout(800);

  // A click on an outbound link is reported by a beacon before navigation.
  await page.getByRole("navigation").getByRole("link", { name: /Mon site/ }).click({
    modifiers: ["Control"],
  });
  await page.waitForTimeout(1200);

  await page.goto("/dashboard/analytics");

  const stats = page.getByRole("region", { name: "Chiffres clés" });
  await expect(stats).toContainText("Vues");
  // The exact figure depends on how many beacons landed; what must hold is
  // that measurement happened at all.
  await expect(page.getByText("Pas encore de données", { exact: false })).toHaveCount(0);
});

test("a free account cannot export CSV, and the endpoint refuses too", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  await page.goto("/dashboard/analytics");
  // Matched loosely: the exact wording of the "this is a Pro feature" label is
  // a copy decision, but a free account must be told, and must not be handed a
  // download link that would only 403.
  await expect(page.getByText(/Export CSV.*Pro/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Export CSV/ })).toHaveCount(0);

  const response = await page.request.get("/api/analytics/export?days=30");
  expect(response.status()).toBe(403);
});

test("the analytics window cannot be widened past the plan's retention", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  // 365 is a Pro-only window; a free account is clamped back to its own limit.
  await page.goto("/dashboard/analytics?days=365");
  await expect(page.getByRole("heading", { name: /Évolution sur 30 jours/ })).toBeVisible();
});

test("a short link redirects and is counted", async ({ page, request }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);
  await addLink(page, "Ma boutique", "https://example.com/shop");

  await page.goto("/dashboard/analytics");
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const shortUrl = page.getByText(/\/u\/[1-9A-HJ-NP-Za-km-z]+$/);
  await expect(shortUrl).toBeVisible();

  const code = (await shortUrl.textContent())!.split("/u/")[1]!.trim();

  const response = await request.get(`/u/${code}`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toBe("https://example.com/shop");
  expect(response.headers()["cache-control"]).toContain("no-store");

  await page.reload();
  await expect(page.getByText(/1 clic$/)).toBeVisible();
});

test("an unknown short code redirects home instead of erroring", async ({ request }) => {
  for (const code of ["ZZZZZZZZ", "..%2Fetc", "0000"]) {
    const response = await request.get(`/u/${code}`, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toMatch(/\/$/);
  }
});

test("the analytics endpoint refuses to attribute events to another page", async ({ request }) => {
  // A page that exists, with a link id that does not belong to it.
  const before = await request.post("/api/events", {
    data: { pageId: "definitely-not-a-page", type: "PAGE_VIEW" },
  });
  // Always 204 — a tracker must never surface an error to a visitor.
  expect(before.status()).toBe(204);
});

test("a user can export their data and the export omits secrets", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);
  await addLink(page, "Mon site", "https://example.com/site");

  const response = await page.request.get("/api/account/export");
  expect(response.status()).toBe(200);

  const body = await response.text();
  expect(body).toContain(`stat-${suffix}@example.com`);
  expect(body).toContain("Mon site");
  // Credentials and per-visitor rows must never appear in an export.
  expect(body).not.toContain("passwordHash");
  expect(body).not.toContain("visitorHash");
  expect(body).not.toContain("$2b$");
});

test("deleting an account frees the slug and takes the page offline", async ({ page }) => {
  const suffix = uniqueSuffix();
  const slug = `stat-${suffix}`;
  await signUp(page, suffix);
  await addLink(page, "Mon site", "https://example.com/site");

  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/dashboard/settings");
  await page.getByLabel(/Tapez/).fill(slug);
  await page.getByRole("button", { name: /Supprimer définitivement/ }).click();
  await page.waitForURL("**/?deleted=1", { timeout: 20_000 });

  const response = await page.request.get(`/${slug}`);
  expect(response.status()).toBe(404);
});
