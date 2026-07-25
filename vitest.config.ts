import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // tsconfig.json sets "jsx": "preserve" (Next.js does its own JSX transform),
  // but Vitest has no such downstream step — force automatic JSX transform
  // here so co-located *.test.ts files can import from .tsx modules (e.g.
  // ModuleField.tsx) without a parse error. Vitest 4's default transform is
  // oxc, not esbuild, hence the `oxc` key rather than `esbuild`.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 15000,
  },
});
