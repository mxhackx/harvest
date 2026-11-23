import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgres://harvest:harvest@localhost:54329/harvest_test",
      // les tests ne doivent jamais dépendre des vraies clés de api/.env
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
    },
    globalSetup: ["./src/test/global-setup.ts"],
    fileParallelism: false,
  },
});
