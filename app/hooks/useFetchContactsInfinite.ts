// File: src/hooks/useFetchContactsInfinite.ts
import { useEffect, useMemo } from "react";
import {
  useInfiniteQuery,
  keepPreviousData,
  type QueryFunctionContext,
  type QueryKey,
} from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authFetch, AuthError, isBrowser, getAccessToken } from "~/lib/auth/apiClient";

/* =========================
 * Types
 * ========================= */
export interface ContactItem {
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
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  // Memoize filter params for stable query key
  const filterParams = useMemo(
    () => ({
      contacts: typeof contacts === "string" ? contacts : JSON.stringify(contacts ?? []),
      searchTerm: searchTerm ?? "",
      isSubscribed: typeof isSubscribed === "string" ? isSubscribed : String(isSubscribed ?? ""),
      excludeUserIds: typeof excludeUserIds === "string"
        ? excludeUserIds
        : JSON.stringify(excludeUserIds ?? []),
      sort,
    }),
    [contacts, searchTerm, isSubscribed, excludeUserIds, sort]
  );

  const query = useInfiniteQuery<ContactResponse, Error>({
    // Hierarchical query key: [domain, entity, params]
    queryKey: ["user", "contacts", "infinite", { size, ...filterParams }],
    queryFn: (ctx) =>
      fetchContacts(ctx, size, contacts, searchTerm, isSubscribed, excludeUserIds, sort),
    getNextPageParam: (lastPage) => {
      const current = lastPage?.data?.pageable.pageNumber ?? 0;
      const total = lastPage?.data?.pageable.totalPages ?? 0;
      return current + 1 < total ? current + 1 : undefined;
    },
    getPreviousPageParam: (firstPage) => {
      const current = firstPage?.data?.pageable.pageNumber ?? 0;
      return current > 0 ? current - 1 : undefined;
    },
    initialPageParam: 0,
    enabled: isBrowser && !!token,
    // Cache for 3 minutes
    staleTime: 1000 * 60 * 3,
    // Keep previous data while fetching new results (prevents flicker)
    placeholderData: keepPreviousData,
    // Limit cached pages to prevent memory issues with large lists
    maxPages: 5,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}

/**
 * Helper to flatten all pages into a single array of contacts
 *
 * @example
 * const query = useFetchContactsInfinite(20, []);
 * const allContacts = flattenContactPages(query.data);
 */
export function flattenContactPages(
  data: ReturnType<typeof useFetchContactsInfinite>["data"]
): ContactItem[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page) => page?.data?.content ?? []);
}
