import { describe, expect, it } from "vitest";
import { codeChallenge, createCodeVerifier, createState, statesMatch } from "../pkce";

describe("createCodeVerifier", () => {
  it("meets the RFC 7636 length requirement", () => {
    for (let i = 0; i < 20; i++) {
      const verifier = createCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    }
  });

  it("uses the base64url alphabet, not standard base64", () => {
    for (let i = 0; i < 50; i++) {
      expect(createCodeVerifier()).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });

  it("is unpredictable", () => {
    const seen = new Set(Array.from({ length: 500 }, () => createCodeVerifier()));
    expect(seen.size).toBe(500);
  });
});

describe("codeChallenge", () => {
  it("matches the RFC 7636 worked example", () => {
    // Appendix B of RFC 7636.
    expect(codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("is deterministic for a given verifier", () => {
    const verifier = createCodeVerifier();
    expect(codeChallenge(verifier)).toBe(codeChallenge(verifier));
  });

  it("differs for different verifiers", () => {
    expect(codeChallenge(createCodeVerifier())).not.toBe(codeChallenge(createCodeVerifier()));
  });

  it("is not reversible to the verifier", () => {
    const verifier = createCodeVerifier();
    expect(codeChallenge(verifier)).not.toContain(verifier);
  });
});

describe("statesMatch", () => {
  it("accepts identical states", () => {
    const state = createState();
    expect(statesMatch(state, state)).toBe(true);
  });

  it("rejects different states", () => {
    expect(statesMatch(createState(), createState())).toBe(false);
  });

  it("rejects a prefix, which a naive startsWith check would accept", () => {
    const state = createState();
    expect(statesMatch(state, state.slice(0, -1))).toBe(false);
    expect(statesMatch(state.slice(0, -1), state)).toBe(false);
  });

  it("rejects empty against non-empty without throwing", () => {
    expect(statesMatch("", createState())).toBe(false);
    expect(statesMatch(createState(), "")).toBe(false);
  });
});
