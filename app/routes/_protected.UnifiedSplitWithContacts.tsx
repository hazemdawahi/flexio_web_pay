import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { FaCheck } from 'react-icons/fa';
import { IoIosArrowBack } from 'react-icons/io';
import { FiSend } from 'react-icons/fi';
import { useNavigate, useSearchParams } from '@remix-run/react';
import debounce from 'lodash.debounce';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Toaster, toast } from 'sonner';
import { useFetchContactsInfinite } from '~/hooks/useFetchContactsInfinite';
import { useUserDetails } from '~/hooks/useUserDetails';
import ContactItem from '~/compoments/ContactItem';

/** ---------------- Types (match ContactItem expectations exactly) ---------------- */
type UIContact = {
  id: string;
  username: string;
  phoneNumber: string;
  email: string;       // REQUIRED to match ContactItem.Contact
  avatar?: string;     // optional (ContactItem tolerates avatar or logo)
  logo?: string;       // optional
};

const ITEMS_PER_LOAD = 20;

/** ---------------- URL helpers ---------------- */
const sanitizeParamString = (raw?: string | null) => {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'null' || low === 'undefined') return '';
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
};

const normalizeParam = (
  v: string | string[] | null,
  fallback = ''
): string => sanitizeParamString(Array.isArray(v) ? v[0] : v ?? fallback);

/** Canonicalize a discount list into JSON array of unique IDs (as strings). */
function canonicalizeDiscountList(raw: string): string {
  if (!raw || !raw.trim()) return '[]';

  const extractId = (x: any): string => {
    if (x == null) return '';
    if (typeof x === 'string' || typeof x === 'number') return String(x).trim();
    if (typeof x === 'object') {
      const v = x.id ?? x.discountId ?? x.code ?? '';
      return typeof v === 'string' || typeof v === 'number'
        ? String(v).trim()
        : '';
    }
    return '';
  };
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return JSON.stringify(uniq(parsed.map(extractId)));
    if (typeof parsed === 'string')
      return JSON.stringify(uniq(parsed.split(',').map((s) => s.trim())));
  } catch {
    return JSON.stringify(uniq(raw.split(',').map((s) => s.trim())));
  }
  return '[]';
}

/** ======================== Component ======================== */
const UnifiedSplitWithContacts: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ------------------ BEGIN: UNCONDITIONAL HOOKS ------------------
  const { data: userDetails } = useUserDetails();
  const currentUserId = userDetails?.data?.user?.id as string | undefined;

  // Query + UI state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<UIContact[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Contacts data (backend)
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useFetchContactsInfinite(ITEMS_PER_LOAD, [], searchTerm);
  // ------------------ END:   UNCONDITIONAL HOOKS ------------------

  /** ---------------- URL params we forward (parity with UnifiedOptionsPage / UnifiedPlansOptions) ---------------- */
  const merchantId       = normalizeParam(searchParams.get('merchantId'), '');
  const amount           = normalizeParam(searchParams.get('amount'), '');            // dollars
  const superchargeDetails = normalizeParam(searchParams.get('superchargeDetails'), '[]');
  const discountListRaw  = normalizeParam(searchParams.get('discountList'), '[]');
  const powerMode        = normalizeParam(searchParams.get('powerMode'), '');
  const otherUsersRaw    = normalizeParam(searchParams.get('otherUsers'), '');       // dollars in JSON
  const recipient        = normalizeParam(searchParams.get('recipient'), '');        // dollars in JSON
  const requestId        = normalizeParam(searchParams.get('requestId'), '');
  const transactionType  = normalizeParam(searchParams.get('transactionType'), '');
  const totalAmount      = normalizeParam(searchParams.get('totalAmount'), '');      // Money JSON (dollars)
  const orderAmount      = normalizeParam(searchParams.get('orderAmount'), '');      // dollars
  const displayLogo      = normalizeParam(searchParams.get('displayLogo'), '');
  const displayName      = normalizeParam(searchParams.get('displayName'), '');
  const split            = normalizeParam(searchParams.get('split'), '');
  const logoUri          = normalizeParam(searchParams.get('logoUri'), '');
  const paymentPlanId    = normalizeParam(searchParams.get('paymentPlanId'), '');
  const paymentSchemeId  = normalizeParam(searchParams.get('paymentSchemeId'), '');
  const splitPaymentId   = normalizeParam(searchParams.get('splitPaymentId'), '');

  // ✅ Canonicalize discounts immediately
  const discountList = useMemo(
    () => canonicalizeDiscountList(discountListRaw),
    [discountListRaw]
  );

  // ✅ Sanitize prefilled otherUsers: remove current user if present
  const sanitizedOtherUsers = useMemo(() => {
    if (!otherUsersRaw) return otherUsersRaw;
    try {
      const parsed = JSON.parse(otherUsersRaw);
      if (!Array.isArray(parsed)) return otherUsersRaw;
      const filtered = parsed.filter((u: any) => u?.userId && u.userId !== currentUserId);
      return JSON.stringify(filtered);
    } catch {
      return otherUsersRaw;
    }
  }, [otherUsersRaw, currentUserId]);

  // Forward bundle for next screen
  const forwardAll = useMemo(
    () => ({
      merchantId,
      amount,                 // dollars
      superchargeDetails,
      discountList,           // canonical JSON array of IDs
      powerMode,
      otherUsers: sanitizedOtherUsers,
      recipient,              // dollars inside JSON
      requestId,
      transactionType,
      totalAmount,            // Money JSON (dollars)
      orderAmount,            // dollars
      displayLogo,
      displayName,
      split,
      logoUri,
      paymentPlanId,
      paymentSchemeId,
      splitPaymentId,
    }),
    [
      merchantId,
      amount,
      superchargeDetails,
      discountList,
      powerMode,
      sanitizedOtherUsers,
      recipient,
      requestId,
      transactionType,
      totalAmount,
      orderAmount,
      displayLogo,
      displayName,
      split,
      logoUri,
      paymentPlanId,
      paymentSchemeId,
      splitPaymentId,
    ]
  );

  /** ---------------- Data shaping & local filtering ---------------- */
  const allContacts: UIContact[] = data
    ? data.pages.flatMap((page) =>
        page.data?.content.map((contact: any) => ({
          id: contact.id,
          username: contact.username,
          phoneNumber: contact.phoneNumber,
          email: contact.email || '',
          avatar: contact.avatar || undefined,
          logo: contact.logo || contact.avatar || undefined,
        })) || []
      )
    : [];

  // Ensure the current user is never selectable (and hidden)
  useEffect(() => {
    if (!currentUserId) return;
    setSelectedContacts((prev) => prev.filter((c) => c.id !== currentUserId));
    setExcludedIds((prev) => {
      if (prev.has(currentUserId)) return prev;
      const next = new Set(prev);
      next.add(currentUserId);
      return next;
    });
  }, [currentUserId]);

  const selectedIdSet = useMemo(
    () => new Set(selectedContacts.map((c) => c.id)),
    [selectedContacts]
  );

  const availableContacts: UIContact[] = useMemo(() => {
    if (allContacts.length === 0) return [];
    return allContacts.filter((c) => {
      if (currentUserId && c.id === currentUserId) return false;
      if (selectedIdSet.has(c.id)) return false;
      if (excludedIds.has(c.id)) return false;
      return true;
    });
  }, [allContacts, selectedIdSet, excludedIds, currentUserId]);

  /** ---------------- Search (debounced) ---------------- */
  const handleSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
      refetch();
    }, 500),
    [refetch]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    handleSearch(term.trim());
  };

  /** ---------------- Selection logic (multi) ---------------- */
  const toggleSelection = useCallback((contact: UIContact) => {
    if (currentUserId && contact.id === currentUserId) {
      toast.info("You can't add yourself.");
      return;
    }

    setSelectedContacts((prev) => {
      const exists = prev.some((c) => c.id === contact.id);
      if (exists) {
        // unselect → allow it back into available list
        setExcludedIds((prevEx) => {
          const next = new Set(prevEx);
          next.delete(contact.id);
          return next;
        });
        return prev.filter((c) => c.id !== contact.id);
      } else {
        // select → keep excluded so backend avoids re-sending in pages
        setExcludedIds((prevEx) => {
          const next = new Set(prevEx);
          next.add(contact.id);
          return next;
        });
        return [...prev, contact];
      }
    });
  }, [currentUserId]);

  /** ---------------- Navigate with context ---------------- */
  const handleSend = () => {
    if (selectedContacts.length === 0) return;

    const userIds = selectedContacts.map((c) => c.id).join(',');
    const params = new URLSearchParams({
      ...Object.entries(forwardAll).reduce<Record<string, string>>(
        (acc, [k, v]) => {
          if (v != null && v !== '') acc[k] = String(v);
          return acc;
        },
        {}
      ),
      userIds,
    });
    navigate(`/UnifiedMultipleUserSplit?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-white p-4 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900"
          aria-label="Go back"
        >
          <IoIosArrowBack className="mr-2" size={24} />
          Back
        </button>
      </header>

      {/* Search Bar + Send button (same height) */}
      <div className="flex items-center mb-4">
        <input
          type="text"
          onChange={handleSearchChange}
          placeholder="Search for users or contacts"
          className="flex-grow h-12 px-4 border border-gray-300 rounded-l-lg focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={selectedContacts.length === 0}
          className={`h-12 px-4 flex items-center justify-center rounded-r-lg text-white border border-l-0 ${
            selectedContacts.length > 0
              ? 'bg-black hover:bg-gray-900 border-gray-300'
              : 'bg-gray-400 cursor-not-allowed border-gray-300'
          }`}
          aria-label="Proceed to split"
          title={selectedContacts.length > 0 ? 'Send' : 'Select at least one contact'}
        >
          <FiSend size={18} />
        </button>
      </div>

      {/* --- ADDED SECTION ON TOP (like mobile) --- */}
      {selectedContacts.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-2">Added</h2>
          <div className="mb-4">
            {selectedContacts.map((contact, idx) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                onToggleSelection={toggleSelection}
                selected={true}            // show as selected
                multiSelect                 // radios/checkbox visible
                showDivider={idx !== selectedContacts.length - 1}
              />
            ))}
          </div>
        </>
      )}

      {/* Error Handling */}
      {isError && (
        <div className="mb-4 text-red-500">
          <p>Error: {error instanceof Error ? error.message : 'Failed to load contacts.'}</p>
          <button onClick={() => refetch()} className="mt-2 text-blue-500 underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center">
          <p>Loading contacts...</p>
        </div>
      )}

      {/* Contacts List with Infinite Scroll */}
      {!isLoading && !isError && (
        <InfiniteScroll
          dataLength={availableContacts.length}
          next={fetchNextPage}
          hasMore={!!hasNextPage}
          loader={
            <h4 className="text-center mt-4 text-gray-500">Loading more contacts...</h4>
          }
          endMessage={
            <p className="text-center mt-4 text-gray-500">
              {availableContacts.length === 0 ? 'No other users.' : 'No more contacts.'}
            </p>
          }
          className="flex-1 overflow-y-auto"
        >
          {availableContacts.map((contact, idx) => (
            <ContactItem
              key={contact.id}
              contact={contact}
              onToggleSelection={toggleSelection}
              selected={selectedIdSet.has(contact.id)}
              multiSelect
              showDivider={idx !== availableContacts.length - 1}
            />
          ))}
        </InfiniteScroll>
      )}

      <Toaster richColors position="top-right" />
    </div>
  );
};

export default UnifiedSplitWithContacts;
