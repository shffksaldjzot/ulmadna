'use client';

import { useState } from 'react';
import type { ProcessState, CalculatorOutput, Grade } from '@/types/calculator';
import { ALL_PROCESSES } from '@/lib/calculator';
import { formatWonExact } from '@/lib/format';
import FieldRenderer from './FieldRenderer';

/**
 * v2 공정별 3단 Progressive Disclosure
 * - 공정 ON/OFF 토글 + 소계 표시
 * - Level 2: 핵심 옵션 2~4개 (탭하면 펼침)
 * - Level 3: "상세설정" 버튼 → 브랜드/모델/세부옵션
 */

interface ProcessTogglesProps {
  processes: ProcessState[];
  output?: CalculatorOutput;
  grade: Grade;
  onToggle: (id: string) => void;
  onFieldChange: (processId: string, fieldId: string, value: string | number | boolean) => void;
}

export default function ProcessToggles({ processes, output, grade, onToggle, onFieldChange }: ProcessTogglesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDetailId, setShowDetailId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {ALL_PROCESSES.map(pd => {
        const ps = processes.find(p => p.id === pd.id);
        if (!ps) return null;

        const isEnabled = ps.enabled;
        const isExpanded = expandedId === pd.id;
        const showDetail = showDetailId === pd.id;
        const processResult = output?.processes.find(p => p.id === pd.id);
        const amount = processResult?.amount || 0;

        const level2Fields = pd.fields.filter(f => f.level === 2);
        const level3Fields = pd.fields.filter(f => f.level === 3);

        return (
          <div
            key={pd.id}
            className={`rounded-xl border transition-all ${
              isEnabled
                ? 'border-brown/15 bg-white shadow-sm'
                : 'border-gray-100 bg-gray-50/50'
            }`}
          >
            {/* 공정 헤더 */}
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => isEnabled && setExpandedId(isExpanded ? null : pd.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-brown' : 'bg-gray-300'}`} />
                <span className={`text-sm font-semibold ${isEnabled ? 'text-brown' : 'text-gray-400'}`}>
                  {pd.name}
                </span>
                {isEnabled && level2Fields.length > 0 && (
                  <span className="text-[10px] text-gray-300">{isExpanded ? '▲' : '▼'}</span>
                )}
              </button>
              <div className="flex items-center gap-3">
                {isEnabled && amount > 0 && (
                  <span className="text-sm font-bold text-gold">{formatWonExact(amount)}</span>
                )}
                <button
                  onClick={() => onToggle(pd.id)}
                  className={`w-9 h-5 rounded-full transition-colors ${isEnabled ? 'bg-brown' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${
                    isEnabled ? 'translate-x-4 ml-0.5' : 'ml-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* 2단계: 핵심 옵션 (공정 펼침 시) */}
            {isEnabled && isExpanded && level2Fields.length > 0 && (
              <div className="px-4 pb-3 border-t border-gray-50 pt-3">
                {level2Fields.map(field => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={ps.fields[field.id]}
                    grade={grade}
                    onChange={(fieldId, value) => onFieldChange(pd.id, fieldId, value)}
                  />
                ))}

                {/* 3단계: 상세설정 버튼 */}
                {level3Fields.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowDetailId(showDetail ? null : pd.id)}
                      className="text-[11px] text-gold hover:text-brown transition-colors"
                    >
                      {showDetail ? '상세설정 접기 ▲' : `상세설정 ▸ (${level3Fields.length}개 항목)`}
                    </button>

                    {showDetail && (
                      <div className="mt-2 pl-2 border-l-2 border-gold/20 space-y-0.5">
                        {level3Fields.map(field => (
                          <FieldRenderer
                            key={field.id}
                            field={field}
                            value={ps.fields[field.id]}
                            grade={grade}
                            onChange={(fieldId, value) => onFieldChange(pd.id, fieldId, value)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 경고 표시 */}
            {isEnabled && pd.fields.some(f => f.warning) && (
              <div className="px-4 pb-2">
                {pd.fields
                  .filter(f => f.warning && ps.fields[f.id]?.value === 0)
                  .map(f => (
                    <p key={f.id} className="text-[11px] text-danger bg-danger/5 rounded px-2 py-1">
                      ⚠️ {f.warning}
                    </p>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
