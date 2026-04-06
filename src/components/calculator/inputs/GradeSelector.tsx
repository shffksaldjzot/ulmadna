'use client';

import type { Grade } from '@/types/calculator';

const OPTIONS: { value: Grade; label: string; desc: string; examples: string }[] = [
  {
    value: 'basic',
    label: '기본 (가성비)',
    desc: '가성비 있게 · 깔끔하면 충분해요',
    examples: '합지벽지, 장판, 국산 세라믹',
  },
  {
    value: 'mid',
    label: '중급 (대중적)',
    desc: '적당히 좋은 걸로 · 대부분 이 정도 해요',
    examples: '실크벽지, 강마루, 포세린 타일',
  },
  {
    value: 'premium',
    label: '고급 (프리미엄)',
    desc: '제대로 한 번 · 오래 살 집이니까요',
    examples: '수입벽지, 원목마루, 수입 포세린',
  },
];

interface GradeSelectorProps {
  value: Grade;
  onChange: (grade: Grade) => void;
}

export default function GradeSelector({ value, onChange }: GradeSelectorProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">어떤 느낌으로 하고 싶으세요?</h3>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full px-4 py-3 rounded-lg text-left transition-all
              ${value === opt.value
                ? 'bg-brown text-white shadow-md ring-2 ring-gold'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            <div className="text-sm font-semibold">{opt.label}</div>
            <div className={`text-xs mt-0.5 ${value === opt.value ? 'text-cream/80' : 'text-gray-400'}`}>
              {opt.desc}
            </div>
            <div className={`text-xs mt-1 ${value === opt.value ? 'text-gold' : 'text-gray-300'}`}>
              {opt.examples}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
