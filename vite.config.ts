import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The renderer ships its lookup tables inline, so the bundle is a few megabytes
// and there is nothing to fetch at runtime — which is the whole reason this demo
// can be client-only. The warning limit is raised rather than silenced by
// splitting: one chunk that loads once is the honest shape for it.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 8000 },
});
