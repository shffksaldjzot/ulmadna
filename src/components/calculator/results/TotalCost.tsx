'use client';

import { formatWon, formatPerPyeong, formatWonExact } from '@/lib/format';

interface TotalCostProps {
  total: number;
  perPyeong: number;
  subtotal: number;
  contingency: number;
}

export default function TotalCost({ total, perPyeong, subtotal, contingency }: TotalCostProps) {
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
        <p>공사비 {formatWonExact(subtotal)} + 예비비 {formatWonExact(contingency)}</p>
        <p>예비비 15% 포함 금액이에요. 인테리어는 항상 예상보다 조금 더 들거든요.</p>
      </div>
    </div>
  );
}
