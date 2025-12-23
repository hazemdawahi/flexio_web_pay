import type { Config } from "@react-router/dev/config";

/**
 * React Router v7 Configuration
 *
 * This configuration optimizes the application for SPA (Single Page Application) mode
 * with efficient client-side rendering and data fetching.
 *
 * @see https://reactrouter.com/start/framework/rendering
 */
export default {
  /**
   * SPA Mode - Disable server-side rendering
   * All routes are client-side rendered for optimal SPA performance.
   * Data is fetched via clientLoader functions.
   */
  ssr: false,

  /**
   * Basename for the application
   * Useful if the app is served from a subdirectory
   */
  // basename: "/app",

  /**
   * Future flags for upcoming React Router features
   * Enable these for forward compatibility
   */
  future: {
    // Enable new relative splat path resolution
    // v3_relativeSplatPath: true,
  },
} satisfies Config;
