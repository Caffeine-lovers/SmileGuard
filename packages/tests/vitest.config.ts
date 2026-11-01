import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/**/*.test.ts",
      ],
    },
  },
  resolve: {
    alias: {
      // Real patient-web modules (pure ones only — no Supabase client imports)
      "@": path.resolve(__dirname, "../../apps/patient-web"),
      "@smileguard/shared-types": path.resolve(
        __dirname,
        "../shared-types/index.ts"
      ),
      "@smileguard/shared-hooks": path.resolve(
        __dirname,
        "../shared-hooks/index.ts"
      ),
    },
  },
});
