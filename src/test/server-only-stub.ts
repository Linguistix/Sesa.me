/**
 * Test-time stand-in for the `server-only` package.
 *
 * That package throws when imported from a client bundle, which is exactly
 * what we want in the app and exactly what makes server modules impossible to
 * unit-test. Vitest aliases the import here; the real package is still what
 * `next build` resolves, so the boundary it enforces is unchanged.
 */
export {};
