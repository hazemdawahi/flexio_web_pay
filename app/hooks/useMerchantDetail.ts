// src/hooks/useMerchantDetail.ts (web)
import { useQuery } from '@tanstack/react-query';

////////////////////////////////////////////////////////////////////////////////
// Public Types & Interfaces
////////////////////////////////////////////////////////////////////////////////

export type MerchantType = 'MERCHANT' | 'SERVICE';

export interface MerchantAddress {
  id: string;
  zipCode: string;
  streetAddress: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  createdAt?: string;
  updatedAt?: string;
  storeName?: string;
}

export interface MerchantDiscount {
  discountId: string;
  discountName: string;
  type: string;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  minimumPurchaseAmount?: number | null;
  singleUse?: boolean;
  expiresAt?: string | null;
  discountState?: string;
}

export interface MerchantOffer {
  offerId: string;
  campaignName: string;
  offerType: string;
  status: string;
  offerAvailability: 'ONLINE' | 'IN_STORE' | 'ONLINE_AND_IN_STORE';
  offerStart?: string;
  offerEnd?: string;
  preferredUrl?: string;
  addresses: MerchantAddress[];
}

export type TermType = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | string;

export interface SelfPayTier {
  termType: TermType;
  minAmount: string; // strings preserve precision from backend
  maxAmount: string;
  minTerm: number;
  maxTerm: number;
}

export interface MerchantConfiguration {
  minAmount: { id: string; amount: string; currency: string };
  maxAmount: { id: string; amount: string; currency: string };
  checkout?: string;
  checkoutUrl?: string;
  enableSplitPay?: boolean;
  splitPay?: string;
  splitPayUrl?: string;
  authorizationWebhookUrl?: string;
  enableSelfPay?: boolean;
  selfPayTiers?: SelfPayTier[];
}

export interface MerchantBrand {
  id: string;
  displayName: string | null;
  customerEmail: string | null;
  customerSupportPhone: string | null;
  displayLogo: string | null;
  coverPhoto: string | null;
  category: string | null;
  // optional to match payload
  returnPolicyUrl?: string | null;
  refundPolicyUrl?: string | null;
  shortDescription?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantDetail {
  merchantId: string;
  merchantType: MerchantType;
  merchantName: string | null;

  // top-level metadata
  accountId?: string | null;
  mid?: string | null;
  mcc?: string | null;
  stripeRequirements?: boolean;
  verified?: boolean;
  createdAt?: string;
  updatedAt?: string;

  brand: MerchantBrand;
  locations?: MerchantAddress[];
  addresses?: MerchantAddress[];
  offers?: MerchantOffer[];
  discounts?: MerchantDiscount[];
  url?: string | null;
  configuration?: MerchantConfiguration;
}

export interface MerchantDetailResponse {
  success: boolean;
  data: MerchantDetail;
  error: string | null;
}

////////////////////////////////////////////////////////////////////////////////
// Raw Payload Types (mapping only)
////////////////////////////////////////////////////////////////////////////////

interface RawMerchantAddress {
  addressId: string;
  zipCode: string;
  streetAddress: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  storeName?: string;
}

interface RawMerchantLocation {
  id: string;
  zipCode: string;
  streetAddress: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

interface RawMerchantDiscount {
  discountId: string;
  discountName: string;
  type: string;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  minimumPurchaseAmount?: number | null;
  singleUse?: boolean;
  expiresAt?: string | null;
  discountState?: string;
}

interface RawMerchantOffer {
  offerId: string;
  campaignName: string;
  offerType: string;
  status: string;
  offerAvailability: 'ONLINE' | 'IN_STORE' | 'ONLINE_AND_IN_STORE';
  offerStart?: string;
  offerEnd?: string;
  preferredUrl?: string;
  addresses: RawMerchantAddress[];
}

interface MerchantDetailResponseRaw {
  success: boolean;
  data: {
    merchantId: string;
    merchantType: MerchantType;
    merchantName: string | null;

    // top-level merchant metadata
    accountId?: string | null;
    mid?: string | null;
    mcc?: string | null;
    stripeRequirements?: boolean;
    verified?: boolean;
    createdAt?: string;
    updatedAt?: string;

    brand: MerchantBrand;
    addresses?: RawMerchantAddress[];
    locations?: RawMerchantLocation[];
    offers?: RawMerchantOffer[];
    discounts?: RawMerchantDiscount[];
    url?: string | null;
    configuration?: MerchantConfiguration;
  };
  error: string | null;
}

////////////////////////////////////////////////////////////////////////////////
// Env resolution (sanitize "false"/"0"/"off"/"null"/"undefined")
////////////////////////////////////////////////////////////////////////////////

const isBrowser = typeof window !== 'undefined';

const pickEnv = () => {
  const viaVite =
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_HOST) as
      | string
      | undefined;
  const viaCRA =
    (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_HOST) as
      | string
      | undefined;
  const viaNode =
    (typeof process !== 'undefined' && (process as any)?.env?.API_HOST) as
      | string
      | undefined;
  return viaVite ?? viaCRA ?? viaNode;
};

const sanitizeEnv = (v?: string) => {
  if (!v) return undefined;
  const trimmed = v.trim().replace(/^['"]|['"]$/g, ''); // strip surrounding quotes
  if (!trimmed) return undefined;
  if (/^(false|0|off|null|undefined)$/i.test(trimmed)) return undefined;
  return trimmed;
};

const ensureAbsoluteUrl = (base?: string) => {
  if (!base) return undefined;
  // protocol-relative //host -> default to http:
  if (/^\/\//.test(base)) return `http:${base}`.replace(/\/+$/g, '');
  // already absolute
  if (/^https?:\/\//i.test(base)) return base.replace(/\/+$/g, '');
  // relative — if in browser, resolve against origin; else assume http://
  if (isBrowser) {
    const origin = window.location.origin.replace(/\/+$/g, '');
    const path = base.replace(/^\/+/g, '');
    return `${origin}/${path}`;
  }
  return `http://${base.replace(/^\/+/g, '')}`;
};

const DEFAULT_BASE = 'http://192.168.1.121:8080';

const RAW_API_HOST = pickEnv();
const CLEAN_API_HOST = sanitizeEnv(RAW_API_HOST);
export const SERVER_BASE_URL = ensureAbsoluteUrl(CLEAN_API_HOST) ?? DEFAULT_BASE;

////////////////////////////////////////////////////////////////////////////////
// Fetcher with normalization (web)
////////////////////////////////////////////////////////////////////////////////

async function fetchMerchantDetail(merchantId: string): Promise<MerchantDetailResponse> {
  try {
    if (!isBrowser) throw new Error('Token storage unavailable during SSR');
    const token = window.sessionStorage.getItem('accessToken');
    if (!token) throw new Error('No access token found');

    const url = `${SERVER_BASE_URL}/api/merchant/${merchantId}/details`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include', // keep/remove based on your CORS/session setup
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    }

    const raw = (await res.json()) as MerchantDetailResponseRaw;
    if (!raw.success) throw new Error(raw.error ?? 'Unknown error fetching merchant');

    // addresses → MerchantAddress[]
    const normalizedAddresses: MerchantAddress[] =
      raw.data.addresses?.map((a) => ({
        id: a.addressId,
        zipCode: a.zipCode,
        streetAddress: a.streetAddress,
        city: a.city,
        state: a.state,
        latitude: a.latitude,
        longitude: a.longitude,
        storeName: a.storeName,
      })) ?? [];

    // locations → MerchantAddress[] (with created/updated)
    const normalizedLocations: MerchantAddress[] =
      raw.data.locations?.map((l) => ({
        id: l.id,
        zipCode: l.zipCode,
        streetAddress: l.streetAddress,
        city: l.city,
        state: l.state,
        latitude: l.latitude,
        longitude: l.longitude,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })) ?? [];

    // discounts
    const normalizedDiscounts: MerchantDiscount[] =
      raw.data.discounts?.map((d) => ({
        discountId: d.discountId,
        discountName: d.discountName,
        type: d.type,
        discountPercentage: d.discountPercentage ?? null,
        discountAmount: d.discountAmount ?? null,
        minimumPurchaseAmount: d.minimumPurchaseAmount ?? null,
        singleUse: d.singleUse,
        expiresAt: d.expiresAt ?? null,
        discountState: d.discountState,
      })) ?? [];

    // offers (and nested addresses)
    const normalizedOffers: MerchantOffer[] =
      raw.data.offers?.map((o) => ({
        offerId: o.offerId,
        campaignName: o.campaignName,
        offerType: o.offerType,
        status: o.status,
        offerAvailability: o.offerAvailability,
        offerStart: o.offerStart,
        offerEnd: o.offerEnd,
        preferredUrl: o.preferredUrl,
        addresses: o.addresses.map((a) => ({
          id: a.addressId,
          zipCode: a.zipCode,
          streetAddress: a.streetAddress,
          city: a.city,
          state: a.state,
          latitude: a.latitude,
          longitude: a.longitude,
          storeName: a.storeName,
        })),
      })) ?? [];

    const brand = { ...raw.data.brand };

    const normalized: MerchantDetail = {
      merchantId: raw.data.merchantId,
      merchantType: raw.data.merchantType,
      merchantName: raw.data.merchantName,

      // top-level metadata
      accountId: raw.data.accountId ?? null,
      mid: raw.data.mid ?? null,
      mcc: raw.data.mcc ?? null,
      stripeRequirements: raw.data.stripeRequirements ?? undefined,
      verified: raw.data.verified ?? undefined,
      createdAt: raw.data.createdAt,
      updatedAt: raw.data.updatedAt,

      brand,
      addresses: normalizedAddresses.length ? normalizedAddresses : undefined,
      locations: normalizedLocations.length ? normalizedLocations : undefined,
      offers: normalizedOffers.length ? normalizedOffers : undefined,
      discounts: normalizedDiscounts.length ? normalizedDiscounts : undefined,
      url: raw.data.url ?? null,
      configuration: raw.data.configuration ?? undefined,
    };

    return { success: true, data: normalized, error: null };
  } catch (err: any) {
    return {
      success: false,
      data: {} as MerchantDetail,
      error: err?.message || 'Failed to fetch merchant details',
    };
  }
}

////////////////////////////////////////////////////////////////////////////////
// React Query Hook (web)
////////////////////////////////////////////////////////////////////////////////

export function useMerchantDetail(merchantId: string) {
  return useQuery<MerchantDetailResponse, Error>({
    queryKey: ['merchantDetail', merchantId],
    queryFn: () => fetchMerchantDetail(merchantId),
    enabled: !!merchantId && isBrowser, // avoid SSR token read
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}
