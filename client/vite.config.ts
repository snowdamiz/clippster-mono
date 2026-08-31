import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
function stripeReturnHtml() {
  return {
    name: "stripe-return-html",
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, _res: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((req, _res, next) => {
        const pathOnly = req.url?.split("?")[0];
        if (pathOnly === "/stripe-success") {
          req.url = req.url?.replace("/stripe-success", "/stripe-success.html");
        } else if (pathOnly === "/stripe-cancel") {
          req.url = req.url?.replace("/stripe-cancel", "/stripe-cancel.html");
        }
        next();
      });
    },
  };
}

export default defineConfig(async () => ({
  plugins: [
    vue(),
    stripeReturnHtml(),
    // React plugin for Remotion - only processes .tsx files in /remotion folder
    react({
      include: /src\/remotion\/.*\.tsx$/,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@clippster/cloud-sync-schema": path.resolve(
        __dirname,
        "../packages/cloud-sync-schema/src/index.ts",
      ),
      "@clippster/app-tour": path.resolve(__dirname, "../packages/app-tour/src/index.ts"),
    },
  },

  // Optimize React and Remotion dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'remotion', '@remotion/player'],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
