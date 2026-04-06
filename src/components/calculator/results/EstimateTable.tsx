'use client';

import type { ProcessResult } from '@/types/calculator';
import { formatWonExact, formatPercent } from '@/lib/format';

interface EstimateTableProps {
  processes: ProcessResult[];
}

export default function EstimateTable({ processes }: EstimateTableProps) {
  const maxAmount = processes.length > 0 ? processes[0].amount : 1;

  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-3">돈이 어디에 가장 많이 갈까요?</h3>
      <div className="space-y-2">
        {processes.map(p => (
          <div key={p.id} className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{p.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-brown">{formatWonExact(p.amount)}</span>
                <span className="text-xs text-gray-400 ml-1">{formatPercent(p.percentage)}</span>
              </div>
            </div>
            {/* 수평 바 */}
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-gold rounded-full h-1.5 transition-all duration-300"
                style={{ width: `${(p.amount / maxAmount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
