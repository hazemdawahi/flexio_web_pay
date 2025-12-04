import React from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";

type Props = { children: React.ReactNode };

const PUBLIC_ROUTES = new Set<string>(["/login", "/register", "/forgot-password", "/"]);

export default function ProtectedRoute({ children }: Props) {
  const { accessToken, initialized } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedRef = React.useRef(false);

  const isPublic = PUBLIC_ROUTES.has(location.pathname);

  React.useEffect(() => {
    if (!initialized) return;
    if (!accessToken && !isPublic && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate("/login", { replace: true });
    }
  }, [initialized, accessToken, isPublic, navigate]);

  if (!initialized) return null;
  if (!accessToken && !isPublic) return null;

  return <>{children}</>;
}