import React from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";

type Props = { children: React.ReactNode };

// Public pages you never want to bounce away from
const PUBLIC_ROUTES = new Set<string>(["/login", "/register", "/forgot-password"]);

/**
 * Guardrails:
 * - Wait for provider initialization before deciding
 * - If there's no accessToken, silently redirect to /login (once) and render nothing.
 * - Never redirect when you're already on a public route.
 */
export default function ProtectedRoute({ children }: Props) {
  const { accessToken, initialized } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedRef = React.useRef(false);

  const isPublic = PUBLIC_ROUTES.has(location.pathname);

  React.useEffect(() => {
    if (!initialized) return; // wait for SessionProvider to finish
    if (!accessToken && !isPublic && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate("/login", { replace: true });
    }
  }, [initialized, accessToken, isPublic, navigate]);

  // While initializing, or while redirecting, render nothing to avoid flicker
  if (!initialized) return null;
  if (!accessToken && !isPublic) return null;

  return <>{children}</>;
}
