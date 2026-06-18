import { defineConfig } from "vite";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "./security.config.js";

// CSP only in the build
function contentSecurityPolicy() {
  return {
    name: "lyrstack:csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

function woff2Only() {
  return {
    name: "lyrstack:woff2-only",
    apply: "build",
    generateBundle(_, bundle) {
      for (const [name, file] of Object.entries(bundle)) {
        if (name.endsWith(".woff")) delete bundle[name];
        else if (name.endsWith(".css") && file.type === "asset") {
          file.source = String(file.source).replace(/,\s*url\([^)]*\.woff\)\s*format\(["']woff["']\)/g, "");
        }
      }
    },
  };
}

// build to /docs for GitHub Pages
export default defineConfig({
  base: "./",
  plugins: [contentSecurityPolicy(), woff2Only()],
  build: {
    outDir: "docs",
    emptyOutDir: true,
    sourcemap: false,
    // keep fonts as files
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  server: {
    port: 5173,
    open: true,
    headers: SECURITY_HEADERS,
  },
  preview: {
    headers: {
      ...SECURITY_HEADERS,
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    },
  },
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
  },
});
