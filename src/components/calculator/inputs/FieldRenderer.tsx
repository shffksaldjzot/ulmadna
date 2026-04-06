'use client';

import type { ProcessField, FieldValue, Grade } from '@/types/calculator';

interface FieldRendererProps {
  field: ProcessField;
  value: FieldValue | undefined;
  grade: Grade;
  onChange: (fieldId: string, value: string | number | boolean) => void;
}

/**
 * JSON 필드 정의에 따라 적절한 입력 UI를 렌더링
 * radio → 칩 버튼, toggle → 스위치, stepper → +/- 또는 드롭다운, checkbox → 체크박스
 */
export default function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  const currentValue = value?.value;

  switch (field.input) {
    case 'radio':
      return (
        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-1.5">{field.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {field.options?.map(opt => (
              <button
                key={opt.id}
                onClick={() => onChange(field.id, opt.id)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                  currentValue === opt.id
                    ? 'bg-brown text-white border-brown'
                    : 'bg-cream text-gray-600 border-gray-200 hover:border-gold'
                }`}
              >
                {opt.label}
                {opt.price > 0 && (
                  <span className="ml-1 opacity-70">
                    {opt.price >= 10000
                      ? `${(opt.price / 10000).toFixed(0)}만`
                      : `${opt.price.toLocaleString()}`}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      );

    case 'toggle':
      return (
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{field.label}</span>
            {field.price && field.price > 0 && (
              <span className="text-[10px] text-gray-300">
                {(field.price / 10000).toFixed(0)}만
              </span>
            )}
          </div>
          <button
            onClick={() => onChange(field.id, !currentValue)}
            className={`w-9 h-5 rounded-full transition-colors ${
              currentValue ? 'bg-brown' : 'bg-gray-300'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${
              currentValue ? 'translate-x-4 ml-0.5' : 'ml-0.5'
            }`} />
          </button>
        </div>
      );

    case 'stepper':
      return (
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{field.label}</span>
            {field.price && field.price > 0 && (
              <span className="text-[10px] text-gray-300">
                {(field.price / 10000).toFixed(0)}만/개
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const cur = typeof currentValue === 'number' ? currentValue : field.default || 0;
                if (cur > (field.min ?? 0)) onChange(field.id, cur - 1);
              }}
              className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 text-sm flex items-center justify-center hover:border-gold"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium text-brown">
              {typeof currentValue === 'number' ? currentValue : field.default || 0}
            </span>
            <button
              onClick={() => {
                const cur = typeof currentValue === 'number' ? currentValue : field.default || 0;
                if (cur < (field.max ?? 99)) onChange(field.id, cur + 1);
              }}
              className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 text-sm flex items-center justify-center hover:border-gold"
            >
              +
            </button>
          </div>
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{field.label}</span>
            {field.price && field.price > 0 && (
              <span className="text-[10px] text-gray-300">
                {(field.price / 10000).toFixed(0)}만
              </span>
            )}
          </div>
          <button
            onClick={() => onChange(field.id, !currentValue)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              currentValue
                ? 'bg-brown border-brown text-white'
                : 'border-gray-300 hover:border-gold'
            }`}
          >
            {currentValue && <span className="text-[10px]">✓</span>}
          </button>
        </div>
      );

    default:
      return null;
  }
}
