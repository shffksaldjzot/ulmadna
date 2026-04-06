'use client';

import type { Grade } from '@/types/calculator';

const OPTIONS: { value: Grade; label: string; desc: string; detail: string; examples: string }[] = [
  {
    value: 'basic',
    label: '기본 (가성비)',
    desc: '깔끔하게, 비용은 최소로',
    detail: '원룸·빌라·전세 단기 거주에 적합',
    examples: '합지벽지 · 장판 · 국산 보급형 도기',
  },
  {
    value: 'mid',
    label: '중급 (대중적)',
    desc: '대부분의 아파트가 이 정도 해요',
    detail: '30평대 아파트 표준 리모델링 수준',
    examples: '실크벽지 · 강마루 · 대림 도기 · 영림 도어',
  },
  {
    value: 'premium',
    label: '고급 (프리미엄)',
    desc: '인테리어 디자인 사무실 급',
    detail: '하이엔드 리모델링 · 수입 자재 · 브랜드',
    examples: '수입벽지 · 원목마루 · 아메리칸스탠다드 · LX',
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
            <div className={`text-xs mt-0.5 ${value === opt.value ? 'text-cream/80' : 'text-gray-500'}`}>
              {opt.desc}
            </div>
            <div className={`text-[10px] mt-0.5 ${value === opt.value ? 'text-gold' : 'text-gray-400'}`}>
              {opt.detail}
            </div>
            <div className={`text-[10px] mt-1 ${value === opt.value ? 'text-cream/60' : 'text-gray-300'}`}>
              {opt.examples}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
