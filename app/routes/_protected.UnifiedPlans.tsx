// File: src/routes/UnifiedPlans.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from '@remix-run/react';
import { IoIosArrowBack } from 'react-icons/io';
import { motion } from 'framer-motion';

import PaymentPlan from '~/routes/_protected.UnifiedPaymentPlan';
import SmartPaymentPlans from '~/routes/_protected.UnifiedSmartPaymentPlans';


// 🔁 SmartPay prerequisite hooks (web)
import { useCreditAccounts } from '~/hooks/useCreditAccounts';
import { useSmartpayPreferencesMe } from '~/hooks/useSmartpayPreferencesMe';
import { useSmartpayIncomes } from '~/hooks/useSmartpayIncomes';
import ProtectedRoute from '~/compoments/ProtectedRoute';
import SelfPayPaymentPlan from './_protected.UnifiedSelfPayPaymentPlan';
import YearlyPaymentPlan from './_protected.UnifiedYearlyPaymentPlan';

/** ---------------- Types (RN parity) ---------------- */
type PowerMode = 'INSTANT' | 'YEARLY';
type AllowedTx =
  | 'CHECKOUT'
  | 'PAYMENT'
  | 'SEND'
  | 'ACCEPT_REQUEST'
  | 'ACCEPT_SPLIT_REQUEST'
  | 'VIRTUAL_CARD'
  | 'SOTERIA_PAYMENT'
  | '';

export interface SplitEntry {
  userId: string;
  amount: string; // dollars, e.g. "25.50"
}

export interface SuperchargeDetail {
  amount: string;        // dollars, e.g. "10.00"
  paymentMethodId: string;
}

export interface PlansData {
  paymentType: 'instantaneous' | 'yearly' | 'selfpay';
  amount: string;               // dollars, e.g. "100.00"
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts: SplitEntry[];
  selectedDiscounts: string[];  // discount IDs
}

/** ---------------- Helpers ---------------- */
const normalizeParam = (v?: string | null, fallback = ''): string => {
  const s = (v ?? fallback).trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'null' || low === 'undefined') return '';
  // strip stray wrapping quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
};

// Accepts undefined/null directly and returns default on parse failure
const parseJson = <T,>(raw: string | null | undefined, def: T): T => {
  const s = normalizeParam(raw, '');
  if (!s) return def;
  try {
    const v = JSON.parse(s);
    return v as T;
  } catch {
    return def;
  }
};

// Allow both legacy "paymentType" and newer "powerMode"
const resolvePaymentType = (
  legacyPaymentType: string,
  powerModeParam: string
): 'instantaneous' | 'yearly' | 'selfpay' => {
  const legacy = (legacyPaymentType || '').toLowerCase();
  if (legacy === 'instantaneous' || legacy === 'yearly' || legacy === 'selfpay') {
    return legacy as any;
  }
  const pm = (powerModeParam || '').toUpperCase();
  if (pm === 'YEARLY') return 'yearly';
  return 'instantaneous';
};

// Restrict Smart tab for SEND / ACCEPT / SOTERIA flows (RN parity)
const txIsRestricted = (tx: AllowedTx) =>
  tx === 'SEND' || tx === 'ACCEPT_REQUEST' || tx === 'ACCEPT_SPLIT_REQUEST' || tx === 'SOTERIA_PAYMENT';

/** ---------------- UI bits ---------------- */
const CenterSpinner: React.FC = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <motion.div
      role="status"
      aria-label="Loading"
      className="w-10 h-10 rounded-full border-4 border-gray-300"
      style={{ borderTopColor: '#000' }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: 'linear', duration: 0.9 }}
    />
  </div>
);

/** ======================== Component ======================== */
const UnifiedPlans: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ---------------- Load state either from location.state or query params ----------------
  const stateFromNav = (location.state ?? {}) as Partial<PlansData>;
  const params = new URLSearchParams(location.search);

  // Newer-style params (RN parity) — optional
  const powerModeParam     = normalizeParam(params.get('powerMode'), 'INSTANT'); // 'INSTANT' | 'YEARLY'
  const transactionTypeRaw = (normalizeParam(params.get('transactionType'), '') as AllowedTx) || '';

  // Legacy inputs you already use:
  const amountQP       = normalizeParam(params.get('amount'), '');
  const paymentTypeQP  = normalizeParam(params.get('paymentType'), 'instantaneous');

  // Supercharge & splits (accept both names for compatibility)
  const superchargeDetailsQP = parseJson<SuperchargeDetail[]>(params.get('superchargeDetails'), []);
  const otherUserAmountsQP =
    parseJson<SplitEntry[]>(params.get('otherUserAmounts'), []) ||
    parseJson<SplitEntry[]>(params.get('otherUsers'), []); // tolerate "otherUsers" array of { userId, amount }

  // Discounts: accept selectedDiscounts[] OR discountList[] ids
  const selectedDiscountsQP =
    parseJson<string[]>(params.get('selectedDiscounts'), []) ||
    parseJson<string[]>(params.get('discountList'), []);

  // Build a unified data object (state takes precedence if present)
  const data: PlansData = useMemo(() => {
    if (stateFromNav && Object.keys(stateFromNav).length > 0) {
      return {
        paymentType: stateFromNav.paymentType ?? 'instantaneous',
        amount: stateFromNav.amount ?? '',
        superchargeDetails: stateFromNav.superchargeDetails ?? [],
        otherUserAmounts: stateFromNav.otherUserAmounts ?? [],
        selectedDiscounts: stateFromNav.selectedDiscounts ?? [],
      };
    }

    const paymentType = resolvePaymentType(paymentTypeQP, powerModeParam);
    return {
      paymentType,
      amount: amountQP,
      superchargeDetails: superchargeDetailsQP,
      otherUserAmounts: otherUserAmountsQP,
      selectedDiscounts: selectedDiscountsQP,
    };
  }, [
    stateFromNav,
    paymentTypeQP,
    powerModeParam,
    amountQP,
    superchargeDetailsQP,
    otherUserAmountsQP,
    selectedDiscountsQP,
  ]);

  // ---------------- Early loading guard ----------------
  if (!data) {
    return (
      <ProtectedRoute>
        <CenterSpinner />
      </ProtectedRoute>
    );
  }

  const { paymentType, amount, superchargeDetails, otherUserAmounts, selectedDiscounts } = data;

  // Compute mode flags and restrictions (RN parity)
  const powerMode: PowerMode = (powerModeParam || '').toUpperCase() === 'YEARLY' ? 'YEARLY' : 'INSTANT';
  const isYearly = paymentType === 'yearly' || powerMode === 'YEARLY';
  const isSelfPay = paymentType === 'selfpay';
  const restricted = txIsRestricted((transactionTypeRaw || '').toUpperCase() as AllowedTx);

  // ---------------- SmartPay availability (web hooks) ----------------
  const { data: creditAccountsResponse, isLoading: creditLoading } = useCreditAccounts() as any;
  const { data: preferences,           isLoading: prefLoading   } = useSmartpayPreferencesMe() as any;
  const { data: incomes,               isLoading: incomesLoading } = useSmartpayIncomes() as any;

  const creditTokens   = creditAccountsResponse?.data?.tokens ?? [];
  const hasCredit      = Array.isArray(creditTokens) && creditTokens.length > 0;
  const hasPreferences = !!preferences;
  const hasIncomes     = Array.isArray(incomes) && incomes.length > 0;
  const smartEnabled   = hasCredit && hasPreferences && hasIncomes;

  const loadingSmart = creditLoading || prefLoading || incomesLoading;

  // ---------------- Tab UI (two tabs) ----------------
  const [activeTab, setActiveTab] = useState<number>(0); // 0 = Manual/Yearly, 1 = Smart
  const tabRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState<number>(0);

  useEffect(() => {
    if (!tabRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setTabWidth(w);
    });
    obs.observe(tabRef.current);
    return () => obs.disconnect();
  }, []);

  // ---------------- Renderers ----------------
  const renderManualOrYearly = () => {
    if (isYearly) {
      // YearlyPaymentPlan expects string-typed props (JSON for arrays)
      return (
        <YearlyPaymentPlan
          amount={amount}
          superchargeDetails={JSON.stringify(superchargeDetails ?? [])}
          otherUsers={JSON.stringify(otherUserAmounts ?? [])}
          discountList={JSON.stringify(selectedDiscounts ?? [])}
        />
      );
    }
    // UnifiedPaymentPlan accepts arrays directly
    return (
      <PaymentPlan
        instantPowerAmount={amount}
        superchargeDetails={superchargeDetails}
        otherUserAmounts={otherUserAmounts}
        selectedDiscounts={selectedDiscounts}
      />
    );
  };

  const renderSmart = () => (
    <SmartPaymentPlans
      instantPowerAmount={!isYearly ? amount : undefined}
      yearlyPowerAmount={isYearly ? amount : undefined}
      superchargeDetails={superchargeDetails}
      otherUserAmounts={otherUserAmounts}
      selectedDiscounts={selectedDiscounts}
    />
  );

  // ---------------- Loading state for Smart checks ----------------
  if (loadingSmart) {
    return (
      <ProtectedRoute>
        <CenterSpinner />
      </ProtectedRoute>
    );
  }

  // ---------------- Fallback: selfpay OR restricted flows OR SmartPay prerequisites not met → single page, no tabs ----------------
  if (isSelfPay || restricted || !smartEnabled) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-white">
          <header className="flex items-center p-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-700 hover:text-gray-900"
            >
              <IoIosArrowBack className="mr-2" size={24} />
              Back
            </button>
          </header>

          <div className="px-4 mt-2">
            {isSelfPay ? (
              // SelfPayPaymentPlan reads everything from URL/queries; it has no props
              <SelfPayPaymentPlan />
            ) : (
              renderManualOrYearly()
            )}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // ---------------- Tabbed layout (Manual/Yearly | Smart) ----------------
  const ACCENT = '#00BFFF';
  const BASELINE = '#E5E5E5';
  const indicatorWidth = tabWidth ? tabWidth / 2 : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        <header className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>

        {/* Custom tab bar (shown only when Smart is enabled and flow isn't restricted) */}
        <nav ref={tabRef} className="relative border-t border-gray-300">
          <div className="flex items-center h-[60px]">
            <button
              onClick={() => setActiveTab(0)}
              className="flex-1 h-full flex items-center justify-center font-bold text-black"
            >
              {isYearly ? 'Yearly Plan' : 'Manual Plan'}
            </button>

            {/* vertical divider */}
            <div className="w-px h-[60%] bg-gray-300" />

            <button
              onClick={() => setActiveTab(1)}
              className="flex-1 h-full flex items-center justify-center font-bold text-black"
            >
              Smart Plan
            </button>
          </div>

          {/* gray baseline */}
          <div
            className="absolute left-0 right-0 bottom-0 h-px"
            style={{ backgroundColor: BASELINE }}
          />

          {/* blue moving underline */}
          <motion.div
            className="absolute bottom-0 left-0 h-[3px] rounded"
            style={{ width: indicatorWidth, backgroundColor: ACCENT }}
            animate={{ x: activeTab * indicatorWidth }}
            transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.7 }}
          />
        </nav>

        {/* Pages (non-swipe; switch by state) */}
        <div className="px-4 py-4">
          {activeTab === 0 ? renderManualOrYearly() : renderSmart()}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default UnifiedPlans;
