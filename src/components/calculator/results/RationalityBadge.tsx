'use client';

import type { RationalityResult } from '@/types/calculator';

const STYLES = {
  good: { bg: 'bg-green-50', border: 'border-safe', text: 'text-safe', label: '합리적' },
  normal: { bg: 'bg-amber-50', border: 'border-amber', text: 'text-amber', label: '적정' },
  high: { bg: 'bg-red-50', border: 'border-danger', text: 'text-danger', label: '다소 높음' },
};

interface RationalityBadgeProps {
  rationality: RationalityResult;
}

export default function RationalityBadge({ rationality }: RationalityBadgeProps) {
  const style = STYLES[rationality.level];

  return (
    <div className={`${style.bg} border ${style.border} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
          {style.label}
        </span>
        <span className="text-sm font-semibold text-gray-700">이 금액, 괜찮은 걸까요?</span>
      </div>
      <p className={`text-sm ${style.text}`}>{rationality.comment}</p>
    </div>
  );
}
