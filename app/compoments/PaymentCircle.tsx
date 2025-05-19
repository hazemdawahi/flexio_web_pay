// app/components/PaymentCircle.tsx
import React from 'react';

interface PaymentCircleProps {
  day: number;
  month: string;
  percentage: number;
  amount: string;
}

const PaymentCircle: React.FC<PaymentCircleProps> = ({ day, month, percentage, amount }) => {
  const radius = 30; // Radius of the circle
  const strokeWidth = 8; // Thickness of the circle border
  const circumference = 2 * Math.PI * radius; // Full circumference
  const progress = (percentage / 100) * circumference; // Calculate progress

  return (
    <div className="flex flex-col items-center mx-2">
      <svg width="80" height="80" className="relative">
        {/* Background Circle */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#E0E0E0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress Circle */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#00BFFF"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        {/* Inner Circle */}
        <foreignObject x="10" y="10" width="60" height="60">
          <div className="flex items-center justify-center h-full">
            <span className="text-lg font-bold text-black">{day}</span>
          </div>
        </foreignObject>
      </svg>
      <span className="mt-2 text-sm font-bold text-black">{month}</span>
      <span className="mt-1 text-xs text-gray-500">${amount}</span>
    </div>
  );
};

export default PaymentCircle;
