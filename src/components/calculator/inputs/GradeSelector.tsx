'use client';

import type { Grade } from '@/types/calculator';

const OPTIONS: { value: Grade; label: string; desc: string; priceRange: string; examples: string }[] = [
  {
    value: 'basic',
    label: '기본 (가성비)',
    desc: '깔끔하게, 비용은 최소로',
    priceRange: '평당 60~120만원',
    examples: '합지벽지 · 장판 · 국산 보급형 도기',
  },
  {
    value: 'mid',
    label: '중급 (대중적)',
    desc: '대부분의 아파트가 이 정도 해요',
    priceRange: '평당 100~180만원',
    examples: '실크벽지 · 강마루 · 대림 도기',
  },
  {
    value: 'premium',
    label: '고급 (프리미엄)',
    desc: '인테리어 디자인 사무실 급',
    priceRange: '평당 150~300만원',
    examples: '수입벽지 · 원목마루 · 아메리칸스탠다드',
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
                ? 'bg-brown text-white shadow-md ring-2 ring-gold/40'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className={`text-xs font-medium ${value === opt.value ? 'text-gold' : 'text-gold/70'}`}>
                {opt.priceRange}
              </span>
            </div>
            <div className={`text-xs mt-0.5 ${value === opt.value ? 'text-cream/80' : 'text-gray-500'}`}>
              {opt.desc}
            </div>
            <div className={`text-xs mt-1 ${value === opt.value ? 'text-cream/60' : 'text-gray-400'}`}>
              {opt.examples}
            </div>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
        등급을 선택하면 모든 공정의 기본 자재가 설정됩니다. 공정별로 개별 변경도 가능해요.
      </p>
    </div>
  );
}
