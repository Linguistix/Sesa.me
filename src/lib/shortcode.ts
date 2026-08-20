import { randomBytes } from "node:crypto";

/**
 * Short-code alphabet.
 *
 * Standard Base58: digits and letters minus the four glyphs that are hard to
 * tell apart in most fonts — `0` (vs `O`), `O`, `I` and `l` (vs `1`). Short
 * codes get read aloud, typed from a printed card and copied off a screenshot,
 * so removing those confusions matters more than the lost entropy.
 */
export const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const DEFAULT_CODE_LENGTH = 7;

/**
 * Generates a random code using rejection sampling.
 *
 * `randomBytes` values are taken modulo the alphabet length only when they
 * fall inside the largest exact multiple of it; the rest are discarded. Plain
 * modulo would make the first few characters of the alphabet slightly more
 * likely, which is a needless bias in an identifier meant to be unguessable.
 */
export function generateCode(length = DEFAULT_CODE_LENGTH): string {
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";

  while (out.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= max) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }

  return out;
}

export function isValidCode(code: string): boolean {
  if (code.length < 3 || code.length > 16) return false;
  return [...code].every((c) => ALPHABET.includes(c));
}
