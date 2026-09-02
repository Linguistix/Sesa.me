import { expect, test } from "./fixtures";
import { type Page } from "@playwright/test";
import { Client } from "pg";

/**
 * The suite talks to the database directly for setup that has no UI.
 *
 * The alternative — a test-only API route — would mean shipping an endpoint
 * that mutates auth state, guarded by nothing but an environment variable.
 * Playwright tests run in Node, so there is no reason to put that surface in
 * the application at all.
 *
 * `pg` rather than the Prisma client: Prisma 7 generates an ESM-only client
 * and Playwright transpiles specs to CommonJS, so importing it here fails on
 * `import.meta`. Two statements do not justify fighting that.
 */
async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function expireAccessToken(email: string): Promise<string> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `UPDATE accounts SET expires_at = EXTRACT(EPOCH FROM now())::int - 60
         WHERE "userId" = (SELECT id FROM users WHERE email = $1)
           AND type = 'oauth'
       RETURNING access_token`,
      [email],
    );
    if (rows.length === 0) throw new Error(`No connection for ${email}`);
    return rows[0].access_token as string;
  });
}

async function currentAccessToken(email: string): Promise<string> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT access_token FROM accounts
         WHERE "userId" = (SELECT id FROM users WHERE email = $1) AND type = 'oauth'`,
      [email],
    );
    return (rows[0]?.access_token as string) ?? "";
  });
}

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Conn ${suffix}`);
  await page.locator('input[name="slug"]').fill(`conn-${suffix}`);
  await page.getByLabel("E-mail").fill(`conn-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

async function connectSpotify(page: Page) {
  await page.goto("/dashboard/connections");
  await page.getByRole("link", { name: "Connecter" }).first().click();
  await page.waitForURL("**/dashboard/connections?status=connected", { timeout: 20_000 });
}

test("connecting is refused when signed out", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/api/connections/spotify/start");
  await expect(page).toHaveURL(/\/login/);
});

test("an unknown provider is rejected rather than 500ing", async ({ page }) => {
  await signUp(page, uniqueSuffix());
  await page.goto("/api/connections/not-a-provider/start");
  await expect(page).toHaveURL(/error=unknown_provider/);
});

test("a creator can connect an account through the full OAuth flow", async ({ page }) => {
  await signUp(page, uniqueSuffix());
  await connectSpotify(page);

  await expect(page.getByText("Compte connecté.")).toBeVisible();
  // The label comes from the provider's own profile endpoint, proving the
  // access token was exchanged and used.
  await expect(page.getByText("Camille Officiel")).toBeVisible();
  await expect(page.getByText("Connecté", { exact: true })).toBeVisible();
});

test("the callback refuses a mismatched state — CSRF protection", async ({ page }) => {
  await signUp(page, uniqueSuffix());

  // Start a real flow so the cookie exists, then land on the callback with a
  // state the flow never issued.
  await page.goto("/dashboard/connections");
  const start = await page.request.get("/api/connections/spotify/start", { maxRedirects: 0 });
  expect(start.status()).toBe(302);

  await page.goto("/api/connections/spotify/callback?code=code_forged&state=not-the-state");
  await expect(page).toHaveURL(/status=state_mismatch/);
});

test("the callback refuses a code with no flow cookie at all", async ({ page }) => {
  await signUp(page, uniqueSuffix());

  await page.goto("/api/connections/spotify/callback?code=abc&state=abc");
  await expect(page).toHaveURL(/status=expired/);
});

test("a user declining at the provider is handled as a cancellation", async ({ page }) => {
  await signUp(page, uniqueSuffix());

  await page.goto("/api/connections/spotify/callback?error=access_denied&state=x");
  await expect(page).toHaveURL(/status=cancelled/);
});

test("a synced block resolves its content from the connected account", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);
  await connectSpotify(page);

  await page.goto("/dashboard");

  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await addBlock.getByLabel("Titre", { exact: true }).fill("Ma musique");
  await addBlock.getByLabel("Source automatique").selectOption("SPOTIFY_LATEST_RELEASE");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();

  const blockList = page.getByRole("list", { name: "Blocs de la page" });
  await expect(blockList.getByText("synchronisé", { exact: false })).toBeVisible();

  // The provider returns an old album and a newer one; the newer must win,
  // which proves the sort is ours and not the endpoint's ordering.
  await expect(blockList.getByText("Nouveau single")).toBeVisible();

  await page.goto(`/conn-${suffix}`);
  const link = page.getByRole("navigation").getByRole("link", { name: /Nouveau single/ });
  await expect(link).toHaveAttribute("href", "https://open.spotify.com/album/new222");
});

test("disconnecting stops the sync but keeps the block and its content", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);
  await connectSpotify(page);

  await page.goto("/dashboard");
  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await addBlock.getByLabel("Titre", { exact: true }).fill("Ma musique");
  await addBlock.getByLabel("Source automatique").selectOption("SPOTIFY_LATEST_RELEASE");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();

  const blockList = page.getByRole("list", { name: "Blocs de la page" });
  await expect(blockList.getByText("Nouveau single")).toBeVisible();

  await page.goto("/dashboard/connections");
  await page.getByRole("button", { name: "Déconnecter" }).click();
  await expect(page.getByRole("link", { name: "Connecter" })).toBeVisible();

  // Losing a token must not delete a creator's block: the content it last
  // resolved stays, and only the sync stops.
  await page.goto(`/conn-${suffix}`);
  await expect(
    page.getByRole("navigation").getByRole("link", { name: /Nouveau single/ }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(blockList.getByText(/ne se met plus à jour/)).toBeVisible();
});

test("the sync source selector is hidden without a connected account", async ({ page }) => {
  await signUp(page, uniqueSuffix());
  await page.goto("/dashboard");

  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await expect(addBlock.getByLabel("Source automatique")).toHaveCount(0);
});

test("an expired access token is refreshed automatically before use", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);
  await connectSpotify(page);

  await page.goto("/dashboard");
  const addBlock = page.locator("form").filter({ hasText: "Ajouter le bloc" });
  await addBlock.getByLabel("Titre", { exact: true }).fill("Ma musique");
  await addBlock.getByLabel("Source automatique").selectOption("SPOTIFY_LATEST_RELEASE");
  await addBlock.getByRole("button", { name: "Ajouter le bloc" }).click();

  const blockList = page.getByRole("list", { name: "Blocs de la page" });
  await expect(blockList.getByText("Nouveau single")).toBeVisible();

  // Expire the stored grant and force a resync. The happy path never exercises
  // the refresh branch, and a silently broken refresh means every connection
  // dies an hour after it is made.
  const before = await expireAccessToken(`conn-${suffix}@example.com`);
  expect(before).toMatch(/^access_/);

  await page.goto("/dashboard/connections");
  await page.getByRole("button", { name: "Synchroniser maintenant" }).click();
  // Scoped to the live region: the page's intro copy also contains "à jour".
  await expect(page.getByRole("status")).toContainText(/à jour/, { timeout: 15_000 });

  const current = await currentAccessToken(`conn-${suffix}@example.com`);

  // A refreshed token, not the expired one — and the block still works.
  expect(current).toMatch(/^access_refreshed_/);
  await expect(page.getByText(/⚠/)).toHaveCount(0);
});
