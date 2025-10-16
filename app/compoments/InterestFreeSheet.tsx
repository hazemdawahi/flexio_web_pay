import React, { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InterestFreeSheetProps {
  open: boolean;
  onClose: () => void;

  availableIF: number;
  originalAmount: number;

  freeInput: string;
  setFreeInput: (val: string) => void;

  applyFree: () => void;
}

const InterestFreeSheet: React.FC<InterestFreeSheetProps> = ({
  open,
  onClose,
  availableIF,
  originalAmount,
  freeInput,
  setFreeInput,
  applyFree,
}) => {
  const digitsOnly = useCallback((s: string) => s.replace(/\D+/g, ""), []);
  const handleChange = useCallback(
    (text: string) => setFreeInput(digitsOnly(text)),
    [setFreeInput, digitsOnly]
  );

  const amount = Number(freeInput || "0") || 0;
  const isDisabled =
    amount < 0 || amount > availableIF || amount > originalAmount;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
          >
            <motion.div
              className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b">
                <h3 className="font-bold">Interest-free</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Your available interest-free: ${availableIF.toFixed(2)} ·
                  &nbsp;Order total: ${originalAmount.toFixed(2)}
                </p>
              </div>

              <div className="p-4">
                <label className="block text-sm font-medium mb-1">
                  Enter interest-free amount
                </label>
                <input
                  value={freeInput}
                  onChange={(e) => handleChange(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  className="w-full p-3 border rounded-md shadow-sm focus:ring-black focus:border-black"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Digits only. Max ${Math.min(availableIF, originalAmount).toFixed(2)}.
                </p>

                <button
                  className={`mt-4 w-full rounded-lg py-3 font-bold text-white ${
                    isDisabled
                      ? "bg-gray-500 cursor-not-allowed"
                      : "bg-black hover:bg-gray-800"
                  }`}
                  onClick={applyFree}
                  disabled={isDisabled}
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InterestFreeSheet;
