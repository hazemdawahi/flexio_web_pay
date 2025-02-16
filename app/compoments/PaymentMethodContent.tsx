import React, { useEffect, useState } from "react";
import { FaRegStar, FaTrashAlt } from "react-icons/fa";
import { MdOutlineAccountBalance } from "react-icons/md";
import { useDetachPaymentMethod } from "~/hooks/useDetachPaymentMethod";
import { useMarkPrimaryPaymentMethod } from "~/hooks/useSetPrimaryPaymentMethod";
import { toast } from "sonner";

export type BankDetail = {
  id: string;
  bank_name: string;
  last4: string;
  primary: boolean;
};

export type CardDetail = {
  id: string;
  brand: string;
  last4: string;
  primary: boolean;
};

export type PaymentMethodContentProps = {
  cardDetail?: CardDetail;
  bankDetail?: BankDetail;
  /** For web, pass a URL string for the card logo */
  cardLogo?: string;
  handleClose: () => void;
  setPrimary: (id: string) => void;
  primary: boolean;
  paymentMethodId: string;
  triggerToast: (type: "success" | "error", message: string) => void;
};

const PaymentMethodContent: React.FC<PaymentMethodContentProps> = ({
  cardDetail,
  bankDetail,
  cardLogo,
  handleClose,
  setPrimary,
  primary,
  paymentMethodId,
  triggerToast,
}) => {
  const [iconColor, setIconColor] = useState("#000");

  // For web, we assume a light theme by default
  useEffect(() => {
    setIconColor("#000");
  }, []);

  const { mutate: detachPaymentMethod } = useDetachPaymentMethod();
  const { mutate: markPrimaryPaymentMethod } = useMarkPrimaryPaymentMethod();

  const handleSetPrimary = () => {
    markPrimaryPaymentMethod(
      { paymentMethodId },
      {
        onSuccess: (data: any) => {
          if (data.success) {
            triggerToast("success", "Primary payment method updated successfully.");
            setPrimary(paymentMethodId);
          } else {
            triggerToast("error", `Failed to update primary payment method: ${data.errorMessage}`);
          }
        },
        onError: (error: any) => {
          triggerToast("error", `Failed to update primary payment method: ${error.message}`);
        },
      }
    );
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this payment method?")) {
      detachPaymentMethod(
        { paymentMethodId },
        {
          onSuccess: () => {
            triggerToast("success", "Payment method deleted successfully.");
            handleClose();
          },
          onError: (error: any) => {
            triggerToast("error", `Failed to delete payment method: ${error.message}`);
          },
        }
      );
    }
  };

  return (
    <div className="p-2">
      {/* Card Details */}
      {cardDetail && (
        <div className="flex items-center mb-2">
          {cardLogo && (
            <img src={cardLogo} alt="Card Logo" className="w-12 h-12 mr-3" />
          )}
          <span className="text-lg font-semibold mx-1" style={{ color: iconColor }}>
            ....
          </span>
          <span className="text-lg font-semibold" style={{ color: iconColor }}>
            {cardDetail.last4}
          </span>
        </div>
      )}

      {/* Bank Details */}
      {bankDetail && (
        <div className="flex items-center mb-2">
          <MdOutlineAccountBalance size={40} color={iconColor} />
          <span className="text-lg font-semibold ml-2" style={{ color: iconColor }}>
            {bankDetail.bank_name}
          </span>
          <span className="text-lg font-semibold mx-2" style={{ color: iconColor }}>
            ....
          </span>
          <span className="text-lg font-semibold" style={{ color: iconColor }}>
            {bankDetail.last4}
          </span>
        </div>
      )}

      {/* Set as Primary Option */}
      {!primary && cardDetail && (
        <>
          <button
            onClick={handleSetPrimary}
            className="flex items-center w-full text-left py-2 bg-transparent border-0 cursor-pointer"
          >
            <div className="w-8 flex items-center justify-center">
              <FaRegStar size={24} color={iconColor} />
            </div>
            <span className="ml-2 text-base font-semibold" style={{ color: iconColor }}>
              Set as Primary Card
            </span>
          </button>
          <div className="h-px bg-gray-300 my-2" />
        </>
      )}

      {/* Delete Option */}
      <button
        onClick={handleDelete}
        className="flex items-center w-full text-left py-2 bg-transparent border-0 cursor-pointer"
      >
        <div className="w-8 flex items-center justify-center">
          <FaTrashAlt size={24} color={iconColor} />
        </div>
        <span className="ml-2 text-base font-semibold" style={{ color: iconColor }}>
          Delete {cardDetail ? "Card" : "Bank Account"}
        </span>
      </button>
    </div>
  );
};

export default PaymentMethodContent;
