// src/components/FlippedContent.tsx
import React from 'react'
import { toast } from 'sonner'
import { MdOutlineError, MdDeleteOutline } from 'react-icons/md'

interface SplitPayment { dueDate: string; amount: number }
interface IncomeEvent  { date: string; amount: number; provider: string }
interface LiabilityEvent { date: string; amount: number; type: string }
interface RentEvent    { date: string; amount: number; type: string }   // ← added
interface PaymentPlanPayment { dueDate: string; amount: number }

export interface FinancialEventDetails {
  date: string
  splitPayments: SplitPayment[]
  incomeEvents: IncomeEvent[]
  liabilityEvents: LiabilityEvent[]
  rentEvents?: RentEvent[]                       // ← added
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
  isDeleting,
  readonly = false,
}: Props) {
  if (!details) {
    return (
      <div className="flex flex-col items-center p-6 bg-white rounded-lg">
        <p className="text-lg mb-4">No events for this date.</p>
        <button
          onClick={onToggle}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-100"
        >
          Back
        </button>
      </div>
    )
  }

  const {
    date,
    splitPayments,
    incomeEvents,
    liabilityEvents,
    rentEvents = [],                           // ← defaulted
    paymentPlanPayments,
    isAvoided,
    avoidedRangeName,
    avoidedRangeId,
  } = details

  return (
    <div className="max-h-[80vh] overflow-y-auto bg-white rounded-lg p-6 flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4">
        Details for {new Date(date).toDateString()}
      </h2>

      {isAvoided && avoidedRangeName && (
        <div className="flex items-center bg-red-100 p-3 rounded mb-4 w-full">
          <MdOutlineError size={24} className="text-red-600" />
          <div className="flex-1 ml-2">
            <p className="text-red-600 font-semibold">{avoidedRangeName}</p>
            <p className="text-red-600 text-sm">{new Date(date).toDateString()}</p>
          </div>
          {!readonly && (
            <button
              disabled={isDeleting}
              onClick={() => {
                if (avoidedRangeId) {
                  onRemoveAvoidedDate?.(avoidedRangeId)
                }
              }}
              className="p-2"
            >
              {isDeleting
                ? <MdDeleteOutline size={24} className="animate-spin text-red-600"/>
                : <MdDeleteOutline size={24} className="text-red-600"/>}
            </button>
          )}
        </div>
      )}

      {liabilityEvents.length > 0 && (
        <Section title="Liability Events:">
          {liabilityEvents.map((e, i) =>
            <p key={i} className="ml-4">{e.type}: ${e.amount.toFixed(2)}</p>
          )}
        </Section>
      )}

      {splitPayments.length > 0 && (
        <Section title="Split Payments:">
          {splitPayments.map((p, i) =>
            <p key={i} className="ml-4">
              Due on {new Date(p.dueDate).toLocaleDateString()}: ${p.amount.toFixed(2)}
            </p>
          )}
        </Section>
      )}

      {incomeEvents.length > 0 && (
        <Section title="Income Events:">
          {incomeEvents.map((e, i) =>
            <p key={i} className="ml-4">{e.provider}: ${e.amount.toFixed(2)}</p>
          )}
        </Section>
      )}

      {rentEvents.length > 0 && (                    // ← added
        <Section title="Rent Events:">
          {rentEvents.map((r, i) =>
            <p key={i} className="ml-4">{r.type}: ${r.amount.toFixed(2)}</p>
          )}
        </Section>
      )}

      {paymentPlanPayments && paymentPlanPayments.length > 0 && (
        <Section title="Payment Plan:">
          {paymentPlanPayments.map((p, i) =>
            <button
              key={i}
              onClick={() => toast(`Plan payment: $${p.amount.toFixed(2)}`)}
              className="ml-4 mb-2 text-left"
            >
              Due on {new Date(p.dueDate).toLocaleDateString()}: ${p.amount.toFixed(2)}
            </button>
          )}
        </Section>
      )}

      <button
        onClick={onToggle}
        className="mt-4 px-6 py-2 border border-gray-300 rounded hover:bg-gray-100"
      >
        Back To Calendar
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full mb-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  )
}
