import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiProxy = process.env.VITE_API_PROXY ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("echarts")) return "visualization";
          if (id.includes("react-markdown") || id.includes("remark-") || id.includes("unified")) return "markdown";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react")) return "react";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: apiProxy, xfwd: true } },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
