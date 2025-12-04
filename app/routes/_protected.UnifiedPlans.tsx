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

// Prefer first present raw param key, otherwise second
const getFirstPresent = (p: URLSearchParams, a: string, b: string) => {
  const ra = normalizeParam(p.get(a), '');
  if (ra) return ra;
  return normalizeParam(p.get(b), '');
};

// normalize power mode input variants to 'INSTANT' | 'YEARLY'
const normalizePowerMode = (v: string): PowerMode => {
  const s = (v || '').trim().toUpperCase();
  if (s === 'YEARLY') return 'YEARLY';
  // allow legacy values: 'instantaneous', 'instant'
  return 'INSTANT';
};

// normalize split to the strict union: '' | 'true' | 'false'
const normalizeSplitFlag = (v: string): '' | 'true' | 'false' => {
  const s = (v || '').trim().toLowerCase();
  if (s === 'true') return 'true';
  if (s === 'false') return 'false';
  return '';
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
  const pm = normalizePowerMode(powerModeParam);
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

  // ---------------- Parse params (no hooks yet) ----------------
  const stateFromNav = (location.state ?? {}) as Partial<PlansData>;
  const params = new URLSearchParams(location.search);

  // Core
  const merchantId         = normalizeParam(params.get('merchantId'), '');
  const amountQP           = normalizeParam(params.get('amount'), '');
  const powerModeParam     = normalizeParam(params.get('powerMode'), 'INSTANT'); // can be legacy
  const powerModeFlag: PowerMode = normalizePowerMode(powerModeParam);
  const transactionTypeRaw = (normalizeParam(params.get('transactionType'), '') as AllowedTx) || '';
  const paymentTypeQP      = normalizeParam(params.get('paymentType'), 'instantaneous');

  // Flow context JSON (first-present fixes the [] truthy bug)
  const superchargeDetailsQP = parseJson<SuperchargeDetail[]>(
    normalizeParam(params.get('superchargeDetails'), ''),
    []
  );
  const otherUserAmountsRaw  = getFirstPresent(params, 'otherUserAmounts', 'otherUsers');
  const otherUserAmountsQP   = parseJson<SplitEntry[]>(otherUserAmountsRaw, []);
  const selectedDiscountsRaw = getFirstPresent(params, 'selectedDiscounts', 'discountList');
  const selectedDiscountsQP  = parseJson<string[]>(selectedDiscountsRaw, []);

  // Optional amounts / branding / split flags / ids (parity with mobile)
  const totalAmountQP    = normalizeParam(params.get('totalAmount'), '');
  const orderAmountQP    = normalizeParam(params.get('orderAmount'), '');
  const displayLogoQP    = normalizeParam(params.get('displayLogo'), '');
  const displayNameQP    = normalizeParam(params.get('displayName'), '');
  const splitRaw         = normalizeParam(params.get('split'), '');
  const splitQP          = normalizeSplitFlag(splitRaw);
  const logoUriQP        = normalizeParam(params.get('logoUri'), '');
  const paymentPlanIdQP  = normalizeParam(params.get('paymentPlanId'), '');
  const paymentSchemeIdQP= normalizeParam(params.get('paymentSchemeId'), '');
  const splitPaymentIdQP = normalizeParam(params.get('splitPaymentId'), '');

  // ---------------- Hooks: call ALL hooks before any conditional returns ----------------

  // SmartPay prerequisite hooks — always called
  const { data: creditAccountsResponse, isLoading: creditLoading } = useCreditAccounts() as any;
  const { data: preferences,           isLoading: prefLoading   } = useSmartpayPreferencesMe() as any;
  const { data: incomes,               isLoading: incomesLoading } = useSmartpayIncomes() as any;

  // Tab hooks — always called (even if we later render fallback)
  const [activeTab, setActiveTab] = useState<number>(0); // 0 = Manual/Yearly, 1 = Smart
  const tabRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState<number>(0);

  useEffect(() => {
    try {
      console.groupCollapsed('[UnifiedPlans] Incoming Query Params');
      console.log('[UnifiedPlans] raw search:', location.search);
      console.table([
        { key: 'merchantId', value: merchantId },
        { key: 'powerMode(raw)', value: powerModeParam },
        { key: 'powerMode(flag)', value: powerModeFlag },
        { key: 'transactionType', value: transactionTypeRaw },
        { key: 'amount', value: amountQP },
        { key: 'paymentType (legacy)', value: paymentTypeQP },
        { key: 'has otherUserAmounts', value: params.has('otherUserAmounts') },
        { key: 'has otherUsers', value: params.has('otherUsers') },
        { key: 'has selectedDiscounts', value: params.has('selectedDiscounts') },
        { key: 'has discountList', value: params.has('discountList') },
        { key: 'superchargeDetails(len)', value: Array.isArray(superchargeDetailsQP) ? superchargeDetailsQP.length : 0 },
        { key: 'otherUserAmounts(len)', value: Array.isArray(otherUserAmountsQP) ? otherUserAmountsQP.length : 0 },
        { key: 'selectedDiscounts(len)', value: Array.isArray(selectedDiscountsQP) ? selectedDiscountsQP.length : 0 },
        { key: 'totalAmount(len)', value: totalAmountQP.length },
        { key: 'orderAmount(len)', value: orderAmountQP.length },
        { key: 'displayLogo(len)', value: displayLogoQP.length },
        { key: 'displayName(len)', value: displayNameQP.length },
        { key: 'split(flag)', value: splitQP },
        { key: 'logoUri(len)', value: logoUriQP.length },
        { key: 'paymentPlanId(len)', value: paymentPlanIdQP.length },
        { key: 'paymentSchemeId(len)', value: paymentSchemeIdQP.length },
        { key: 'splitPaymentId(len)', value: splitPaymentIdQP.length },
      ]);
      console.groupEnd();
    } catch {}
  }, [
    merchantId,
    powerModeParam,
    powerModeFlag,
    transactionTypeRaw,
    amountQP,
    paymentTypeQP,
    superchargeDetailsQP,
    otherUserAmountsQP,
    selectedDiscountsQP,
    totalAmountQP,
    orderAmountQP,
    displayLogoQP,
    displayNameQP,
    splitQP,
    logoUriQP,
    paymentPlanIdQP,
    paymentSchemeIdQP,
    splitPaymentIdQP,
    location.search,
    params,
  ]);

  // Build unified data (memoized) — no hooks inside
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

  // Logs for resolved data (still before any conditional returns)
  useEffect(() => {
    try {
      console.groupCollapsed('[UnifiedPlans] Resolved Data');
      console.log('paymentType:', data.paymentType);
      console.log('amount:', data.amount);
      console.log('superchargeDetails:', data.superchargeDetails);
      console.log('otherUserAmounts:', data.otherUserAmounts);
      console.log('selectedDiscounts:', data.selectedDiscounts);
      console.groupEnd();
    } catch {}
  }, [data]);

  // Compute flags (no hooks)
  const { paymentType, amount, superchargeDetails, otherUserAmounts, selectedDiscounts } = data;
  const powerMode: PowerMode = powerModeFlag; // normalized (accepts legacy)
  const isYearly   = paymentType === 'yearly' || powerMode === 'YEARLY';
  const isSelfPay  = paymentType === 'selfpay';
  const restricted = txIsRestricted((transactionTypeRaw || '').toUpperCase() as AllowedTx);

  // Smart prerequisites derived values
  const creditTokens   = creditAccountsResponse?.data?.tokens ?? [];
  const hasCredit      = Array.isArray(creditTokens) && creditTokens.length > 0;
  const hasPreferences = !!preferences;
  const hasIncomes     = Array.isArray(incomes) && incomes.length > 0;
  const smartEnabled   = hasCredit && hasPreferences && hasIncomes;

  const loadingSmart = creditLoading || prefLoading || incomesLoading;

  // Effects (logging) — still top-level and unconditional
  useEffect(() => {
    try {
      console.groupCollapsed('[UnifiedPlans] Mode/Flags');
      console.table([
        { key: 'transactionType', value: transactionTypeRaw || '' },
        { key: 'powerMode (param->flag)', value: powerMode },
        { key: 'paymentType (resolved)', value: paymentType },
        { key: 'isYearly', value: isYearly },
        { key: 'isSelfPay', value: isSelfPay },
        { key: 'restricted', value: restricted },
      ]);
      console.groupEnd();

      console.groupCollapsed('[UnifiedPlans] SmartPay Prereqs');
      console.table([
        { key: 'creditLoading', value: creditLoading },
        { key: 'prefLoading', value: prefLoading },
        { key: 'incomesLoading', value: incomesLoading },
        { key: 'creditTokensCount', value: Array.isArray(creditTokens) ? creditTokens.length : 0 },
        { key: 'hasPreferences', value: hasPreferences },
        { key: 'hasIncomes', value: hasIncomes },
        { key: 'smartEnabled', value: smartEnabled },
      ]);
      console.groupEnd();
    } catch {}
  }, [
    transactionTypeRaw,
    powerMode,
    paymentType,
    isYearly,
    isSelfPay,
    restricted,
    creditLoading,
    prefLoading,
    incomesLoading,
    creditTokens,
    hasPreferences,
    hasIncomes,
    smartEnabled,
  ]);

  // Tab measurement effect — unconditional
  useEffect(() => {
    if (!tabRef.current) return;
    const measure = () => setTabWidth(tabRef.current!.getBoundingClientRect().width);
    const obs = new ResizeObserver(() => measure());
    obs.observe(tabRef.current);
    measure(); // initial
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Log active tab — unconditional
  useEffect(() => {
    try {
      console.log('[UnifiedPlans] Active Tab:', activeTab === 0 ? (isYearly ? 'Yearly/Manual' : 'Manual') : 'Smart');
    } catch {}
  }, [activeTab, isYearly]);

  // ---------------- NOW it's safe to do conditional returns ----------------

  // Loading state for Smart checks
  if (loadingSmart) {
    return (
      <ProtectedRoute>
        <CenterSpinner />
      </ProtectedRoute>
    );
  }

  // Fallback: selfpay OR restricted flows OR SmartPay prerequisites not met → single page, no tabs
  const renderingFallback = isSelfPay || restricted || !smartEnabled;

  // (Optional) layout log (no hooks here)
  try {
    console.log(
      '[UnifiedPlans] Layout:',
      renderingFallback ? 'Single page (SelfPay or Restricted or No Smart)' : 'Tabbed (Manual/Yearly | Smart)'
    );
  } catch {}

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

  // ✅ Pass enriched props to Smart (aligned with app/routes/UnifiedSmartPaymentPlans.tsx)
  const renderSmart = () => (
    <SmartPaymentPlans
      // core
      merchantId={merchantId}
      amount={amount}
      powerMode={isYearly ? 'YEARLY' : 'INSTANT'}

      // flow context
      superchargeDetails={superchargeDetails}
      otherUserAmounts={otherUserAmounts}
      selectedDiscounts={selectedDiscounts}
      requestId={normalizeParam(params.get('requestId'), '')}
      transactionType={transactionTypeRaw}

      // split flag
      split={splitQP}

      // identifiers (Soteria + split)
      paymentPlanId={paymentPlanIdQP}
      paymentSchemeId={paymentSchemeIdQP}
      splitPaymentId={splitPaymentIdQP}
    />
  );

  if (renderingFallback) {
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
  const ACCENT = '#00BFFF';   // blue underline
  const BASELINE = '#E5E5E5'; // gray baseline

  // Preferred: pixel width via observer; Fallback: 50% (no measurement yet)
  const indicatorWidthPx = tabWidth ? tabWidth / 2 : 0;
  const indicatorWidthStyle: React.CSSProperties['width'] =
    indicatorWidthPx > 0 ? indicatorWidthPx : '50%';

  // Animate x in px when measured; otherwise in % (0% → 100%)
  const xWhenMeasured = indicatorWidthPx * (activeTab || 0);
  const xFallback = `${(activeTab || 0) * 100}%`;
  const animateX = indicatorWidthPx > 0 ? xWhenMeasured : xFallback;

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

          {/* full-width thin gray baseline at the very bottom */}
          <div className="absolute left-0 right-0 bottom-0 h-px" style={{ backgroundColor: BASELINE }} />

          {/* 2px blue moving underline segment (overlaying the baseline) */}
          <motion.div
            className="absolute bottom-0 left-0 h-[2px]"
            style={{ width: indicatorWidthStyle, backgroundColor: ACCENT, zIndex: 1 }}
            animate={{ x: animateX }}
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
