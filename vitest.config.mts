import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws on import outside a React Server Component, which
      // makes genuinely-server modules (billing, sync) untestable. Aliasing it
      // to a no-op lets them be unit-tested; it does not weaken the guard in
      // the real build, where the package is resolved normally.
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
  },
});
