/** Points db.ts's PrismaClient singleton at the test database — must run
 *  before any test file's own `import { db } from "@/lib/db"` resolves,
 *  since that singleton is constructed at module-load time. Vitest's
 *  setupFiles are guaranteed to finish first within a worker, which is
 *  exactly the ordering this relies on. */
import { config } from "dotenv";

config({ path: ".env.test", override: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
