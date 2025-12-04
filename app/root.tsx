import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { useEffect, useMemo } from "react";
import "./tailwind.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SessionProvider from "./provider/sessionProvider";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { toast } from "sonner";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

const queryClient = new QueryClient();

export default function Root() {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  console.log("stripe key", stripeKey);

  const stripePromise = useMemo(() => loadStripe(stripeKey), [stripeKey]);

  useEffect(() => {
    function handlePaymentMessages(event: MessageEvent) {
      if (!event.data) return;

      const { status, error } = event.data;

      if (status === "COMPLETED") {
        console.log("Root.tsx => Payment COMPLETED message received");
        toast.success("Payment completed successfully!");
      } else if (status === "FAILED") {
        console.log("Root.tsx => Payment FAILED or canceled", error);
        toast.error(error || "Payment canceled or closed before completion.");
      }
    }

    window.addEventListener("message", handlePaymentMessages);
    return () => {
      window.removeEventListener("message", handlePaymentMessages);
    };
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <Elements stripe={stripePromise}>
              <Outlet />
            </Elements>
          </SessionProvider>
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}