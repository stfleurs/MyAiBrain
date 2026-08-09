import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

export default defineConfig({
  test: {
    environment: "node",
  },
});
