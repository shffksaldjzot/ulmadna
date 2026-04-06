'use client';

import type { HiddenCost } from '@/types/calculator';
import { formatWonExact } from '@/lib/format';

interface HiddenCostsProps {
  costs: HiddenCost[];
  warnings: string[];
}

export default function HiddenCosts({ costs, warnings }: HiddenCostsProps) {
  if (costs.length === 0 && warnings.length === 0) return null;

  const grandTotal = costs.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="bg-amber-50 border border-amber/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber text-sm">⚠️</span>
        <h3 className="text-sm font-bold text-brown">숨은 비용 알림</h3>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        이 견적에 포함되지 않은 추가 비용이 발생할 수 있습니다
      </p>

      {costs.map(cost => (
        <div key={cost.category} className="mb-3">
          <p className="text-xs font-semibold text-brown mb-1">[{cost.category}]</p>
          <div className="space-y-0.5 pl-2">
            {cost.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-600">{item.label}</span>
                <span className="text-gray-700 font-medium">{formatWonExact(item.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold text-brown pt-1 border-t border-amber/10">
              <span>소계</span>
              <span>{formatWonExact(cost.total)}</span>
            </div>
          </div>
        </div>
      ))}

      {grandTotal > 0 && (
        <div className="flex justify-between text-sm font-bold text-amber pt-2 border-t border-amber/20">
          <span>예상 추가비용 합계</span>
          <span>{formatWonExact(grandTotal)}</span>
        </div>
      )}

      {warnings.map((w, i) => (
        <p key={i} className="text-xs text-danger mt-2 bg-danger/5 rounded px-2 py-1.5">
          ⚠️ {w}
        </p>
      ))}
    </div>
  );
}
