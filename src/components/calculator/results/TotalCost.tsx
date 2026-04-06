'use client';

import { formatWon, formatPerPyeong, formatWonExact } from '@/lib/format';

interface TotalCostProps {
  total: number;
  perPyeong: number;
  subtotal: number;
  margin: number;
  marginRate: number;
  contingency: number;
  contingencyRate: number;
}

export default function TotalCost({ total, perPyeong, subtotal, margin, marginRate, contingency, contingencyRate }: TotalCostProps) {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-gray-500 mb-1">예상 견적이에요</p>
      <p className="text-4xl sm:text-5xl font-bold text-brown tracking-tight">
        {formatWon(total)}
      </p>
      <p className="text-lg text-gold font-semibold mt-1">
        평당 {formatPerPyeong(perPyeong)}
      </p>
      <div className="mt-3 text-xs text-gray-400 space-y-0.5">
        <p>
          공사비 {formatWonExact(subtotal)} + 이윤 {formatWonExact(margin)} ({Math.round(marginRate * 100)}%) + 예비비 {formatWonExact(contingency)} ({Math.round(contingencyRate * 100)}%)
        </p>
      </div>
    </div>
  );
}
