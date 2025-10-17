// src/components/FlippedContent.tsx
import React from 'react'
import { toast } from 'sonner'
import {
  MdOutlineError,
  MdDeleteOutline,
} from 'react-icons/md'

interface SplitPayment { dueDate: string; amount: number }
interface IncomeEvent  { date: string; amount: number; provider: string }
interface LiabilityEvent { date: string; amount: number; type: string }
interface RentEvent    { date: string; amount: number; type: string }
interface PaymentPlanPayment { dueDate: string; amount: number }

export interface FinancialEventDetails {
  date: string
  splitPayments: SplitPayment[]
  incomeEvents: IncomeEvent[]
  liabilityEvents: LiabilityEvent[]
  rentEvents?: RentEvent[]
  paymentPlanPayments?: PaymentPlanPayment[]
  isAvoided?: boolean
  avoidedRangeName?: string
  avoidedRangeId?: string
}

interface Props {
  details: FinancialEventDetails | null
  onToggle: () => void
  onRemoveAvoidedDate?: (id: string) => void
  isDeleting?: boolean
  readonly?: boolean
}

export default function FlippedContent({
  details,
  onToggle,
  onRemoveAvoidedDate,
  isDeleting = false,
  readonly = false,
}: Props) {
  if (!details) {
    return (
      <div className="w-full max-w-3xl h-[60vh] bg-white rounded-lg border border-gray-300 overflow-hidden flex flex-col items-center justify-center px-5">
        <p className="text-black text-lg mb-4 text-center">No events for this date.</p>
        <button
          onClick={onToggle}
          className="bg-transparent border border-gray-300 px-5 py-2 rounded-lg hover:bg-gray-50 transition"
          aria-label="Go back to the regular content"
        >
          <span className="text-black font-semibold">Back</span>
        </button>
      </div>
    )
  }

  const {
    date,
    splitPayments,
    incomeEvents,
    liabilityEvents,
    rentEvents = [],
    paymentPlanPayments = [],
    isAvoided,
    avoidedRangeName,
    avoidedRangeId,
  } = details

  return (
    <div className="w-full max-w-3xl h-[60vh] bg-white rounded-lg border border-gray-300 overflow-hidden">
      <div className="h-full overflow-y-auto flex flex-col items-center px-5 py-5">
        {/* Header */}
        <h2 className="text-black text-xl font-bold mb-4 text-center">
          Details for {new Date(date).toDateString()}
        </h2>

        {/* Avoided banner (matches mobile intent) */}
        {isAvoided && avoidedRangeName && (
          <div className="flex items-center bg-[#FFECEC] px-3 py-2 rounded-lg mb-4 w-full">
            <MdOutlineError size={24} color="#FF3B30" />
            <div className="flex items-center flex-1 justify-between ml-2">
              <div className="flex-1">
                <p className="text-[#FF3B30] text-sm font-semibold">{avoidedRangeName}</p>
                <p className="text-[#FF3B30] text-xs mt-0.5">{new Date(date).toDateString()}</p>
              </div>
              {!readonly && (
                <button
                  onClick={() => {
                    if (avoidedRangeId) onRemoveAvoidedDate?.(avoidedRangeId)
                  }}
                  disabled={isDeleting}
                  aria-label={`Remove avoided date range ${avoidedRangeName}`}
                  className="p-2 rounded hover:bg-red-50 disabled:opacity-60"
                >
                  {isDeleting ? (
                    <MdDeleteOutline size={24} className="text-[#FF3B30] animate-spin" />
                  ) : (
                    <MdDeleteOutline size={24} className="text-[#FF3B30]" />
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Liability Events */}
        {liabilityEvents.length > 0 && (
          <Section title="Liability Events:">
            {liabilityEvents.map((e, i) => (
              <p key={`liability-${i}`} className="text-sm text-black ml-3 mb-1">
                {e.type}: ${e.amount.toFixed(2)}
              </p>
            ))}
          </Section>
        )}

        {/* Split Payments */}
        {splitPayments.length > 0 && (
          <Section title="Split Payments:">
            {splitPayments.map((p, i) => (
              <p key={`split-${i}`} className="text-sm text-black ml-3 mb-1">
                Due on {new Date(p.dueDate).toLocaleDateString()}: ${p.amount.toFixed(2)}
              </p>
            ))}
          </Section>
        )}

        {/* Income Events */}
        {incomeEvents.length > 0 && (
          <Section title="Income Events:">
            {incomeEvents.map((e, i) => (
              <p key={`income-${i}`} className="text-sm text-black ml-3 mb-1">
                {e.provider}: ${e.amount.toFixed(2)}
              </p>
            ))}
          </Section>
        )}

        {/* Rent Events */}
        {rentEvents.length > 0 && (
          <Section title="Rent Events:">
            {rentEvents.map((r, i) => (
              <p key={`rent-${i}`} className="text-sm text-black ml-3 mb-1">
                {r.type}: ${r.amount.toFixed(2)}
              </p>
            ))}
          </Section>
        )}

        {/* Payment Plan */}
        {paymentPlanPayments.length > 0 && (
          <Section title="Payment Plan:">
            {paymentPlanPayments.map((p, i) => (
              <button
                key={`plan-${i}`}
                onClick={() => toast.info(`Plan payment: $${p.amount.toFixed(2)}`)}
                className="text-left ml-3 mb-2 hover:underline"
              >
                <span className="text-sm text-black">
                  Due on {new Date(p.dueDate).toLocaleDateString()}: ${p.amount.toFixed(2)}
                </span>
              </button>
            ))}
          </Section>
        )}

        {/* Back button */}
        <button
          onClick={onToggle}
          className="bg-transparent border border-gray-300 px-5 py-2 rounded-lg mt-2 hover:bg-gray-50 transition self-stretch"
          aria-label="Go back to the regular content"
        >
          <span className="text-black font-semibold">Back To Calendar</span>
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full mb-4">
      <h3 className="text-black text-base font-semibold mb-2">{title}</h3>
      {children}
    </div>
  )
}
