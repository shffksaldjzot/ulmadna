'use client';

import type { HousingType } from '@/types/calculator';

const OPTIONS: { value: HousingType; label: string; desc: string }[] = [
  { value: 'new', label: '신축 입주', desc: '새 아파트 입주' },
  { value: 'old20', label: '구축 리모델링', desc: '전면 리모델링' },
];

interface TypeSelectorProps {
  value: HousingType;
  onChange: (type: HousingType) => void;
}

export default function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">집 상태가 어떤가요?</h3>
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
