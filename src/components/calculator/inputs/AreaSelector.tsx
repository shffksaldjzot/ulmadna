'use client';

import { useState } from 'react';

const PRESET_AREAS = [18, 24, 30, 33, 34, 39, 43];

interface AreaSelectorProps {
  value: number;
  onChange: (area: number) => void;
}

export default function AreaSelector({ value, onChange }: AreaSelectorProps) {
  const [isCustom, setIsCustom] = useState(!PRESET_AREAS.includes(value));

  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">어떤 평형에 사시나요?</h3>
      <div className="flex flex-wrap gap-2">
        {PRESET_AREAS.map(area => (
          <button
            key={area}
            onClick={() => { setIsCustom(false); onChange(area); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${value === area && !isCustom
                ? 'bg-brown text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            {area}평
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
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
            min={5}
            max={80}
            value={value}
            onChange={e => {
              const v = parseInt(e.target.value) || 5;
              onChange(Math.min(80, Math.max(5, v)));
            }}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:border-gold focus:outline-none"
          />
          <span className="text-sm text-gray-500">평 (5~80)</span>
        </div>
      )}
    </div>
  );
}
