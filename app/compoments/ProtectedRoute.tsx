import React from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";

type Props = { children: React.ReactNode };

// Public pages you never want to bounce away from
const PUBLIC_ROUTES = new Set<string>(["/login", "/register", "/forgot-password"]);

/**
 * Guardrails:
 * - If there's no accessToken, silently redirect to /login (once) and render nothing.
 * - Never block forever with a spinner.
 * - Never redirect when you're already on a public route.
 */
export default function ProtectedRoute({ children }: Props) {
  const { accessToken } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedRef = React.useRef(false);

  React.useEffect(() => {
    if (!accessToken && !PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate("/login", { replace: true });
    }
  }, [accessToken, location.pathname, navigate]);

  // If not authenticated, render nothing while the redirect occurs.
  if (!accessToken) return null;

  return <>{children}</>;
}
