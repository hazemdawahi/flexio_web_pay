/**
 * Root Route Module
 *
 * This is the root of the application following React Router v7 Framework Mode.
 * It provides the HTML shell, error boundaries, and global providers.
 *
 * @see https://reactrouter.com/start/framework/route-module
 */
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  Link,
} from "react-router";
import type { LinksFunction, MetaFunction } from "react-router";
import { Suspense, useEffect, useMemo } from "react";
import "./tailwind.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "~/lib/query";
import SessionProvider from "./provider/sessionProvider";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { toast, Toaster } from "sonner";

/**
 * Links function for preloading resources
 * Defines <link> elements for the document <head>
 */
export const links: LinksFunction = () => [
  // Preconnect to Google Fonts for faster font loading
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  // Load Inter font - only weights actually used for faster loading
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  // Preconnect to Stripe for faster payment loading
  { rel: "preconnect", href: "https://js.stripe.com" },
];

/**
 * Meta function for SEO
 * Defines <title> and <meta> elements for the document <head>
 */
export const meta: MetaFunction = () => [
  { title: "Flexio Pay - Secure Payment Solutions" },
  { name: "description", content: "Flexio Pay provides secure, flexible payment plans and checkout solutions for seamless transactions." },
];

// Singleton QueryClient for the entire application
// Uses centralized configuration from ~/lib/query
const queryClient = getQueryClient();

/**
 * Layout Component
 *
 * Wraps the entire application with HTML structure.
 * This is the shell that persists across all routes.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-white antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * HydrateFallback Component
 *
 * Rendered during initial page load while the clientLoader runs.
 * Provides immediate visual feedback to users.
 */
export function HydrateFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

/**
 * ErrorBoundary Component
 *
 * Catches and displays errors that occur in the route tree.
 * Handles both route errors (4xx, 5xx) and unexpected errors.
 */
export function ErrorBoundary() {
  const error = useRouteError();

  // Handle route error responses (404, 500, etc.)
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            {error.status}
          </h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            {error.statusText || "Something went wrong"}
          </h2>
          {error.data && (
            <p className="text-gray-600 mb-8">{String(error.data)}</p>
          )}
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Handle unexpected errors
  const errorMessage =
    error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Oops!</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-8">{errorMessage}</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            Refresh Page
          </button>
          <Link
            to="/"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Root Component
 *
 * The main application component that provides global context.
 * Sets up providers for React Query, Session, and Stripe.
 */
export default function Root() {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

  // Memoize Stripe promise to prevent re-initialization
  const stripePromise = useMemo(() => {
    if (!stripeKey) {
      console.warn("Stripe public key not configured");
      return null;
    }
    return loadStripe(stripeKey);
  }, [stripeKey]);

  // Global message listener for payment events (from iframes/popups)
  useEffect(() => {
    function handlePaymentMessages(event: MessageEvent) {
      if (!event.data) return;

      const { status, error } = event.data;

      if (status === "COMPLETED") {
        toast.success("Payment completed successfully!");
      } else if (status === "FAILED") {
        toast.error(error || "Payment canceled or closed before completion.");
      }
    }

    window.addEventListener("message", handlePaymentMessages);
    return () => {
      window.removeEventListener("message", handlePaymentMessages);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Suspense fallback={<HydrateFallback />}>
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <Outlet />
            </Elements>
          ) : (
            <Outlet />
          )}
        </Suspense>
      </SessionProvider>
      {/* Toast notifications */}
      <Toaster position="top-center" richColors closeButton />
      {/* React Query Devtools - only visible in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
