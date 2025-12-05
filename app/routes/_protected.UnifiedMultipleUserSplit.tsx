import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from '@remix-run/react';
import { Toaster, toast } from 'sonner';
import { IoIosArrowBack } from 'react-icons/io';

import FloatingLabelInput from '~/compoments/Floatinglabelinpunt';
import { useFetchMultipleUserDetails } from '~/hooks/useFetchMultipleUserDetails';
import { useUserDetails } from '~/hooks/useUserDetails';
import { useMerchantDetail } from '~/hooks/useMerchantDetail';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

type Money = {
  amount: string;   // dollars (plain decimal string)
  currency: string; // e.g. "USD"
};

/* ------------------------------------------------------------------ */
/* Constants + Helpers (DOLLARS everywhere — no cents math)           */
/* ------------------------------------------------------------------ */

const isBrowser = typeof window !== 'undefined';

function resolveBaseUrl(): string {
  let fromEnv: string | undefined;

  // 1) Prefer Vite-style env vars if present
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const vEnv = (import.meta as any).env;
      fromEnv =
        (vEnv.VITE_API_HOST as string | undefined) ||
        (vEnv.VITE_BASE_URL as string | undefined);
    }
  } catch {
    // ignore
  }

  // 2) Fall back to Node-style env vars
  if (!fromEnv && typeof process !== 'undefined' && (process as any).env) {
    const env = (process as any).env;
    fromEnv =
      (env.REACT_APP_API_HOST as string | undefined) ||
      (env.API_HOST as string | undefined) ||
      (env.REACT_APP_BASE_URL as string | undefined) ||
      (env.BASE_URL as string | undefined) ||
      (env.CUSTOM_API_BASE_URL as string | undefined);
  }

  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, ''); // strip trailing slashes
  }

  // 3) If in the browser, derive from current hostname + :8080
  if (isBrowser) {
    try {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'https:' : 'http:';
      const host = loc.hostname;
      const port = '8080'; // backend port
      const built = `${protocol}//${host}:${port}`;
      return built;
    } catch {
      // ignore and fall through
    }
  }

  // 4) Final fallback
  return 'http://localhost:8080';
}

const BASE_URL = resolveBaseUrl();
const PLACEHOLDER = 'https://via.placeholder.com/150';

const makeFullUrl = (path?: string | null): string => {
  if (!path) return PLACEHOLDER;
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normalize URL param */
const normalizeParam = (v: string | string[] | null, fallback = ''): string => {
  const raw = Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback);
  const s = (raw ?? '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'null' || low === 'undefined') return '';
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
};

/** Parse Money JSON string (amount is DOLLARS) */
function parseMoneyJson(json?: string | null): number {
  if (!json) return 0;
  try {
    const obj = JSON.parse(json) as Money;
    const n = parseFloat(obj?.amount ?? '0');
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Parse plain amount string "12.34" -> dollars */
function parseAmountStr(a?: string | null): number {
  if (!a) return 0;
  const n = parseFloat(a);
  return Number.isFinite(n) ? n : 0;
}

/** Canonicalize discount list to a JSON array of ID strings */
function canonicalizeDiscountList(raw: string): string {
  if (!raw || !raw.trim()) return '[]';

  const extractId = (x: any): string => {
    if (x == null) return '';
    if (typeof x === 'string' || typeof x === 'number') return String(x).trim();
    if (typeof x === 'object') {
      const v = x.id ?? x.discountId ?? x.code ?? '';
      return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
    }
    return '';
  };

  const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return JSON.stringify(uniq(parsed.map(extractId)));
    if (typeof parsed === 'string') return JSON.stringify(uniq(parsed.split(',').map(s => s.trim())));
  } catch {
    return JSON.stringify(uniq(raw.split(',').map(s => s.trim())));
  }
  return '[]';
}

/** Shallow compare of { [id]: "amountStr" } objects */
const shallowEqualObj = (a: Record<string, string>, b: Record<string, string>) => {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
};

const equalUsers = (a: User[], b: User[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ua = a[i], ub = b[i];
    if (
      ua.id !== ub.id ||
      ua.username !== ub.username ||
      ua.logo !== ub.logo ||
      !!ua.isCurrentUser !== !!ub.isCurrentUser
    ) return false;
  }
  return true;
};

/* ------------------------------------------------------------------ */
/* Row component (memoized)                                           */
/* ------------------------------------------------------------------ */
type RowProps = {
  u: User;
  value?: string;
  editable: boolean;
  onChange: (id: string, text: string) => void;
};

const Row = memo(({ u, value, editable, onChange }: RowProps) => {
  return (
    <div className="flex items-start gap-4 bg-white p-3 rounded-lg border border-gray-200">
      {/* Left: avatar + name */}
      <div className="w-20 flex flex-col items-center">
        <img
          src={u.logo}
          alt={u.username}
          className="w-12 h-12 rounded-full object-cover bg-gray-100"
          loading="lazy"
        />
        <div className="mt-1 text-sm text-gray-800 text-center max-w-[72px] truncate">
          {u.isCurrentUser ? 'You' : u.username}
        </div>
      </div>

      {/* Right: amount field */}
      <div className="flex-1">
        <div className="mt-1">
          <FloatingLabelInput
            label="Amount"
            value={value ?? ''}
            editable={editable}
            onChangeText={(t: string) => {
              // allow digits + single dot, cap 2 decimals
              const v = t.replace(/[^0-9.]/g, '');
              const parts = v.split('.');
              const cleaned = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : v;
              const formatted = cleaned.includes('.')
                ? cleaned.replace(/(\.\d{2}).+$/, (_m, g1) => g1)
                : cleaned;
              onChange(u.id, formatted);
            }}
          />
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.u.id === next.u.id &&
         prev.value === next.value &&
         prev.editable === next.editable;
});
Row.displayName = 'Row';

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const UnifiedMultipleUserSplit: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* -------------------- Params (align with Unified* pages) -------------------- */
  const userIdsStr         = normalizeParam(searchParams.get('userIds'), '');
  const merchantId         = normalizeParam(searchParams.get('merchantId'), '');
  const totalAmountParam   = normalizeParam(searchParams.get('totalAmount'), ''); // Money JSON (dollars)
  const amountParam        = normalizeParam(searchParams.get('amount'), '');      // plain dollars if no Money JSON
  const superchargeDetails = normalizeParam(searchParams.get('superchargeDetails'), '[]');
  const discountListRaw    = normalizeParam(searchParams.get('discountList'), '[]');
  const powerMode          = normalizeParam(searchParams.get('powerMode'), '');
  const otherUsers         = normalizeParam(searchParams.get('otherUsers'), '');
  const recipient          = normalizeParam(searchParams.get('recipient'), '');
  const requestId          = normalizeParam(searchParams.get('requestId'), '');
  const transactionType    = normalizeParam(searchParams.get('transactionType'), '');
  const orderAmount        = normalizeParam(searchParams.get('orderAmount'), '');
  const displayLogoParam   = normalizeParam(searchParams.get('displayLogo'), '');
  const displayNameParam   = normalizeParam(searchParams.get('displayName'), '');
  const split              = normalizeParam(searchParams.get('split'), '');
  const logoUriParam       = normalizeParam(searchParams.get('logoUri'), '');
  const paymentPlanId      = normalizeParam(searchParams.get('paymentPlanId'), '');
  const paymentSchemeId    = normalizeParam(searchParams.get('paymentSchemeId'), '');
  const splitPaymentId     = normalizeParam(searchParams.get('splitPaymentId'), '');

  // Canonicalize discount list once
  const discountList = useMemo(
    () => canonicalizeDiscountList(discountListRaw),
    [discountListRaw]
  );

  // Parse IDs list
  const ids = useMemo(
    () => (userIdsStr ? userIdsStr.split(',').filter(Boolean) : []),
    [userIdsStr]
  );
  const safeIds = useMemo(() => (ids.length ? ids : ['__none__']), [ids]); // sentinel to keep hooks stable
  const safeMerchantId = useMemo(() => (merchantId || '__none__'), [merchantId]);

  /* -------------------- Fetch data -------------------- */
  const { data: multiUsersRes, isLoading: loadingMulti } = useFetchMultipleUserDetails(safeIds);
  const { data: currentUserRes, isLoading: loadingCurrent } = useUserDetails();
  const { data: merchantRes, isLoading: loadingMerchant } = useMerchantDetail(safeMerchantId);

  const haveRealIds = ids.length > 0;
  const haveRealMerchant = merchantId.length > 0;

  /* -------------------- Total to split (dollars) -------------------- */
  const parsedTotalFromMoney = useMemo(() => parseMoneyJson(totalAmountParam), [totalAmountParam]);
  const parsedTotalFromPlain = useMemo(() => parseAmountStr(amountParam), [amountParam]);
  const totalToSplit = parsedTotalFromMoney > 0 ? parsedTotalFromMoney : parsedTotalFromPlain;

  /* -------------------- Local state -------------------- */
  const [users, setUsers] = useState<User[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [tempAmounts, setTempAmounts] = useState<Record<string, string>>({});
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isEvenSplit, setIsEvenSplit] = useState(true);

  /* -------------------- Build users + initial even split -------------------- */
  useEffect(() => {
    if (totalToSplit <= 0 || !currentUserRes?.data?.user) return;

    const incomingList = haveRealIds ? (multiUsersRes?.data as any[] | undefined) : [];

    const currentId = currentUserRes.data.user.id;
    const seen = new Set<string>();
    const nextUsers: User[] = [];

    if (!seen.has(currentId)) {
      seen.add(currentId);
      nextUsers.push({
        id: currentId,
        username: 'You',
        logo: makeFullUrl(currentUserRes.data.user.logo),
        isCurrentUser: true,
      });
    }

    for (const item of incomingList || []) {
      const uid = item.user.id as string;
      if (seen.has(uid)) continue;
      seen.add(uid);
      nextUsers.push({
        id: uid,
        username: item.user.username,
        logo: makeFullUrl(item.user.logo),
      });
    }

    setUsers(prev => (equalUsers(prev, nextUsers) ? prev : nextUsers));

    const n = nextUsers.length;
    if (!n) return;

    const perRaw = totalToSplit / n;
    const per = round2(perRaw);
    const nextAmts: Record<string, string> = {};
    for (let i = 0; i < n - 1; i++) {
      nextAmts[nextUsers[i].id] = per.toFixed(2);
    }
    const sumOthers = per * (n - 1);
    const last = round2(totalToSplit - sumOthers);
    nextAmts[nextUsers[n - 1].id] = last.toFixed(2);

    setAmounts(prev => (shallowEqualObj(prev, nextAmts) ? prev : nextAmts));
    setTempAmounts(prev => (shallowEqualObj(prev, nextAmts) ? prev : nextAmts));
    setIsEvenSplit(true);
  }, [totalToSplit, multiUsersRes, currentUserRes, haveRealIds]);

  /* -------------------- Recalc even split on toggle -------------------- */
  useEffect(() => {
    if (isEvenSplit && totalToSplit > 0 && users.length) {
      const n = users.length;
      const perRaw = totalToSplit / n;
      const per = round2(perRaw);
      const nextAmts: Record<string, string> = {};
      for (let i = 0; i < n - 1; i++) {
        nextAmts[users[i].id] = per.toFixed(2);
      }
      const sumOthers = per * (n - 1);
      const last = round2(totalToSplit - sumOthers);
      nextAmts[users[n - 1].id] = last.toFixed(2);

      setAmounts(prev => (shallowEqualObj(prev, nextAmts) ? prev : nextAmts));
      setTempAmounts(prev => (shallowEqualObj(prev, nextAmts) ? prev : nextAmts));
    }
  }, [isEvenSplit, totalToSplit, users]);

  /* -------------------- Branding (logo + name) -------------------- */
  const merchLogo = useMemo(() => {
    if (logoUriParam) return logoUriParam;
    if (displayLogoParam) return displayLogoParam;
    return makeFullUrl(haveRealMerchant ? merchantRes?.data?.brand?.displayLogo : undefined);
  }, [logoUriParam, displayLogoParam, haveRealMerchant, merchantRes?.data?.brand?.displayLogo]);

  /* -------------------- Forward bundle for next route -------------------- */
  const forwardAll = useMemo(() => ({
    userIds: userIdsStr,
    merchantId,
    totalAmount: totalAmountParam,
    amount: amountParam,
    superchargeDetails,
    discountList,         // canonical JSON array string
    powerMode,
    otherUsers,
    recipient,
    requestId,
    transactionType,
    orderAmount,
    displayLogo: displayLogoParam,
    displayName: displayNameParam,
    split,
    logoUri: logoUriParam,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
  }), [
    userIdsStr, merchantId, totalAmountParam, amountParam, superchargeDetails, discountList,
    powerMode, otherUsers, recipient, requestId, transactionType, orderAmount,
    displayLogoParam, displayNameParam, split, logoUriParam, paymentPlanId, paymentSchemeId, splitPaymentId
  ]);

  /* -------------------- Handlers -------------------- */
  const handleSplitEvenly = useCallback(() => {
    setIsEvenSplit(true);
  }, []);

  const handleAdjustToggle = useCallback(() => {
    if (!isAdjusting) {
      setTempAmounts(prev => (shallowEqualObj(prev, amounts) ? prev : amounts));
      setIsAdjusting(true);
      return;
    }
    setAmounts(prev => (shallowEqualObj(prev, tempAmounts) ? prev : tempAmounts));
    setIsAdjusting(false);
    toast.success('Amounts updated!');
  }, [isAdjusting, amounts, tempAmounts]);

  const handleSplit = useCallback(() => {
    const currentId = currentUserRes?.data?.user?.id as string;
    if (!currentId) {
      toast.error('Missing current user.');
      return;
    }

    const source = isAdjusting ? tempAmounts : amounts;

    // Validate sum equals total
    const sum = users.reduce((acc, u) => acc + (parseFloat(source[u.id] ?? '0') || 0), 0);
    const sumRounded = round2(sum);
    const totalRounded = round2(totalToSplit);
    if (sumRounded !== totalRounded) {
      toast.error('Amounts do not add up to the total.');
      return;
    }

    const otherUsersPayload = users
      .filter(u => u.id !== currentId)
      .map(u => {
        const val = parseFloat(source[u.id] ?? '0');
        return {
          userId: u.id,
          amount: Number.isFinite(val) ? val : 0, // number in dollars
        };
      });

    const yourAmountStr = (source[currentId] ?? '0').toString();

    const params = new URLSearchParams({
      ...Object.entries(forwardAll).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v != null && v !== '') acc[k] = String(v);
        return acc;
      }, {}),
      amount: yourAmountStr,                          // your amount (dollars)
      otherUsers: JSON.stringify(otherUsersPayload),  // others (dollars)
    });

    navigate(`/UnifiedPlansOptions?${params.toString()}`);
  }, [isAdjusting, tempAmounts, amounts, users, totalToSplit, currentUserRes, forwardAll, navigate]);

  /* -------------------- Loading / Error guards -------------------- */
  const isLoadingAll =
    loadingCurrent ||
    (haveRealIds && loadingMulti) ||
    (haveRealMerchant && loadingMerchant) ||
    totalToSplit <= 0;

  if (isLoadingAll) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading…
      </div>
    );
  }
  if ((haveRealIds && !multiUsersRes?.data) || !currentUserRes?.data?.user) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        Failed to load data.
      </div>
    );
  }

  /* -------------------- Render -------------------- */
  return (
    <div className="min-h-screen bg-white p-6">
      {/* Back button — unified style */}
      <header className="w-full mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900"
          aria-label="Go back"
        >
          <IoIosArrowBack className="mr-2" size={24} />
          Back
        </button>
      </header>

      {/* Optional Logo / Header */}
      <div className="flex flex-col items-center mb-4">
        <img
          src={merchLogo}
          alt={displayNameParam || 'brand'}
          className="w-16 h-16 rounded-full border border-gray-300 object-cover"
        />
        {!!displayNameParam && (
          <div className="mt-2 font-semibold">{displayNameParam}</div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold">Split Total: ${totalToSplit.toFixed(2)}</h1>
        <button
          onClick={handleSplitEvenly}
          className={`text-sky-500 font-semibold ${isEvenSplit ? 'underline' : ''}`}
        >
          Split Evenly
        </button>
      </div>

      {/* Users list */}
      <div className="space-y-4">
        {users.map(u => {
          const val = isAdjusting ? tempAmounts[u.id] : amounts[u.id];
          return (
            <Row
              key={u.id}
              u={u}
              value={val}
              editable={isAdjusting}
              onChange={(id, text) =>
                setTempAmounts(prev => ({ ...(isAdjusting ? prev : amounts), [id]: text }))
              }
            />
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={handleAdjustToggle}
          className="flex-1 h-12 rounded-lg border border-gray-300 bg-white font-semibold"
        >
          {isAdjusting ? 'Save' : 'Adjust'}
        </button>
        <button
          onClick={handleSplit}
          className="flex-1 h-12 rounded-lg bg-black text-white font-semibold"
        >
          Split
        </button>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
};

export default UnifiedMultipleUserSplit;
