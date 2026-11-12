import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    server: {
      port: 5174,
      proxy: {
        "/api/v1": {
          target: env.VITE_BACKEND_ORIGIN || "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
