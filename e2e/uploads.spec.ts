import { expect, test } from "./fixtures";
import { type Page } from "@playwright/test";

/** Direct-to-storage uploads (presigned PUT straight to the bucket). */

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function signUp(page: Page, suffix: string) {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill(`Up ${suffix}`);
  await page.locator('input[name="slug"]').fill(`up-${suffix}`);
  await page.getByLabel("E-mail").fill(`up-${suffix}@example.com`);
  await page.getByLabel(/Mot de passe/).fill("motdepasse123");
  await page.getByRole("button", { name: "Créer ma page" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

/** A real 1x1 PNG, so the upload carries genuine image bytes. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("presigning requires authentication", async ({ request }) => {
  const response = await request.post("/api/uploads/presign", {
    data: { purpose: "avatar", contentType: "image/png", contentLength: 100 },
  });
  expect(response.status()).toBe(401);
});

test("presigning refuses types that could be served as script", async ({ page }) => {
  await signUp(page, uniqueSuffix());

  for (const contentType of ["image/svg+xml", "text/html", "application/pdf"]) {
    const response = await page.request.post("/api/uploads/presign", {
      data: { purpose: "avatar", contentType, contentLength: 1000 },
    });
    expect(response.status(), contentType).toBe(422);
  }
});

test("presigning enforces the size cap per purpose", async ({ page }) => {
  await signUp(page, uniqueSuffix());

  const tooBigForAvatar = 3 * 1024 * 1024;

  const avatar = await page.request.post("/api/uploads/presign", {
    data: { purpose: "avatar", contentType: "image/png", contentLength: tooBigForAvatar },
  });
  expect(avatar.status()).toBe(422);

  // The same size is acceptable for a gallery photo.
  const gallery = await page.request.post("/api/uploads/presign", {
    data: { purpose: "gallery", contentType: "image/png", contentLength: tooBigForAvatar },
  });
  expect(gallery.status()).toBe(200);
});

test("the object key is derived from the session, not from the request", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  const response = await page.request.post("/api/uploads/presign", {
    // A client trying to choose its own key: the field is simply ignored.
    data: {
      purpose: "avatar",
      contentType: "image/png",
      contentLength: 100,
      key: "uploads/someone-else/avatar/pwned.png",
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.key).not.toContain("someone-else");
  expect(body.key).toMatch(/^uploads\/[a-z0-9]+\/avatar\/[a-f0-9]+\.png$/);
});

test("a presigned URL uploads to storage and the object is then readable", async ({ page }) => {
  await signUp(page, uniqueSuffix());

  const presign = await page.request.post("/api/uploads/presign", {
    data: { purpose: "avatar", contentType: "image/png", contentLength: PNG.length },
  });
  expect(presign.status()).toBe(200);

  const { uploadUrl, publicUrl, headers } = await presign.json();

  // The URL must actually be signed — an unsigned URL would mean the bucket
  // is being written to without credentials.
  expect(uploadUrl).toContain("X-Amz-Signature");
  expect(uploadUrl).toContain("X-Amz-Expires");

  const put = await page.request.fetch(uploadUrl, {
    method: "PUT",
    headers,
    data: PNG,
  });
  expect(put.status()).toBe(200);
  expect(put.headers()["x-signed"]).toBe("yes");

  // Read it back from the public URL the app will store on the page.
  const fetched = await page.request.get(publicUrl);
  expect(fetched.status()).toBe(200);
  expect(fetched.headers()["content-type"]).toBe("image/png");
  expect(Buffer.from(await fetched.body()).equals(PNG)).toBe(true);
});

test("content type and length are inside the signature, not just the request", async ({
  page,
}) => {
  await signUp(page, uniqueSuffix());

  const presign = await page.request.post("/api/uploads/presign", {
    data: { purpose: "avatar", contentType: "image/png", contentLength: PNG.length },
  });
  const { uploadUrl, headers } = await presign.json();

  // This is what makes the caps real: the provider recomputes the signature
  // over these headers, so a client that changes either one is rejected. A
  // client-side check alone could simply be skipped.
  const signedHeaders = new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders") ?? "";
  expect(signedHeaders).toContain("content-length");
  expect(signedHeaders).toContain("content-type");

  // And the client is told exactly what it must send.
  expect(headers["Content-Type"]).toBe("image/png");
  expect(headers["Content-Length"]).toBe(String(PNG.length));
});

test("the uploader appears in the editor and sets the avatar field", async ({ page }) => {
  const suffix = uniqueSuffix();
  await signUp(page, suffix);

  const upload = page.getByText("Téléverser une image").first();
  await expect(upload).toBeVisible();

  await page.locator("#upload-avatar").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: PNG,
  });

  // The field is filled with the public URL once the upload completes.
  const field = page.locator('input[name="avatarUrl"]');
  await expect(field).toHaveValue(/\/uploads\/.+\.png$/, { timeout: 15_000 });

  await page.getByRole("button", { name: "Enregistrer" }).click();
  // The confirmation is a live region; asserting on the role rather than the
  // exact sentence keeps this test about "the save was confirmed".
  await expect(page.getByRole("status")).toContainText("Enregistré");

  // And it renders on the public page.
  await page.goto(`/up-${suffix}`);
  await expect(page.locator('img[alt*="Photo de profil"]')).toHaveAttribute(
    "src",
    /\/uploads\/.+\.png$/,
  );
});
