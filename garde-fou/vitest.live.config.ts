import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests qui appellent le vrai Mistral via le serveur local : jamais lancés par `npm test`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.live.ts"], testTimeout: 60000, fileParallelism: false },
});
