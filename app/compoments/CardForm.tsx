import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useAttachPaymentMethod } from "~/hooks/useAttachPaymentMethod";

export interface CardFormProps {
  onPaymentMethodCreated: (paymentMethod: any) => void;
  onClose: () => void;
}

const CardForm: React.FC<CardFormProps> = ({ onPaymentMethodCreated, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { mutateAsync: attachPaymentMethod } = useAttachPaymentMethod();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage("Card element not found.");
      setLoading(false);
      return;
    }

    // Create the payment method with Stripe
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      setLoading(false);
      return;
    }

    try {
      // Attach the payment method to the customer
      const attachResponse = await attachPaymentMethod({
        paymentMethodId: paymentMethod!.id,
      });

      if (attachResponse.success) {
        onPaymentMethodCreated(paymentMethod);
        onClose(); // close the modal on success
      } else {
        setErrorMessage(attachResponse.error || "Failed to attach payment method.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to attach payment method.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 p-4">
      <h2 className="text-xl font-semibold mb-4">Add New Card</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Card Details
        </label>
        <div className="mt-1 p-2 border border-gray-300 rounded">
          <CardElement
          
            options={{
                
              disableLink: true,
              hidePostalCode:true,
            
              style: {
                base: {
                  fontSize: "16px",
                  color: "#32325d",
                  "::placeholder": { color: "#a0aec0" },
                },
                invalid: {
                  color: "#fa755a",
                },
              },
            }}
          />
        </div>
      </div>

      {errorMessage && (
        <p className="text-red-500 text-sm">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-2 px-4 bg-black text-white font-bold rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Add Card"}
      </button>
    </form>
  );
};

export default CardForm;
