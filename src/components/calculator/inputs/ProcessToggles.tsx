'use client';

import { useState } from 'react';
import type { ProcessUserState, CalculatorOutput, Grade } from '@/types/calculator';
import { db } from '@/lib/calculator';
import { formatWonExact } from '@/lib/format';

/**
 * v3 공정별 Progressive Disclosure
 * - 공정 ON/OFF 토글 + 소계 표시
 * - 펼침 시: 등급 선택 칩 + 개소수 조절
 */

interface ProcessTogglesProps {
  processes: ProcessUserState[];
  output?: CalculatorOutput;
  grade: Grade;
  onToggle: (id: string) => void;
  onGradeChange: (processId: string, grade: string) => void;
  onCountChange: (processId: string, count: number) => void;
}

// DB 등급을 한글 레이블로
function gradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    basic: '보급', partial: '부분', mid_low: '중저', mid: '중급',
    mid_high: '중상', high: '고급', high_low: '중고급',
    premium: '프리미엄', full: '전체', room: '방', living: '거실', kitchen: '주방',
  };
  return labels[grade] || grade;
}

// 아이템 옵션에서 현재 등급에 맞는 옵션 찾기
function findItemOption(options: { grade: string; name: string; price?: number }[], selectedGrade: string): { name: string; price: number } | null {
  const exact = options.find(o => o.grade === selectedGrade);
  if (exact) return { name: exact.name, price: exact.price || 0 };
  // fallback: mid → basic 순
  const fallback = options.find(o => o.grade === 'mid') || options.find(o => o.grade === 'basic') || options[0];
  if (fallback) return { name: fallback.name, price: fallback.price || 0 };
  return null;
}

export default function ProcessToggles({ processes, output, grade, onToggle, onGradeChange, onCountChange }: ProcessTogglesProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailIds, setDetailIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {db.processes.map(dbProcess => {
        const ps = processes.find(p => p.id === dbProcess.id);
        if (!ps) return null;

        const isEnabled = ps.enabled;
        const isExpanded = expandedIds.has(dbProcess.id);
        const processResult = output?.processes.find(p => p.id === dbProcess.id);
        const amount = processResult?.amount || 0;

        // 사용 가능한 등급 옵션들
        const availableGrades = dbProcess.presets
          ? Object.keys(dbProcess.presets)
          : dbProcess.options
            ? [...new Set(dbProcess.options.map(o => o.grade))]
            : [];

        const isCountable = dbProcess.type === 'A_item' && dbProcess.unit;
        const unitLabel = dbProcess.unit || '개';

        return (
          <div
            key={dbProcess.id}
            className={`rounded-xl border transition-all ${
              isEnabled
                ? 'border-brown/15 bg-white shadow-sm'
                : 'border-gray-100 bg-gray-50/50'
            }`}
          >
            {/* 공정 헤더 */}
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => isEnabled && toggleExpand(dbProcess.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-brown' : 'bg-gray-300'}`} />
                <span className={`text-sm font-semibold ${isEnabled ? 'text-brown' : 'text-gray-400'}`}>
                  {dbProcess.name}
                </span>
                {isEnabled && isCountable && (
                  <span className="text-[11px] text-gold font-medium">
                    x{ps.count}{unitLabel}
                  </span>
                )}
                {isEnabled && availableGrades.length > 0 && (
                  <span className="text-[10px] text-gray-300">{isExpanded ? '▲' : '▼'}</span>
                )}
              </button>
              <div className="flex items-center gap-3">
                {isEnabled && amount > 0 && (
                  <span className="text-sm font-bold text-gold">{formatWonExact(amount)}</span>
                )}
                <button
                  onClick={() => {
                    onToggle(dbProcess.id);
                    if (!isEnabled) {
                      setExpandedIds(prev => new Set(prev).add(dbProcess.id));
                    }
                  }}
                  className={`w-9 h-5 rounded-full transition-colors ${isEnabled ? 'bg-brown' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${
                    isEnabled ? 'translate-x-4 ml-0.5' : 'ml-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* 펼침: 등급 선택 + 개소수 */}
            {isEnabled && isExpanded && (
              <div className="px-4 pb-3 border-t border-gray-50 pt-3 space-y-3">
                {/* 등급 선택 칩 */}
                {availableGrades.length > 1 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">등급 선택</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableGrades.map(g => {
                        const preset = dbProcess.presets?.[g];
                        const option = dbProcess.options?.find(o => o.grade === g);
                        const label = preset?.name || option?.name || gradeLabel(g);

                        return (
                          <button
                            key={g}
                            onClick={() => onGradeChange(dbProcess.id, g)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                              ps.selectedGrade === g
                                ? 'bg-brown text-white border-brown'
                                : 'bg-cream text-gray-600 border-gray-200 hover:border-gold'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 개소수 조절 (A타입) */}
                {isCountable && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{unitLabel} 수</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => ps.count > 0 && onCountChange(dbProcess.id, ps.count - 1)}
                        className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 text-sm flex items-center justify-center hover:border-gold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-brown">
                        {ps.count}
                      </span>
                      <button
                        onClick={() => onCountChange(dbProcess.id, ps.count + 1)}
                        className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 text-sm flex items-center justify-center hover:border-gold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* 선택된 옵션 정보 */}
                {processResult?.selectedOption && (
                  <p className="text-[11px] text-gray-400">
                    {processResult.selectedOption}
                  </p>
                )}

                {/* Level 3: 아이템 상세 아코디언 */}
                {dbProcess.items && dbProcess.items.length > 0 && (
                  <div>
                    <button
                      onClick={() => {
                        setDetailIds(prev => {
                          const next = new Set(prev);
                          if (next.has(dbProcess.id)) next.delete(dbProcess.id); else next.add(dbProcess.id);
                          return next;
                        });
                      }}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                        detailIds.has(dbProcess.id)
                          ? 'bg-gold/10 text-gold border border-gold/30'
                          : 'bg-cream text-brown/60 border border-brown/10 hover:border-gold/30 hover:text-gold'
                      }`}
                    >
                      {detailIds.has(dbProcess.id) ? '상세 접기 ▲' : `상세 보기 ▼ (${dbProcess.items.length}개 항목)`}
                    </button>

                    {detailIds.has(dbProcess.id) && (
                      <div className="mt-2 pl-2 border-l-2 border-gold/20 space-y-1.5">
                        {dbProcess.items.map(item => {
                          const selectedOpt = item.options
                            ? findItemOption(item.options, ps.selectedGrade)
                            : null;

                          return (
                            <div key={item.id} className="flex items-center justify-between py-1">
                              <div>
                                <span className="text-[11px] text-gray-600">{item.name}</span>
                                {selectedOpt && (
                                  <span className="text-[10px] text-gray-400 ml-1">
                                    ({selectedOpt.name})
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-medium text-brown">
                                {((selectedOpt?.price || item.price || 0) / 10000).toFixed(item.price && item.price < 10000 ? 1 : 0)}만
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
