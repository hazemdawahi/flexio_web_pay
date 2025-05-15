import React, { useRef } from 'react'

interface EventMap {
  [day: number]: {
    liability?: boolean
    splitPayment?: boolean
    income?: boolean
    paymentPlan?: boolean
  }
}

interface Props {
  day: number
  currentDate: Date
  eventMap: EventMap
  isStart: boolean
  isEnd: boolean
  inRange: boolean
  avoided: boolean
  onSingleTap: (day: number) => void
  onDoubleTap: (day: number) => void
  onLongPress: (day: number) => void
}

export default function DayCell({
  day, eventMap, inRange, isStart, isEnd, avoided,
  onSingleTap, onDoubleTap, onLongPress
}: Props) {
  const clickRef = useRef<NodeJS.Timeout | null>(null)
  const longRef  = useRef<NodeJS.Timeout | null>(null)

  const handlePointerDown = () => {
    longRef.current = setTimeout(() => onLongPress(day), 350)
  }
  const handlePointerUp = () => {
    if (longRef.current) clearTimeout(longRef.current)
  }

  const handleClick = () => {
    // delay single-click to distinguish dblclick
    if (!clickRef.current) {
      clickRef.current = setTimeout(() => {
        onSingleTap(day)
        clickRef.current = null
      }, 200)
    }
  }
  const handleDoubleClick = () => {
    if (clickRef.current) {
      clearTimeout(clickRef.current)
      clickRef.current = null
    }
    onDoubleTap(day)
  }

  const baseClasses = [
    'w-[14%] h-16 flex items-center justify-center m-1 relative',
    inRange && !isStart && !isEnd ? 'bg-blue-200' : '',
    isStart && isEnd ? 'bg-blue-200 rounded-full' :
    isStart ? 'bg-blue-200 rounded-l-full' :
    isEnd   ? 'bg-blue-200 rounded-r-full' : '',
    avoided ? 'bg-red-100' : ''
  ].join(' ')

  return (
    <div
      className={baseClasses}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span className={`${(isStart||isEnd)?'text-white font-bold':''}`}>{day}</span>
      <div className="flex space-x-1 absolute bottom-1">
        {eventMap[day]?.liability    && <span className="w-2 h-2 bg-pink-200 rounded-full"/>}
        {eventMap[day]?.splitPayment && <span className="w-2 h-2 bg-purple-200 rounded-full"/>}
        {eventMap[day]?.income       && <span className="w-2 h-2 bg-green-200 rounded-full"/>}
        {eventMap[day]?.paymentPlan  && <span className="w-2 h-2 bg-purple-100 rounded-full"/>}
      </div>
    </div>
  )
}
