import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    cloudflare({
      inspectorPort: false,
      persistState: { path: process.env.MEONO_STATE_PATH ?? ".wrangler/state" },
    }),
  ],
});
