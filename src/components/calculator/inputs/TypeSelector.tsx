'use client';

import type { HousingType } from '@/types/calculator';

const OPTIONS: { value: HousingType; label: string; desc: string }[] = [
  { value: 'under10', label: '10년 미만', desc: '부분 교체 위주' },
  { value: 'ten20', label: '10~20년', desc: '주요 설비 교체' },
  { value: 'over20', label: '20년 이상', desc: '전면 리모델링' },
];

interface TypeSelectorProps {
  value: HousingType;
  onChange: (type: HousingType) => void;
}

export default function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">우리 집 연식이 어떻게 되나요?</h3>
      <div className="flex gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-4 py-3 rounded-lg text-left transition-all
              ${value === opt.value
                ? 'bg-brown text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            <div className="text-sm font-medium">{opt.label}</div>
            <div className={`text-xs mt-0.5 ${value === opt.value ? 'text-cream/80' : 'text-gray-400'}`}>
              {opt.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
