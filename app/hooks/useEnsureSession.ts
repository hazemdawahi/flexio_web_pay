import { useEffect, useRef } from "react";
import { useSession } from "~/context/SessionContext";
import { useRefreshSession } from "./useRefreshSession";

/**
 * On first mount, if there's no AT anywhere (context/sessionStorage),
 * try a single cookie-based refresh and populate session on success.
 */
export function useEnsureSession() {
  const { accessToken } = useSession();
  const { mutate, isPending } = useRefreshSession();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Is there any stored AT already (session only)?
    const hasStored =
      typeof sessionStorage !== "undefined" &&
      !!sessionStorage.getItem("accessToken");

    // If nothing in context or session, kick a cookie-based refresh now.
    if (!accessToken && !hasStored && !isPending) {
      mutate(); // useRefreshSession will set accessToken + inApp on success
    }
  }, [accessToken, isPending, mutate]);
}
