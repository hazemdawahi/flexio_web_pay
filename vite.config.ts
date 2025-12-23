import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    // Tailwind v4 Vite plugin - handles CSS processing
    tailwindcss(),
    // React Router v7 Vite plugin - handles routing, code splitting, etc.
    reactRouter(),
    // TypeScript path aliases support
    tsconfigPaths(),
  ],

  // Development server configuration
  server: {
    host: "0.0.0.0", // Expose the server on all interfaces
    // Enable faster HMR
    hmr: {
      overlay: true,
    },
  },

  // Build optimization for production
  build: {
    // Target modern browsers for smaller bundles
    target: "esnext",
    // Enable minification
    minify: "esbuild",
    // Disable sourcemaps in production for security and smaller bundle size
    sourcemap: false,
    // Rollup options for code splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching (client builds only)
        manualChunks(id) {
          // Skip for SSR builds (modules resolved as external)
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || (id.includes("/react/") && !id.includes("react-router"))) {
              return "react-vendor";
            }
            if (id.includes("react-router")) {
              return "router-vendor";
            }
            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }
            if (id.includes("@stripe/react-stripe-js") || id.includes("@stripe/stripe-js")) {
              return "stripe-vendor";
            }
          }
        },
      },
    },
    // Increase chunk size warning limit (optional)
    chunkSizeWarningLimit: 1000,
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router",
      "@tanstack/react-query",
      "@stripe/react-stripe-js",
    ],
  },
});
