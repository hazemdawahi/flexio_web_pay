import { useInfiniteQuery, QueryFunctionContext, QueryKey } from '@tanstack/react-query';

interface ContactResponse {
  success: boolean;
  data: {
    content: Array<{
      phoneNumber: string;
      logo: string;
      id: string;
      username: string;
    }>;
    pageable: {
      pageNumber: number;
      totalPages: number;
    };
    last: boolean;
  } | null;
  error: string | null;
}

async function fetchContacts(
  { pageParam }: QueryFunctionContext<QueryKey, unknown>,
  size: number,
  contacts: string[],
  searchTerm: string
): Promise<ContactResponse> {
  const page = typeof pageParam === 'number' ? pageParam : 0; // Ensure pageParam is a number, defaulting to 0
  const token = sessionStorage.getItem('accessToken');
  
  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`http://192.168.1.32:8080/api/user/contacts?page=${page}&size=${size}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contacts, searchTerm }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data as ContactResponse;
}

export function useFetchContactsInfinite(size: number, contacts: string[], searchTerm: string) {
  return useInfiniteQuery<ContactResponse, Error>({
    queryKey: ['contacts', size, contacts, searchTerm],
    queryFn: (context) => fetchContacts(context, size, contacts, searchTerm),
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.data) return undefined;
      const currentPage = lastPage.data.pageable.pageNumber;
      const totalPages = lastPage.data.pageable.totalPages;
      return currentPage + 1 < totalPages ? currentPage + 1 : undefined;
    },
    initialPageParam: 0,
    // Optional: You can add additional configurations here
    // such as staleTime, cacheTime, etc.
  });
}
