// File: app/components/PaymentMethodItem.tsx
import type { PaymentMethod } from "~/hooks/usePaymentMethods";

// Card brand images - adjust paths as needed for your project
const cardImages: Record<string, string> = {
  visa: "/images/cards/visa.png",
  mastercard: "/images/cards/mastercard.png",
  amex: "/images/cards/amex.png",
  discover: "/images/cards/discover.png",
  default: "/images/cards/generic-card.png",
};

const getCardImage = (brand?: string): string => {
  if (!brand) return cardImages.default;
  const key = brand.toLowerCase().replace(/\s+/g, "");
  return cardImages[key] || cardImages.default;
};

interface PaymentMethodItemProps {
  method: PaymentMethod;
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  GREEN_COLOR?: string;
  disabled?: boolean;
}

const RADIO_COLOR = "#00BFFF";
const RADIO_UNCHECKED = "#C7CFD9";
const DISABLED_OPACITY = 0.4;

const PaymentMethodItem = ({
  method,
  selectedMethod,
  onSelect,
  GREEN_COLOR: _GREEN_COLOR = "#4cd964",
  disabled = false,
}: PaymentMethodItemProps) => {
  const isSelected = !!selectedMethod && selectedMethod.id === method.id;
  const card = method.card;
  const isBank = method.type === "bank";

  const bankLogoBase64: string | undefined = isBank
    ? (method as any).institutionLogo
    : undefined;
  const bankName: string = isBank
    ? (method as any).institutionName ?? "Bank"
    : "";
  const accounts: any[] | undefined = isBank ? (method as any).accounts : undefined;
  const rawMask: string =
    accounts && accounts.length > 0
      ? accounts[0].mask
      : (method as any).last4 ?? "";
  const last4 = rawMask.length > 4 ? rawMask.slice(-4) : rawMask;

  const handleClick = () => {
    if (!disabled) onSelect(method);
  };

  const renderIcon = () => {
    if (card) {
      return (
        <img
          src={getCardImage(card.brand)}
          alt={card.brand || "Card"}
          className="w-12 h-8 object-contain mr-4"
        />
      );
    }

    if (isBank) {
      if (bankLogoBase64) {
        return (
          <img
            src={`data:image/png;base64,${bankLogoBase64}`}
            alt={bankName}
            className="w-12 h-8 object-contain mr-4"
          />
        );
      }
      return (
        <svg
          className="w-10 h-10 mr-4"
          fill="none"
          stroke={disabled ? "#999" : "currentColor"}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      );
    }

    return (
      <svg
        className="w-10 h-10 mr-4"
        fill="none"
        stroke={disabled ? "#999" : "currentColor"}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    );
  };

  const renderInfo = () => {
    if (card) {
      return (
        <div className="flex flex-col">
          <span className={`text-base font-bold ${disabled ? "text-gray-400" : "text-black"}`}>
            {card.brand} ****{card.last4}
          </span>
          {disabled && (
            <span className="text-xs text-gray-500 mt-0.5">Already in use</span>
          )}
        </div>
      );
    }

    if (isBank) {
      return (
        <div className="flex flex-col">
          <span className={`text-base font-bold ${disabled ? "text-gray-400" : "text-black"}`}>
            {bankName}
          </span>
          <span className={`text-sm ${disabled ? "text-gray-400" : "text-gray-600"}`}>
            ****{last4}
          </span>
          {disabled && (
            <span className="text-xs text-gray-500 mt-0.5">Already in use</span>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <span className={`text-base font-bold ${disabled ? "text-gray-400" : "text-black"}`}>
          {method.id}
        </span>
        {disabled && (
          <span className="text-xs text-gray-500 mt-0.5">Already in use</span>
        )}
      </div>
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        flex items-center justify-between w-full py-2.5 px-4 rounded-[10px] my-1.5
        ${disabled ? "bg-gray-50 cursor-not-allowed" : "bg-white hover:bg-gray-50 cursor-pointer"}
      `}
    >
      <div
        className="flex items-center flex-1"
        style={disabled ? { opacity: DISABLED_OPACITY } : undefined}
      >
        {renderIcon()}
        <div className="flex justify-center">{renderInfo()}</div>
      </div>

      {/* Radio button */}
      <div
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
        style={{
          borderColor: isSelected ? RADIO_COLOR : disabled ? "#ddd" : RADIO_UNCHECKED,
        }}
      >
        {isSelected && (
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: RADIO_COLOR }}
          />
        )}
      </div>
    </button>
  );
};

export default PaymentMethodItem;