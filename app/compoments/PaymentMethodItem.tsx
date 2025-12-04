// File: app/components/PaymentMethodItem.tsx

import React from "react";
import { PaymentMethod } from "~/hooks/usePaymentMethods";
import { getCardImage } from "~/lib/utils";

interface PaymentMethodItemProps {
  method: PaymentMethod;
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  isLastItem?: boolean;
  GREEN_COLOR?: string; // ignored on web
}

const PaymentMethodItem: React.FC<PaymentMethodItemProps> = ({
  method,
  selectedMethod,
  onSelect,
  isLastItem = false,
}) => {
  const isSelected = !!selectedMethod && selectedMethod.id === method.id;

  const isBank = method.type === "bank";
  const card = method.card;

  const bankLogoBase64: string | undefined = isBank
    ? (method as any).institutionLogo
    : undefined;

  const bankName: string = isBank
    ? (method as any).institutionName ??
      (method as any).usBankAccount?.bank_name ??
      "Bank"
    : "";

  const accounts: any[] | undefined = isBank ? (method as any).accounts : undefined;

  const rawMask: string =
    accounts && accounts.length > 0
      ? (accounts[0]?.mask ?? "")
      : (method as any).usBankAccount?.last4 ??
        (method as any).last4 ??
        (method as any).bank_last4 ??
        "";

  const last4 = String(rawMask || "").slice(-4);

  const renderIcon = () => {
    if (card) {
      return (
        <img
          src={getCardImage(card.brand)}
          alt={`${card.brand} logo`}
          className="w-12 h-8 mr-4 object-contain"
          loading="lazy"
        />
      );
    }

    if (isBank) {
      if (bankLogoBase64) {
        return (
          <img
            src={`data:image/png;base64,${bankLogoBase64}`}
            alt={`${bankName} logo`}
            className="w-12 h-8 mr-4 object-contain"
            loading="lazy"
          />
        );
      }
      return (
        <svg viewBox="0 0 24 24" className="w-10 h-10 mr-4 text-black" aria-hidden="true">
          <path d="M3 10.5L12 3l9 7.5v1H3v-1Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M5 11.5v7h14v-7M4 19.5h16M8 11.5v7M12 11.5v7M16 11.5v7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 24 24" className="w-10 h-10 mr-4 text-black" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3.75" y="8" width="16.5" height="2.5" fill="currentColor" />
        <rect x="5.5" y="13.25" width="6" height="1.5" fill="currentColor" />
      </svg>
    );
  };

  const renderInfo = () => {
    if (card) {
      return (
        <p className="text-base font-bold text-black">
          {card.brand} ****{card.last4}
        </p>
      );
    }
    if (isBank) {
      return (
        <div className="flex flex-col">
          <p className="text-base font-bold text-black">{bankName}</p>
          <p className="text-sm text-gray-600">****{last4}</p>
        </div>
      );
    }
    return <p className="text-base font-bold text-black">{method.id}</p>;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(method)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(method);
        }
      }}
      className={`flex items-center justify-between p-4 rounded-lg cursor-pointer bg-white transition
        ${!isLastItem ? "border-b border-gray-200" : "border-b-0"}
        hover:bg-gray-50`}
    >
      <div className="flex items-center flex-1">
        {renderIcon()}
        <div className="flex flex-col">{renderInfo()}</div>
      </div>

      {/* 100% native radio */}
      <input
        type="radio"
        name="payment-method"
        aria-label={`Select ${
          isBank ? bankName : card ? `${card.brand} ending in ${card.last4}` : "payment method"
        }`}
        checked={isSelected}
        onChange={() => onSelect(method)}
        className="h-5 w-5"
      />
    </div>
  );
};

export default PaymentMethodItem;
