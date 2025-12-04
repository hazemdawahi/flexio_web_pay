// File: src/hooks/useFetchContactsInfinite.ts
import { useEffect } from "react";
import {
  useInfiniteQuery,
  type QueryFunctionContext,
  type QueryKey,
} from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import { authFetch, AuthError, isBrowser } from "~/lib/auth/apiClient";

/* =========================
 * Types
 * ========================= */
interface ContactItem {
  phoneNumber: string;
  logo: string | null;
  id: string;
  username: string;
  isSubscribed: boolean;
}

interface PageableMeta {
  pageNumber: number;
  totalPages: number;
}

interface ContactResponse {
  success: boolean;
  data: {
    content: ContactItem[];
    pageable: PageableMeta;
    last: boolean;
  } | null;
  error: string | null;
}

/** Allow arrays or comma-separated strings, pass through as-is (controller accepts both). */
type MaybeArrayOrCSV = string[] | string | undefined;
type MaybeBooleanOrString = boolean | "true" | "false" | undefined;

/* =========================
 * Fetcher (authenticated, via authFetch)
 * ========================= */
async function fetchContacts(
  { pageParam }: QueryFunctionContext<QueryKey, unknown>,
  size: number,
  contacts: MaybeArrayOrCSV,
  searchTerm?: string,
  isSubscribed?: MaybeBooleanOrString,
  excludeUserIds?: MaybeArrayOrCSV,
  sort: string = "username,asc"
): Promise<ContactResponse> {
  const page = typeof pageParam === "number" ? pageParam : 0;

  // Build request body dynamically—omit fields if not provided
  const body: Record<string, unknown> = {};

  if (
    contacts &&
    (Array.isArray(contacts)
      ? contacts.length > 0
      : contacts.trim().length > 0)
  ) {
    body.contacts = contacts;
  }
  if (typeof searchTerm === "string" && searchTerm.length > 0) {
    body.searchTerm = searchTerm;
  }
  if (typeof isSubscribed !== "undefined" && isSubscribed !== null) {
    // controller accepts boolean or "true"/"false" string; pass through as given
    body.isSubscribed = isSubscribed;
  }
  if (
    excludeUserIds &&
    (Array.isArray(excludeUserIds)
      ? excludeUserIds.length > 0
      : excludeUserIds.trim().length > 0)
  ) {
    body.excludeUserIds = excludeUserIds;
  }

  const url = `/api/user/contacts?page=${page}&size=${size}&sort=${encodeURIComponent(
    sort
  )}`;

  // authFetch will attach the access token from central storage and
  // throw AuthError on 401, plus handle refresh tokens.
  return authFetch<ContactResponse>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* =========================
 * Hook (authenticated infinite query + 401 redirect)
 * ========================= */
export function useFetchContactsInfinite(
  size: number,
  contacts: MaybeArrayOrCSV,
  searchTerm?: string,
  isSubscribed?: MaybeBooleanOrString,
  excludeUserIds?: MaybeArrayOrCSV,
  sort: string = "username,asc"
) {
  const navigate = useNavigate();

  const query = useInfiniteQuery<ContactResponse, Error>({
    queryKey: [
      "contacts",
      size,
      // Use stable primitives in the key
      typeof contacts === "string" ? contacts : JSON.stringify(contacts ?? []),
      searchTerm ?? "",
      typeof isSubscribed === "string" ? isSubscribed : isSubscribed ?? "",
      typeof excludeUserIds === "string"
        ? excludeUserIds
        : JSON.stringify(excludeUserIds ?? []),
      sort,
    ],
    queryFn: (ctx) =>
      fetchContacts(ctx, size, contacts, searchTerm, isSubscribed, excludeUserIds, sort),
    getNextPageParam: (lastPage) => {
      const current = lastPage?.data?.pageable.pageNumber ?? 0;
      const total = lastPage?.data?.pageable.totalPages ?? 0;
      return current + 1 < total ? current + 1 : undefined;
    },
    initialPageParam: 0,
    enabled: isBrowser, // avoid running on SSR
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
