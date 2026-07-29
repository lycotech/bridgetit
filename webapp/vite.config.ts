import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { cspPlugin } from "./vite-csp-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8000,
  },
  plugins: [
    react(),
    // Injects the Content Security Policy (see vite-csp-plugin.ts for the
    // reasoning behind every directive) and serves security headers in dev.
    cspPlugin({ dev: mode === "development" }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // backend/src/types.ts is imported directly for shared Zod schemas, but
      // on Vercel only webapp's dependencies are installed — backend/node_modules
      // doesn't exist, so plain node resolution of "zod" from that file fails.
      // Force it to webapp's own copy regardless of which file imports it.
      zod: path.resolve(__dirname, "./node_modules/zod"),
    },
  },
  build: {
    // WHY: source maps published to production hand an attacker your original
    // TypeScript, including comments describing business rules and any
    // accidentally-embedded constant. Keep them out of the deployed bundle.
    sourcemap: false,
  },
}));
