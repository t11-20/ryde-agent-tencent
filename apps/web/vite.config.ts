/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_PROXY_TARGET || "http://localhost:3001";
  return {
    plugins: [react()],
    // @fairtrip/evidence is a file: dependency; make it share this app's zod and react.
    resolve: { dedupe: ["zod", "react", "react-dom"] },
    server: { port: 5173, proxy: { "/api": { target, changeOrigin: true } } },
    test: {
      environment: "jsdom",
      setupFiles: ["./test/setup.ts"],
      include: ["test/**/*.test.{ts,tsx}"],
    },
  };
});
