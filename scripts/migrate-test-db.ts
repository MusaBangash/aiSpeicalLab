/**
 * Applies existing migrations to the test database (stlab_test), without
 * the shadow-DB/prompt machinery `prisma migrate dev` needs — appropriate
 * for a non-interactive test DB. Reads TEST_DATABASE_URL from .env.test and
 * overrides DATABASE_URL for the one `prisma migrate deploy` subprocess call.
 *
 * Usage: npm run test:db:migrate
 */
import { config } from "dotenv";
import { execSync } from "node:child_process";

config({ path: ".env.test" });

if (!process.env.TEST_DATABASE_URL) {
  console.error("TEST_DATABASE_URL is not set — add it to .env.test first (see .env.example).");
  process.exit(1);
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
});
