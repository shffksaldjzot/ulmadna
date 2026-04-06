'use client';

import { useState } from 'react';

// 국민평형 기준: 전용면적(㎡) → 평 환산
const PRESET_AREAS = [
  { pyeong: 18, sqm: 59, label: '18평', sub: '59㎡' },
  { pyeong: 24, sqm: 79, label: '24평', sub: '79㎡' },
  { pyeong: 25, sqm: 84, label: '25평', sub: '84㎡ 국평' },
  { pyeong: 30, sqm: 99, label: '30평', sub: '99㎡' },
  { pyeong: 34, sqm: 114, label: '34평', sub: '114㎡' },
  { pyeong: 40, sqm: 132, label: '40평', sub: '132㎡' },
  { pyeong: 45, sqm: 151, label: '45평', sub: '151㎡' },
];

interface AreaSelectorProps {
  value: number;
  onChange: (area: number) => void;
}

export default function AreaSelector({ value, onChange }: AreaSelectorProps) {
  const [isCustom, setIsCustom] = useState(
    !PRESET_AREAS.some(a => a.pyeong === value) && value > 0
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">어떤 평형에 사시나요?</h3>
      <div className="flex flex-wrap gap-2">
        {PRESET_AREAS.map(area => (
          <button
            key={area.pyeong}
            onClick={() => { setIsCustom(false); onChange(area.pyeong); }}
            className={`px-3 py-2 rounded-lg text-center transition-all min-w-[70px]
              ${value === area.pyeong && !isCustom
                ? 'bg-brown text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            <div className="text-sm font-medium">{area.label}</div>
            <div className={`text-[10px] ${value === area.pyeong && !isCustom ? 'text-cream/70' : 'text-gray-400'}`}>
              {area.sub}
            </div>
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all min-w-[70px]
            ${isCustom
              ? 'bg-brown text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
            }`}
        >
          직접입력
        </button>
      </div>
      {isCustom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={80}
            value={value || ''}
            onChange={e => {
              const v = parseInt(e.target.value) || 0;
              onChange(Math.min(80, Math.max(0, v)));
            }}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:border-gold focus:outline-none"
            placeholder="평"
          />
          <span className="text-sm text-gray-500">평 (10~80)</span>
          {value > 0 && (
            <span className="text-xs text-gray-400">≈ {Math.round(value * 3.3)}㎡</span>
          )}
        </div>
      )}
    </div>
  );
}
