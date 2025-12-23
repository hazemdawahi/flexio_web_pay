/**
 * Client Entry Point
 *
 * This is the entry point for the client-side application.
 * It hydrates the React application in the browser.
 *
 * For SPA mode (ssr: false), this renders the initial application.
 *
 * @see https://reactrouter.com/start/framework/installation
 */

import { HydratedRouter } from "react-router/dom";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

/**
 * Hydrate the application
 *
 * Uses startTransition for non-blocking hydration, which:
 * - Allows the browser to handle events during hydration
 * - Prevents the UI from freezing on slow devices
 * - Provides a better user experience
 */
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
