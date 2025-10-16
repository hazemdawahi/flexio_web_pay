// src/hooks/useUserDetails.ts
import { useQuery } from '@tanstack/react-query';

////////////////////////////////////////////////////////////////////////////////
// Public Types — aligned to the provided payload
////////////////////////////////////////////////////////////////////////////////

export interface Address {
  id: string;
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  type: string;         // "billing" | "shipping"
  version?: number;     // present in payload
}

export interface UserDetails {
  // core identity
  version: number;
  id: string;
  phoneNumber: string;
  countryCode: string;
  email: string;
  identityVerified: boolean;

  // profile
  firstName: string;
  lastName: string;
  middleName: string | null | ""; // backend sends "" sometimes
  username: string;
  dateOfBirth: string;

  // power/credit
  yearlyPower: number;
  instantaneousPower: number;
  creditScore: number;

  // product flags
  smartPay: boolean;

  // payment + platform fields
  marqetaCardToken: string | null;
  primaryMethod: string | null;              // string in payload, nullable safe
  primaryPlaidAccountId: string | null;

  // assets
  logo: string | null;

  // messaging / support
  sendbirdAccessToken: string | null;
  sendbirdDeskCustomerId: number | null;
  channelUrl: string | null;

  // timestamps
  createdAt: string;
  updatedAt: string;
  lastCreditUpdate: string;
  lastTwoMonthUpdatedDate: string;
  latestThreeMonthUpdatedDate: string;

  // yearly terms
  yearlyTerms: number;
  lastYearlyTermsUpdatedDate: string;

  // addresses
  billingAddress: Address;
  shippingAddress: Address;

  // preferences
  smartPayPreference: unknown | null; // payload has null for now

  // verifications
  emailVerified: boolean;
  phoneVerified: boolean;
}

/** The complete data envelope your API returns for this route. */
export interface UserDetailsResponseData {
  user: UserDetails;
  totalOwed: number;
  interestFreeCreditAmount: number;
  remainingAvoidedDays: number;
  subscribed: boolean;
}

export interface UserDetailsResponse {
  success: boolean;
  data: UserDetailsResponseData | null;
  error: string | null;
}

////////////////////////////////////////////////////////////////////////////////
// Raw Types (only for mapping; mirror payload exactly)
////////////////////////////////////////////////////////////////////////////////

interface RawAddress {
  version?: number;
  id: string;
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  type: string;
}

interface RawUser {
  version: number;
  id: string;
  phoneNumber: string;
  countryCode: string;
  email: string;
  identityVerified: boolean;
  firstName: string;
  lastName: string;
  middleName: string | null | "";
  username: string;
  yearlyPower: number;
  instantaneousPower: number;
  creditScore: number;
  dateOfBirth: string;
  smartPay: boolean;
  marqetaCardToken: string | null;
  primaryMethod: string | null;
  primaryPlaidAccountId: string | null;
  logo: string | null;
  sendbirdAccessToken: string | null;
  sendbirdDeskCustomerId: number | null;
  channelUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastCreditUpdate: string;
  lastTwoMonthUpdatedDate: string;
  latestThreeMonthUpdatedDate: string;
  yearlyTerms: number;
  lastYearlyTermsUpdatedDate: string;
  billingAddress: RawAddress;
  shippingAddress: RawAddress;
  smartPayPreference: unknown | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

interface RawUserDetailsEnvelope {
  success: boolean;
  data: {
    user: RawUser;
    totalOwed: number;
    interestFreeCreditAmount: number;
    remainingAvoidedDays: number;
    subscribed: boolean;
  } | null;
  error: string | null;
}

////////////////////////////////////////////////////////////////////////////////
// Env helpers — sanitize and require absolute http(s) URLs
////////////////////////////////////////////////////////////////////////////////

const isBrowser = typeof window !== 'undefined';

function pickValidApiHost(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === 'string' ? c : '').trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (['false', '0', 'null', 'undefined'].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ''); // strip trailing slash
  }
  return undefined;
}

// Supports Vite, CRA, Node-style env names
const SERVER_BASE_URL =
  pickValidApiHost(
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined
  ) ?? 'http://192.168.1.121:8080';

////////////////////////////////////////////////////////////////////////////////
// Mapping helpers
////////////////////////////////////////////////////////////////////////////////

const mapAddress = (a: RawAddress): Address => ({
  id: a.id,
  line1: a.line1,
  city: a.city,
  state: a.state,
  zipCode: a.zipCode,
  country: a.country,
  type: a.type,
  version: a.version,
});

const mapUser = (u: RawUser): UserDetails => ({
  version: u.version,
  id: u.id,
  phoneNumber: u.phoneNumber,
  countryCode: u.countryCode,
  email: u.email,
  identityVerified: u.identityVerified,

  firstName: u.firstName,
  lastName: u.lastName,
  middleName: u.middleName ?? "", // normalize null/"" to a single union
  username: u.username,
  dateOfBirth: u.dateOfBirth,

  yearlyPower: Number(u.yearlyPower),
  instantaneousPower: Number(u.instantaneousPower),
  creditScore: Number(u.creditScore),

  smartPay: !!u.smartPay,

  marqetaCardToken: u.marqetaCardToken,
  primaryMethod: u.primaryMethod ?? null,
  primaryPlaidAccountId: u.primaryPlaidAccountId,

  logo: u.logo,

  sendbirdAccessToken: u.sendbirdAccessToken,
  sendbirdDeskCustomerId: u.sendbirdDeskCustomerId,
  channelUrl: u.channelUrl,

  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
  lastCreditUpdate: u.lastCreditUpdate,
  lastTwoMonthUpdatedDate: u.lastTwoMonthUpdatedDate,
  latestThreeMonthUpdatedDate: u.latestThreeMonthUpdatedDate,

  yearlyTerms: u.yearlyTerms,
  lastYearlyTermsUpdatedDate: u.lastYearlyTermsUpdatedDate,

  billingAddress: mapAddress(u.billingAddress),
  shippingAddress: mapAddress(u.shippingAddress),

  smartPayPreference: u.smartPayPreference,

  emailVerified: u.emailVerified,
  phoneVerified: u.phoneVerified,
});

////////////////////////////////////////////////////////////////////////////////
// Fetcher — web (sessionStorage token) with normalization
////////////////////////////////////////////////////////////////////////////////

export async function fetchUserDetails(token: string): Promise<UserDetailsResponse> {
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/user/user-details`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // If you don't use cookies for this route, remove the next line:
      // credentials: 'include',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    }

    const raw = (await res.json()) as RawUserDetailsEnvelope;

    if (!raw.success || !raw.data) {
      return {
        success: false,
        data: null,
        error: raw.error ?? 'Failed to fetch user details',
      };
    }

    const mapped: UserDetailsResponseData = {
      user: mapUser(raw.data.user),
      totalOwed: Number(raw.data.totalOwed ?? 0),
      interestFreeCreditAmount: Number(raw.data.interestFreeCreditAmount ?? 0),
      remainingAvoidedDays: Number(raw.data.remainingAvoidedDays ?? 0),
      subscribed: !!raw.data.subscribed,
    };

    return { success: true, data: mapped, error: null };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Failed to fetch user details',
    };
  }
}

////////////////////////////////////////////////////////////////////////////////
// React Query Hook — web
////////////////////////////////////////////////////////////////////////////////

export function useUserDetails() {
  const token = isBrowser ? window.sessionStorage.getItem('accessToken') : null;

  return useQuery<UserDetailsResponse, Error>({
    queryKey: ['userDetails', token],
    queryFn: () => {
      if (!token) throw new Error('No access token available');
      return fetchUserDetails(token);
    },
    enabled: !!token && isBrowser,  // avoid SSR access to sessionStorage
    staleTime: 1000 * 60 * 5,       // 5 minutes
  });
}
