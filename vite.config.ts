import { copyFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import type { Plugin, PluginOption } from "vite";

/**
 * Normalises the path a build will be served from into a Vite `base`. GitHub Pages serves a
 * project site from `/<repo>/`, and hands us that prefix without a trailing slash (or as an
 * empty string for a user site served from the root).
 */
export const asBasePath = (servedFrom: string | undefined): string => {
  const trimmed = (servedFrom ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
};

/**
 * GitHub Pages has no server-side rewrite, so a deep link like `/item/49234` hits a path that
 * doesn't exist as a file. Pages serves `404.html` for anything it can't find, so shipping a
 * copy of `index.html` under that name hands those requests to the router instead.
 */
const spaFallback = (): Plugin => {
  let outDir = "dist";

  return {
    name: "spa-fallback-404",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await copyFile(
        path.join(outDir, "index.html"),
        path.join(outDir, "404.html"),
      );
    },
  };
};

export default defineConfig(({ mode }) => ({
  // The Pages workflow passes BASE_PATH in; a plain local build is served from the root.
  base: asBasePath(process.env.BASE_PATH),
  plugins: [
    react(),
    spaFallback(),
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
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx", "*.spec.ts"],
  },
}));
