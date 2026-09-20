// Live Bee round-trip vitest config — used ONLY by `npm run test:live`.
// Deliberately separate from vitest.config.ts, which keeps the deterministic
// 37-test floor: this config discovers ONLY tests/live/**/*.test.ts, the REAL
// round trip against the human-verified Bee. That live test is env-gated
// (BEE_URL, BATCH_ID, PRIVATE_KEY from the git-ignored .env) and never mocks
// Bee/Feed, never reads Utils.*, never hardcodes a Topic/owner/index/
// reference, and never claims unrun results.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/live/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.git/**"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
