// File: app/routes/MultipleUsersSendWeb.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
import { Toaster, toast } from 'sonner';
import { IoIosArrowBack } from 'react-icons/io';

import { useFetchMultipleUserDetails } from '~/hooks/useFetchMultipleUserDetails';
import { useUserDetails } from '~/hooks/useUserDetails';
import { useCheckoutDetail } from '~/hooks/useCheckoutDetail';
import FloatingLabelInput from '~/compoments/Floatinglabelinpunt';

import { useAvailableDiscounts } from '~/hooks/useAvailableDiscounts';
import { useMerchantDetail } from '~/hooks/useMerchantDetail';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface LocationState {
  userIds: string[];
  type?: 'instantaneous' | 'yearly' | 'split';
}

export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

export interface SplitEntry {
  userId: string;
  amount: string;
}

export interface SplitData {
  type: 'split';
  userAmounts: SplitEntry[];
}

/* ------------------------------------------------------------------ */
/* Helpers – always work in CENTS to avoid floating-point drift        */
/* ------------------------------------------------------------------ */

const toCents = (amount: number) => Math.round(amount * 100);
const centsToStr = (cents: number) => (cents / 100).toFixed(2);

/* ------------------------------------------------------------------ */

const MultipleUsersSendWeb: React.FC = () => {
  const navigate = useNavigate();
  const { state: locState } = useLocation();
  const { userIds = [], type } = (locState as LocationState) || {};
  const isYearly = type === 'yearly';

  /* -------------------------------------------------------------- */
  /* Fetch data                                                     */
  /* -------------------------------------------------------------- */

  const {
    data: multipleUsersData,
    isLoading: isMultipleUsersLoading,
    error: multipleUsersError,
  } = useFetchMultipleUserDetails(userIds);

  const {
    data: currentUserData,
    isLoading: isCurrentUserLoading,
    error: currentUserError,
  } = useUserDetails();

  const checkoutToken =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('checkoutToken') || ''
      : '';

  const {
    data: checkoutData,
    isLoading: isCheckoutLoading,
    error: checkoutError,
  } = useCheckoutDetail(checkoutToken);

  const checkoutTotalAmount = checkoutData
    ? parseFloat(checkoutData.checkout.totalAmount.amount)
    : 0;

  const merchantId = checkoutData?.checkout.merchant.id || '';

  const {
    data: discounts,
    isLoading: discountsLoading,
    error: discountsError,
  } = useAvailableDiscounts(merchantId, checkoutTotalAmount);

  const availableDiscounts = discounts ?? [];

  const { data: merchantDetailData } = useMerchantDetail(merchantId);

  /* -------------------------------------------------------------- */
  /* Local state                                                    */
  /* -------------------------------------------------------------- */

  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [tempAmounts, setTempAmounts] = useState<Record<string, string>>({});
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isEvenSplit, setIsEvenSplit] = useState(true);

  /* -------------------------------------------------------------- */
  /* Discount helpers                                               */
  /* -------------------------------------------------------------- */

  const getDiscountValue = (d: any): number => {
    if (d.type === 'PERCENTAGE_OFF' && d.discountPercentage != null) {
      return checkoutTotalAmount * (d.discountPercentage / 100);
    }
    if (d.discountAmount != null) return d.discountAmount;
    return 0;
  };

  /* Auto-pick the single best discount only once ----------------- */
  const didAutoPick = useRef(false);
  useEffect(() => {
    if (!didAutoPick.current && availableDiscounts.length > 0) {
      const valid = availableDiscounts.filter(
        (d) => checkoutTotalAmount - getDiscountValue(d) >= 0,
      );
      if (valid.length) {
        const best = valid.reduce((a, b) =>
          getDiscountValue(b) > getDiscountValue(a) ? b : a,
        );
        setSelectedDiscounts([String(best.id)]);
      }
      didAutoPick.current = true;
    }
  }, [availableDiscounts, checkoutTotalAmount]);

  const handleDiscountChange = (id: string | number) => {
    const sid = String(id);
    setSelectedDiscounts((prev) => (prev.includes(sid) ? [] : [sid]));
  };

  /* Effective total after discount ------------------------------- */
  const selectedDiscount = availableDiscounts.find(
    (d) => String(d.id) === selectedDiscounts[0],
  );
  const effectiveCheckoutTotal =
    selectedDiscount != null
      ? Math.max(0, checkoutTotalAmount - getDiscountValue(selectedDiscount))
      : checkoutTotalAmount;
  const effectiveTotalCents = toCents(effectiveCheckoutTotal);

  /* -------------------------------------------------------------- */
  /* Build users & initial even split                               */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const list: User[] = [];

    if (currentUserData?.data?.user) {
      list.push({
        id: currentUserData.data.user.id,
        username: 'You',
        logo:
          currentUserData.data.user.logo ?? 'https://via.placeholder.com/150',
        isCurrentUser: true,
      });
    }

    if (multipleUsersData?.data) {
      multipleUsersData.data.forEach((u: any) => {
        list.push({
          id: u.user.id,
          username: u.user.username,
          logo: u.user.logo ?? 'https://via.placeholder.com/150',
        });
      });
    }

    setUsers(list);

    if (list.length) {
      const perCents = Math.floor(effectiveTotalCents / list.length);
      const remainder = effectiveTotalCents - perCents * list.length;

      const initAmounts: Record<string, string> = {};
      list.forEach((u, idx) => {
        const cents = idx === list.length - 1 ? perCents + remainder : perCents;
        initAmounts[u.id] = centsToStr(cents);
      });

      setAmounts(initAmounts);
      setTempAmounts(initAmounts);
      setIsEvenSplit(true);
    }
  }, [currentUserData, multipleUsersData, effectiveTotalCents]);

  /* Keep even split in sync -------------------------------------- */
  useEffect(() => {
    if (isEvenSplit && users.length) {
      const perCents = Math.floor(effectiveTotalCents / users.length);
      const remainder = effectiveTotalCents - perCents * users.length;

      const newAmts: Record<string, string> = {};
      users.forEach((u, idx) => {
        const cents = idx === users.length - 1 ? perCents + remainder : perCents;
        newAmts[u.id] = centsToStr(cents);
      });

      setAmounts(newAmts);
      setTempAmounts(newAmts);
    }
  }, [effectiveTotalCents, isEvenSplit, users]);

  /* -------------------------------------------------------------- */
  /* Adjust / Save toggle logic                                     */
  /* -------------------------------------------------------------- */

  const handleAdjustToggle = () => {
    if (!isAdjusting) {
      /* Enter adjust mode */
      setTempAmounts(amounts);
      setIsAdjusting(true);
      return;
    }

    /* ----- SAVE ----- */
    /* 1) Calculate locked sum in cents */
    const lockedIds = users
      .map((u) => u.id)
      .filter((id) => tempAmounts[id] !== amounts[id]);

    const lockedSumCents = lockedIds.reduce(
      (acc, id) => acc + toCents(parseFloat(tempAmounts[id] || '0')),
      0,
    );

    if (lockedSumCents > effectiveTotalCents) {
      toast.error(
        `Sum of locked amounts exceeds total $${effectiveCheckoutTotal.toFixed(
          2,
        )}`,
      );
      return;
    }

    /* 2) Distribute leftover among unlocked users */
    const newAmts: Record<string, string> = { ...tempAmounts };
    const unlockedIds = users
      .map((u) => u.id)
      .filter((id) => !lockedIds.includes(id));

    let leftoverCents = effectiveTotalCents - lockedSumCents;

    if (unlockedIds.length) {
      const perCents = Math.floor(leftoverCents / unlockedIds.length);
      const remainder = leftoverCents - perCents * unlockedIds.length;

      unlockedIds.forEach((id, idx) => {
        const cents =
          idx === unlockedIds.length - 1 ? perCents + remainder : perCents;
        newAmts[id] = centsToStr(cents);
      });
    } else if (leftoverCents !== 0) {
      toast.error(
        'All users are locked and amounts do not add up to the total.',
      );
      return;
    }

    setAmounts(newAmts);
    setIsEvenSplit(false);
    setIsAdjusting(false);
    toast.success('Amounts updated!');
  };

  /* -------------------------------------------------------------- */
  /* Split evenly button                                            */
  /* -------------------------------------------------------------- */

  const handleSplitEvenly = () => {
    if (!users.length) return;
    const perCents = Math.floor(effectiveTotalCents / users.length);
    const remainder = effectiveTotalCents - perCents * users.length;

    const newAmts: Record<string, string> = {};
    users.forEach((u, idx) => {
      const cents = idx === users.length - 1 ? perCents + remainder : perCents;
      newAmts[u.id] = centsToStr(cents);
    });

    setAmounts(newAmts);
    setTempAmounts(newAmts);
    setIsEvenSplit(true);
    setIsAdjusting(false);
    toast.success('Amounts split evenly!');
  };

  /* -------------------------------------------------------------- */
  /* Final split action                                             */
  /* -------------------------------------------------------------- */

  const handleSplit = () => {
    /* Validate sum */
    const sumCents = users.reduce(
      (acc, u) => acc + toCents(parseFloat(amounts[u.id] || '0')),
      0,
    );
    if (sumCents !== effectiveTotalCents) {
      toast.error('Amounts do not add up to the total.');
      return;
    }

    const splitData: SplitData = {
      type: 'split',
      userAmounts: users.map((u) => ({
        userId: u.id,
        amount: amounts[u.id],
      })),
    };

    navigate('/power-options', {
      state: { splitData, users, selectedDiscounts },
    });
  };

  /* -------------------------------------------------------------- */
  /* Render                                                         */
  /* -------------------------------------------------------------- */

  if (isMultipleUsersLoading || isCurrentUserLoading || isCheckoutLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading…
      </div>
    );
  }
  if (
    multipleUsersError ||
    currentUserError ||
    checkoutError ||
    discountsError ||
    !checkoutData
  ) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        Error loading data.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Back button ------------------------------------------------ */}
      <button onClick={() => navigate(-1)} className="flex items-center mb-4">
        <IoIosArrowBack size={24} className="mr-2" /> Back
      </button>

      {/* Header ----------------------------------------------------- */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Split Total: ${effectiveCheckoutTotal.toFixed(2)}
        </h1>
        <button
          onClick={handleSplitEvenly}
          className={`text-blue-600 ${isEvenSplit ? 'underline' : ''}`}
        >
          Split Evenly
        </button>
      </div>

      {/* User list -------------------------------------------------- */}
      <div className="space-y-4">
        {users.map((u) => {
          const val = isAdjusting ? tempAmounts[u.id] : amounts[u.id];
          return (
            <div
              key={u.id}
              className="flex items-center border p-4 rounded-lg"
            >
              <img
                src={u.logo}
                alt={u.username}
                className="w-16 h-16 rounded-full mr-4 object-cover"
              />
              <div className="flex-1">
                <p className="font-semibold mb-2">
                  {u.isCurrentUser ? 'You' : u.username}
                </p>
                <FloatingLabelInput
                  label={isYearly ? 'Yearly Amount' : 'Instant Amount'}
                  value={val || ''}
                  editable={isAdjusting}
                  onChangeText={(text: string) => {
                    if (!isAdjusting) return;

                    /* allow only numbers + dot, max 2 decimals */
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    let formatted = cleaned;
                    if (parts.length > 2) {
                      formatted = parts[0] + '.' + parts.slice(1).join('');
                    }
                    if (formatted.includes('.')) {
                      formatted = formatted.replace(
                        /(\.\d{2}).+$/,
                        (_, g1) => g1,
                      );
                    }

                    setTempAmounts((prev) => ({
                      ...prev,
                      [u.id]: formatted,
                    }));
                    setIsEvenSplit(false);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Discounts -------------------------------------------------- */}
      {!discountsLoading && availableDiscounts.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">Available Discounts</h2>
          <ul>
            {availableDiscounts.map((d) => {
              const disabled = checkoutTotalAmount - getDiscountValue(d) < 0;
              const sid = String(d.id);
              const checked = selectedDiscounts.includes(sid);

              const logoPath = merchantDetailData?.data?.brand?.displayLogo;
              const logoUrl =
                logoPath && logoPath.startsWith('http')
                  ? logoPath
                  : logoPath
                  ? `http://192.168.1.32:8080${logoPath.startsWith('/') ? '' : '/'}${logoPath}`
                  : undefined;

              return (
                <li
                  key={d.id}
                  onClick={() => !disabled && handleDiscountChange(d.id)}
                  className={`flex items-center justify-between border p-2 mb-2 rounded ${
                    disabled ? 'opacity-50' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-center">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt={merchantDetailData?.data?.brand?.displayName || ''}
                        className="w-10 h-10 rounded-full mr-4 object-cover"
                      />
                    )}
                    <div>
                      <p className="font-bold">{d.discountName}</p>
                      <p>
                        {d.type === 'PERCENTAGE_OFF'
                          ? `${d.discountPercentage}% off`
                          : `$${d.discountAmount?.toFixed(2)} off`}
                      </p>
                      {d.expiresAt && (
                        <p className="text-sm text-gray-500">
                          Expires:{' '}
                          {new Date(d.expiresAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="discount"
                    checked={checked}
                    readOnly
                    className="w-4 h-4 accent-blue-600"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Action buttons -------------------------------------------- */}
      <div className="mt-8 flex space-x-4">
        <button
          onClick={handleAdjustToggle}
          className="flex-1 py-3 bg-gray-100 rounded font-semibold"
        >
          {isAdjusting ? 'Save Changes' : 'Adjust'}
        </button>
        <button
          onClick={handleSplit}
          className="flex-1 py-3 bg-black text-white rounded font-semibold"
        >
          Split
        </button>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
};

export default MultipleUsersSendWeb;
