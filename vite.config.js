import { defineConfig } from "vite";

// builds to /docs — matches GH Pages layout, contest needs static hosting
export default defineConfig({
  base: "./",
  build: {
    outDir: "docs",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
});
