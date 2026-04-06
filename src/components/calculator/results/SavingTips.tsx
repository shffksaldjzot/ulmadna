'use client';

import type { SavingTip } from '@/types/calculator';

interface SavingTipsProps {
  tips: SavingTip[];
}

export default function SavingTips({ tips }: SavingTipsProps) {
  if (tips.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">이렇게 하면 줄일 수 있어요</h3>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 bg-green-50 border border-safe/20 rounded-lg p-3">
            <span className="text-safe text-sm mt-0.5">&#10003;</span>
            <p className="text-sm text-gray-700">{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
