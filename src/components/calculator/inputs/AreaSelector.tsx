'use client';

import { useState, useRef, useEffect } from 'react';

const PRESET_AREAS = [
  { pyeong: 18, sqm: 59, label: '18평', sub: '59㎡', badge: null },
  { pyeong: 24, sqm: 79, label: '24평', sub: '79㎡', badge: null },
  { pyeong: 25, sqm: 84, label: '25평', sub: '84㎡', badge: '국평' },
  { pyeong: 30, sqm: 99, label: '30평', sub: '99㎡', badge: null },
  { pyeong: 34, sqm: 114, label: '34평', sub: '114㎡', badge: null },
  { pyeong: 40, sqm: 132, label: '40평', sub: '132㎡', badge: null },
  { pyeong: 45, sqm: 151, label: '45평', sub: '151㎡', badge: null },
];

interface AreaSelectorProps {
  value: number;
  onChange: (area: number) => void;
}

export default function AreaSelector({ value, onChange }: AreaSelectorProps) {
  const isPreset = PRESET_AREAS.some(a => a.pyeong === value);
  const [editing, setEditing] = useState(false);
  const [customValue, setCustomValue] = useState(value > 0 && !isPreset ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleCustomSubmit = () => {
    const v = parseInt(customValue) || 0;
    if (v >= 10 && v <= 80) {
      onChange(v);
    }
    setEditing(false);
  };

  const showCustom = !isPreset && value > 0;

  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-2">어떤 평형에 사시나요?</h3>
      <div className="flex flex-wrap gap-2">
        {PRESET_AREAS.map(area => (
          <button
            key={area.pyeong}
            onClick={() => { setEditing(false); onChange(area.pyeong); }}
            className={`relative px-3 py-2 rounded-lg text-center transition-all min-w-[70px]
              ${value === area.pyeong && !editing
                ? 'bg-brown text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            {area.badge && (
              <span className="absolute -top-2 -right-1 bg-gold text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {area.badge}
              </span>
            )}
            <div className="text-sm font-medium">{area.label}</div>
            <div className={`text-[10px] ${value === area.pyeong && !editing ? 'text-cream/70' : 'text-gray-400'}`}>
              {area.sub}
            </div>
          </button>
        ))}

        {/* 직접입력: 인라인 변환 */}
        {editing ? (
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg border-2 border-gold bg-white min-w-[85px]">
            <input
              ref={inputRef}
              type="number"
              min={10}
              max={80}
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={handleCustomSubmit}
              className="w-12 text-sm font-medium text-brown text-center outline-none bg-transparent"
              placeholder="평"
            />
            <span className="text-xs text-gray-400">평</span>
          </div>
        ) : (
          <button
            onClick={() => { setEditing(true); setCustomValue(showCustom ? String(value) : ''); }}
            className={`px-3 py-2 rounded-lg text-center transition-all min-w-[70px]
              ${showCustom
                ? 'bg-brown text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gold'
              }`}
          >
            <div className="text-sm font-medium">{showCustom ? `${value}평` : '직접입력'}</div>
            {showCustom && (
              <div className="text-[10px] text-cream/70">≈{(value * 3.306).toFixed(0)}㎡</div>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
