import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 reads the connection URL from here rather than from the schema.
 * The runtime client gets its connection through the pg driver adapter in
 * `src/lib/db.ts`; this config is what the CLI (migrate, studio) uses.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
