'use client';

import { useState } from 'react';

const OPTIONS = [
  { value: 0.05, label: '5%', desc: '최소' },
  { value: 0.10, label: '10%', desc: '권장' },
  { value: 0.15, label: '15%', desc: '안전' },
];

interface ContingencySelectorProps {
  value: number;
  onChange: (rate: number) => void;
}

export default function ContingencySelector({ value, onChange }: ContingencySelectorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">예비비</span>
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] flex items-center justify-center hover:bg-gold hover:text-white transition-colors"
          >
            ?
          </button>
        </div>
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 text-xs rounded-full transition-all ${
              value === opt.value
                ? 'bg-brown text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showTooltip && (
        <div className="mt-2 bg-cream rounded-lg p-3 text-xs text-gray-500 leading-relaxed">
          <p className="font-medium text-brown mb-1">예비비가 왜 필요한가요?</p>
          <p>
            인테리어 공사는 벽을 열어봐야 알 수 있는 부분이 있어요.
            배관 상태, 누수, 석면, 구조 변경 등 예상치 못한 추가 비용이 거의 항상 발생합니다.
          </p>
          <p className="mt-1">
            <span className="text-brown">5%</span> — 신축이거나 변수가 적을 때<br/>
            <span className="text-brown">10%</span> — 일반적인 리모델링 (권장)<br/>
            <span className="text-brown">15%</span> — 구축 20년+ 또는 대규모 공사
          </p>
        </div>
      )}
    </div>
  );
}
