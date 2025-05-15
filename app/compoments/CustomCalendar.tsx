import React, { useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { GoChevronLeft, GoChevronRight } from 'react-icons/go'
import DayCell from './DayCell';

interface SplitPayment { date: string; amount: number; type: string }
interface IncomeEvent  { date: string; amount: number; provider: string }
interface LiabilityEvent { date: string; amount: number; type: string }
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
  onRemoveAvoidedDate,
  onDoubleTap,
  renderSplitPayment = true,
  splitPayments,
  incomeEvents,
  liabilityEvents,
  avoidedDates = [],
  paymentPlanPayments = [],
  planEvents = [],
  selectedStartDate = null,
  selectedEndDate = null,
  readonly = false,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date())

  useEffect(() => { initialDate && setCurrentDate(initialDate) }, [initialDate])

  const daysInMonth = (m: number, y: number) =>
    new Date(y, m + 1, 0).getDate()

  const generateCalendarGrid = (): (number|null)[] => {
    const days: (number|null)[] = []
    const firstWeekday = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    ).getDay()
    for (let i = 0; i < firstWeekday; i++) days.push(null)
    const total = daysInMonth(currentDate.getMonth(), currentDate.getFullYear())
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
    planEvents.forEach(p => mark(p.plannedPaymentDate, 'paymentPlan'))
    paymentPlanPayments.forEach(p => mark(p.dueDate, 'paymentPlan'))
    return map as Record<number, {
      liability?: boolean
      splitPayment?: boolean
      income?: boolean
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

  const changeMonth = (dir: 'prev'|'next') =>
    setCurrentDate(new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + (dir === 'prev' ? -1 : 1),
      1
    ))

  return (
    <div className="p-2 bg-white rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <button onClick={() => changeMonth('prev')} className="p-2">
          <GoChevronLeft size={24} className="text-blue-600"/>
        </button>
        <div className="text-lg font-bold">
          {currentDate.toLocaleString('default', { month:'long' })}{' '}
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
        {(planEvents.length > 0 || paymentPlanPayments.length > 0) &&
          <LegendDot className="bg-purple-100" label="Payment Plan"/>
        }
        {avoidedRanges.length > 0 &&
          <LegendDot className="bg-red-100" label="Avoided Dates"/>
        }
        <LegendDot className="bg-blue-200" label="Selected Range"/>
      </div>

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
