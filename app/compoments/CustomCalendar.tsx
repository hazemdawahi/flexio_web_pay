// CustomCalendar.tsx
import { useEffect, useState, useMemo } from 'react'
import { toast, Toaster } from 'sonner'
import { GoChevronLeft, GoChevronRight } from 'react-icons/go'
import { MdCheckCircleOutline, MdCancel } from 'react-icons/md'
import DayCell from './DayCell'

// 🔁 SmartPay prerequisite hooks (web; align with mobile behavior)
import { useCreditAccounts } from '~/hooks/useCreditAccounts'
import { useSmartpayPreferencesMe } from '~/hooks/useSmartpayPreferencesMe'
import { useSmartpayIncomes } from '~/hooks/useSmartpayIncomes'

interface SplitPayment { date: string; amount: number; type: string }
interface IncomeEvent  { date: string; amount: number; provider: string }
interface LiabilityEvent { date: string; amount: number; type: string }
interface RentEvent    { date: string; amount: number; type: string }   // ← kept
interface AvoidedDate { id: string; startDate: string; endDate: string; name: string }
interface PlanEvent   { plannedPaymentDate: string; allocatedPayment: number }
interface PaymentPlanPayment { dueDate: string; amount: number }

export interface CalendarProps {
  initialDate?: Date
  onDateSelect?: (date: Date) => void
  onRangeSelect?: (start: Date, end: Date | null) => void
  onRemoveAvoidedDate?: (id: string) => void
  onDoubleTap?: (date: Date) => void
  renderSplitPayment?: boolean
  splitPayments: SplitPayment[]
  incomeEvents: IncomeEvent[]
  liabilityEvents: LiabilityEvent[]
  rentEvents?: RentEvent[]                    // ← kept
  avoidedDates?: AvoidedDate[]
  paymentPlanPayments?: PaymentPlanPayment[]
  planEvents?: PlanEvent[]
  selectedStartDate?: Date | null
  selectedEndDate?: Date | null
  readonly?: boolean
}

const daysOfWeek = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CustomCalendar({
  initialDate,
  onDateSelect,
  onRangeSelect,
  onRemoveAvoidedDate: _onRemoveAvoidedDate, // preserved for API compatibility
  onDoubleTap,
  renderSplitPayment = true,
  splitPayments,
  incomeEvents,
  liabilityEvents,
  rentEvents = [],                             // ← defaulted
  avoidedDates = [],
  paymentPlanPayments = [],
  planEvents = [],
  selectedStartDate = null,
  selectedEndDate = null,
  readonly = false,
}: CalendarProps) {

  // ───────────────── SmartPay prerequisites (mirror mobile) ─────────────────
  const { data: creditAccountsResponse, isLoading: creditLoading } = useCreditAccounts()
  const { data: preferences,           isLoading: prefLoading   } = useSmartpayPreferencesMe()
  const { data: incomes,               isLoading: incomesLoading } = useSmartpayIncomes()

  const creditTokens = useMemo(() => {
    const t = (creditAccountsResponse as any)?.data?.tokens
    return Array.isArray(t) ? t : []
  }, [creditAccountsResponse])

  const hasCredit = creditTokens.length > 0
  const hasPreferences = preferences != null
  const hasIncomes = Array.isArray(incomes) && incomes.length > 0
  const allDone = hasCredit && hasPreferences && hasIncomes
  const anyLoading = creditLoading || prefLoading || incomesLoading

  // ───────────────────────── Calendar state ─────────────────────────────────
  const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date())

  useEffect(() => {
    if (initialDate) setCurrentDate(initialDate)
  }, [initialDate])

  const daysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate()

  const generateCalendarGrid = (): (number | null)[] => {
    const days: (number | null)[] = []
    const firstWeekday = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    ).getDay()
    for (let i = 0; i < firstWeekday; i++) days.push(null)

    const total = daysInMonth(
      currentDate.getMonth(),
      currentDate.getFullYear()
    )
    for (let d = 1; d <= total; d++) days.push(d)
    while (days.length % 7) days.push(null)
    return days
  }

  const generateEventMap = () => {
    const map: Record<number, any> = {}
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')

    function mark(dateStr: string, key: string) {
      if (dateStr.startsWith(`${year}-${month}-`)) {
        const day = parseInt(dateStr.slice(-2), 10)
        map[day] = map[day] || {}
        map[day][key] = true
      }
    }

    liabilityEvents.forEach(e => mark(e.date, 'liability'))
    renderSplitPayment && splitPayments.forEach(s => mark(s.date, 'splitPayment'))
    incomeEvents.forEach(i => mark(i.date, 'income'))
    rentEvents.forEach(r => mark(r.date, 'rent'))        // ← kept
    planEvents.forEach(p => mark(p.plannedPaymentDate, 'paymentPlan'))
    paymentPlanPayments.forEach(p => mark(p.dueDate, 'paymentPlan'))

    return map as Record<number, {
      liability?: boolean
      splitPayment?: boolean
      income?: boolean
      rent?: boolean                            // ← kept
      paymentPlan?: boolean
    }>
  }

  const avoidedRanges = avoidedDates.map(r => ({
    id: r.id,
    start: new Date(r.startDate),
    end: new Date(r.endDate),
    name: r.name,
  }))

  const isAvoided = (d: Date) =>
    avoidedRanges.some(r => d >= r.start && d <= r.end)

  const isInRange = (d: Date) =>
    selectedStartDate != null &&
    selectedEndDate != null &&
    d >= selectedStartDate &&
    d <= selectedEndDate

  const grid = generateCalendarGrid()
  const eventMap = generateEventMap()

  const handleSingle = (day: number) => {
    if (readonly && !eventMap[day]) return
    onDateSelect?.(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
  }

  const handleDouble = (day: number) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    if (isAvoided(d)) {
      toast.error('This date range is avoided.')
      return
    }
    onDoubleTap?.(d)
  }

  const handleLong = (day: number) => {
    if (readonly) return
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    if (isAvoided(d)) {
      toast.error('This date range is avoided.')
      return
    }
    if (!selectedStartDate || selectedEndDate) {
      onRangeSelect?.(d, null)
    } else {
      if (d < selectedStartDate) onRangeSelect?.(d, selectedStartDate)
      else {
        onRangeSelect?.(selectedStartDate, d)
        if (
          d.getFullYear() !== currentDate.getFullYear() ||
          d.getMonth() !== currentDate.getMonth()
        ) {
          setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1))
        }
      }
    }
  }

  const changeMonth = (dir: 'prev' | 'next') =>
    setCurrentDate(new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + (dir === 'prev' ? -1 : 1),
      1
    ))

  return (
    <div className="relative p-2 bg-white rounded-lg border border-gray-300 overflow-hidden">

      {/* Inline loading overlay (matches mobile intent) */}
      {anyLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-transparent">
          <div className="loader h-10 w-10 border-4 border-gray-300 rounded-full" style={{ borderTopColor: '#000' }} />
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <button onClick={() => changeMonth('prev')} className="p-2">
          <GoChevronLeft size={24} className="text-blue-600"/>
        </button>
        <div className="text-lg font-bold">
          {currentDate.toLocaleString('default', { month: 'long' })}{' '}
          {currentDate.getFullYear()}
        </div>
        <button onClick={() => changeMonth('next')} className="p-2">
          <GoChevronRight size={24} className="text-blue-600"/>
        </button>
      </div>

      <div className="flex justify-around mb-1">
        {daysOfWeek.map(d => (
          <div key={d} className="text-xs font-semibold text-gray-400 w-[14%] text-center">{d}</div>
        ))}
      </div>

      <div className="flex flex-wrap">
        {grid.map((day, idx) =>
          day != null ? (
            <DayCell
              key={`${day}-${idx}`}
              day={day}
              currentDate={currentDate}
              eventMap={eventMap}
              inRange={isInRange(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              isStart={selectedStartDate?.toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString()}
              isEnd={selectedEndDate?.toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString()}
              avoided={isAvoided(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              onSingleTap={() => handleSingle(day)}
              onDoubleTap={() => handleDouble(day)}
              onLongPress={() => handleLong(day)}
            />
          ) : (
            <div key={`empty-${idx}`} className="w-[14%] h-16" />
          )
        )}
      </div>

      <div className="flex flex-wrap justify-around mt-2">
        <LegendDot className="bg-pink-200" label="Liability Event"/>
        {renderSplitPayment && <LegendDot className="bg-purple-200" label="Split Payment"/>}
        <LegendDot className="bg-green-200" label="Income Event"/>
        <LegendDot className="bg-orange-500" label="Rent Event"/>  {/* ← kept */}
        {(planEvents.length > 0 || paymentPlanPayments.length > 0) &&
          <LegendDot className="bg-purple-100" label="Payment Plan"/>
        }
        {avoidedRanges.length > 0 &&
          <LegendDot className="bg-red-100" label="Avoided Dates"/>
        }
        <LegendDot className="bg-blue-200" label="Selected Range"/>
      </div>

      {/* Blocking overlay card when prerequisites are missing (align with mobile UI) */}
      {!allDone && !anyLoading && (
        <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
          <div className="w-[85%] max-w-md bg-white rounded-xl p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-center text-gray-800 mb-4">
              Complete these steps to unlock:
            </h3>

            <StepRow
              label="Add Income"
              ok={hasIncomes}
            />
            <StepRow
              label="Add Preferences"
              ok={hasPreferences}
            />
            <StepRow
              label="Add Credit Institution"
              ok={hasCredit}
            />
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center my-1 mr-3">
      <div className={`w-3 h-3 rounded-full mr-1 ${className}`} />
      <div className="text-xs text-gray-800">{label}</div>
    </div>
  )
}

function StepRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-gray-200 first:border-t-0">
      <span className="text-[15px] text-gray-700">{label}</span>
      {ok ? (
        <MdCheckCircleOutline size={22} color="#4BB543" />
      ) : (
        <MdCancel size={22} color="#E74C3C" />
      )}
    </div>
  )
}
