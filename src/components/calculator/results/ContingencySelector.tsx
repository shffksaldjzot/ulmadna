'use client';

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
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">예비비</span>
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
  );
}
