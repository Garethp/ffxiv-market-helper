import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import type { PluginOption } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // `yarn analyze` builds in this mode. Vite still bundles production code for any build mode,
    // so the report shows the same sizes a normal build ships.
    mode === "analyze" &&
      (visualizer({
        filename: "dist/bundle-stats.html",
        title: "Bundle size",
        gzipSize: true,
        open: true,
      }) as PluginOption),
  ],
  test: {
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
  },
}));
