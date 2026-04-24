import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom")) return "react-dom";
          if (
            id.includes("/react/") ||
            id.includes("react-router") ||
            id.includes("scheduler")
          ) {
            return "react-core";
          }
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@supabase")) return "supabase";
          if (
            id.includes("recharts") ||
            id.includes("d3-") ||
            id.includes("victory-vendor")
          ) {
            return "charts";
          }
          if (id.includes("lucide-react")) return "icons";
          if (
            id.includes("date-fns") ||
            id.includes("react-day-picker")
          ) {
            return "date";
          }
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("zod")
          ) {
            return "forms";
          }
          return "vendor";
        },
      },
    },
  },
}));
