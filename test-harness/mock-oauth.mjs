// A minimal OAuth 2.0 + PKCE provider, plus the slice of the Spotify API the
// sync engine calls. Enough to drive the real flow end to end.
import { createServer } from "node:http";
import { createHash } from "node:crypto";

const codes = new Map();     // code -> { challenge }
const tokens = new Map();    // access_token -> { refreshable }
let counter = 0;

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString();
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // --- Authorization endpoint: immediately redirects back with a code ------
  if (url.pathname === "/authorize") {
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    const challenge = url.searchParams.get("code_challenge");
    const method = url.searchParams.get("code_challenge_method");

    if (!redirectUri || !state || !challenge || method !== "S256") {
      json(res, 400, { error: "invalid_request", got: { state, challenge, method } });
      return;
    }

    // The test can force a user denial.
    if (url.searchParams.get("scope")?.includes("FORCE_DENY")) {
      res.writeHead(302, { Location: `${redirectUri}?error=access_denied&state=${state}` }).end();
      return;
    }

    const code = `code_${++counter}`;
    codes.set(code, { challenge });
    res.writeHead(302, { Location: `${redirectUri}?code=${code}&state=${state}` }).end();
    return;
  }

  // --- Token endpoint -----------------------------------------------------
  if (url.pathname === "/token" && req.method === "POST") {
    const params = new URLSearchParams(await readBody(req));
    const grant = params.get("grant_type");

    if (grant === "refresh_token") {
      if (params.get("refresh_token") !== "refresh_me") {
        json(res, 400, { error: "invalid_grant" });
        return;
      }
      const access = `access_refreshed_${++counter}`;
      tokens.set(access, { refreshable: true });
      // Deliberately omits refresh_token, as real providers often do.
      json(res, 200, { access_token: access, expires_in: 3600, token_type: "Bearer" });
      return;
    }

    const code = params.get("code");
    const verifier = params.get("code_verifier");
    const entry = code ? codes.get(code) : null;

    if (!entry) { json(res, 400, { error: "invalid_grant" }); return; }
    if (!verifier) { json(res, 400, { error: "missing_verifier" }); return; }

    // The whole point of PKCE: the verifier must hash to the stored challenge.
    const computed = base64url(createHash("sha256").update(verifier).digest());
    if (computed !== entry.challenge) { json(res, 400, { error: "invalid_verifier" }); return; }

    codes.delete(code);  // single use
    const access = `access_${++counter}`;
    tokens.set(access, { refreshable: true });

    json(res, 200, {
      access_token: access,
      refresh_token: "refresh_me",
      expires_in: 3600,
      token_type: "Bearer",
      scope: params.get("scope") ?? "",
    });
    return;
  }

  // --- Spotify-shaped API -------------------------------------------------
  const auth = req.headers.authorization ?? "";
  const access = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!access || !tokens.has(access)) { json(res, 401, { error: "unauthorized" }); return; }

  if (url.pathname === "/me") {
    json(res, 200, { id: "spotify_user_1", display_name: "Camille Officiel" });
    return;
  }

  if (url.pathname === "/me/albums") {
    json(res, 200, {
      items: [
        { album: { name: "Vieil album", release_date: "2019-01-01",
                   external_urls: { spotify: "https://open.spotify.com/album/old111" } } },
        { album: { name: "Nouveau single", release_date: "2026-08-01",
                   external_urls: { spotify: "https://open.spotify.com/album/new222" } } },
      ],
    });
    return;
  }

  json(res, 404, { error: "not_found" });
}).listen(9100, () => console.log("mock-oauth on 9100"));
