'use client';

import type { Region } from '@/types/calculator';

const OPTIONS: { value: Region; label: string; areas: string }[] = [
  { value: 'seoul', label: '서울', areas: '서울특별시' },
  { value: 'gyeonggi', label: '수도권', areas: '경기도 · 인천' },
  { value: 'metro', label: '광역시', areas: '부산 · 대구 · 광주 · 대전 · 울산 · 세종' },
  { value: 'others', label: '기타 지방', areas: '강원 · 충북 · 충남 · 전북 · 전남 · 경북 · 경남 · 제주' },
];

interface RegionSelectorProps {
  value: Region;
  onChange: (region: Region) => void;
}

export default function RegionSelector({ value, onChange }: RegionSelectorProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">어디에 사시나요?</h3>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-2.5 rounded-lg text-left transition-all
              ${value === opt.value
                ? 'bg-brown text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            <div className="text-sm font-medium">{opt.label}</div>
            <div className={`text-[10px] mt-0.5 ${value === opt.value ? 'text-cream/70' : 'text-gray-400'}`}>
              {opt.areas}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
