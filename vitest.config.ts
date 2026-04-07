import path from "path"
import { defineConfig } from "vitest/config"
import solidPlugin from "vite-plugin-solid"

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
