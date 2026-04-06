'use client';

import type { Region } from '@/types/calculator';

const OPTIONS: { value: Region; label: string }[] = [
  { value: 'seoul', label: '서울' },
  { value: 'gyeonggi', label: '경기·인천' },
  { value: 'metro', label: '지방광역시' },
  { value: 'others', label: '기타 지방' },
];

interface RegionSelectorProps {
  value: Region;
  onChange: (region: Region) => void;
}

export default function RegionSelector({ value, onChange }: RegionSelectorProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">어디에 사시나요?</h3>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${value === opt.value
                ? 'bg-brown text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
