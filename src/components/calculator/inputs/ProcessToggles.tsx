'use client';

import { useState } from 'react';
import type { ProcessUserState, CalculatorOutput, Grade, DBProcess } from '@/types/calculator';
import { db } from '@/lib/calculator';
import { formatWonExact } from '@/lib/format';

const PROCESS_GROUPS: { label: string; ids: string[] }[] = [
  { label: '철거·기초', ids: ['demolition'] },
  { label: '도배·바닥', ids: ['wallpaper', 'flooring'] },
  { label: '욕실', ids: ['bathroom'] },
  { label: '주방', ids: ['kitchen'] },
  { label: '창호', ids: ['window'] },
  { label: '목공', ids: ['door', 'entrance_door', 'molding', 'art_wall', 'ceiling_work'] },
  { label: '전기·조명', ids: ['electrical', 'lighting'] },
  { label: '도장·필름', ids: ['painting', 'film'] },
  { label: '타일', ids: ['tile'] },
  { label: '가구', ids: ['furniture'] },
  { label: '에어컨', ids: ['aircon'] },
  { label: '기타', ids: ['expansion', 'plumbing', 'misc'] },
];

interface ProcessTogglesProps {
  processes: ProcessUserState[];
  output?: CalculatorOutput;
  grade: Grade;
  onToggle: (id: string) => void;
  onGradeChange: (processId: string, grade: string) => void;
  onCountChange: (processId: string, count: number) => void;
}

function gradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    basic: '보급', partial: '부분', mid_low: '중저', mid: '중급',
    mid_high: '중상', high: '고급', high_low: '중고급',
    premium: '프리미엄', full: '전체', room: '방', living: '거실', kitchen: '주방',
  };
  return labels[grade] || grade;
}

function findItemOption(options: { grade: string; name: string; price?: number }[], selectedGrade: string) {
  const exact = options.find(o => o.grade === selectedGrade);
  if (exact) return { name: exact.name, price: exact.price || 0 };
  const fallback = options.find(o => o.grade === 'mid') || options.find(o => o.grade === 'basic') || options[0];
  if (fallback) return { name: fallback.name, price: fallback.price || 0 };
  return null;
}

// 개소수 표시 텍스트
function countDisplay(count: number, unit: string | undefined): string {
  if (!unit) return `${count}개`;
  // "1식" 같은 단위는 개수 표시 안 함
  if (unit === '1식') return '1식';
  return `${count}${unit}`;
}

export default function ProcessToggles({ processes, output, grade, onToggle, onGradeChange, onCountChange }: ProcessTogglesProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const availableGrades = (dbProcess: DBProcess) => {
    if (dbProcess.presets) return Object.keys(dbProcess.presets);
    if (dbProcess.options) return [...new Set(dbProcess.options.map(o => o.grade))];
    return [];
  };

  return (
    <div className="space-y-6">
      {PROCESS_GROUPS.map(group => {
        const groupProcesses = group.ids
          .map(id => db.processes.find(p => p.id === id))
          .filter(Boolean) as DBProcess[];

        if (groupProcesses.length === 0) return null;

        return (
          <div key={group.label}>
            <p className="text-[10px] text-gold tracking-widest font-medium mb-2 px-1">{group.label}</p>
            <div className="space-y-2">
              {groupProcesses.map(dbProcess => {
                const ps = processes.find(p => p.id === dbProcess.id);
                if (!ps) return null;

                const isEnabled = ps.enabled;
                const isExpanded = expandedIds.has(dbProcess.id);
                const processResult = output?.processes.find(p => p.id === dbProcess.id);
                const amount = processResult?.amount || 0;
                const grades = availableGrades(dbProcess);
                const isCountable = dbProcess.type === 'A_item' && dbProcess.unit && dbProcess.unit !== '1식';

                return (
                  <div
                    key={dbProcess.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isEnabled
                        ? 'border-brown/15 bg-white shadow-sm'
                        : 'border-gray-100 bg-gray-50/50'
                    }`}
                  >
                    {/* 헤더: 이름 + 금액 + 토글 */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <button
                        onClick={() => isEnabled && toggleExpand(dbProcess.id)}
                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isEnabled ? 'bg-brown' : 'bg-gray-300'}`} />
                        <span className={`text-sm font-semibold truncate ${isEnabled ? 'text-brown' : 'text-gray-400'}`}>
                          {dbProcess.name}
                        </span>
                        {isEnabled && (
                          <span className="text-[10px] text-gray-300 flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                        )}
                      </button>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {isEnabled && amount > 0 && (
                          <span className="text-sm font-bold text-gold">{formatWonExact(amount)}</span>
                        )}
                        <button
                          onClick={() => {
                            onToggle(dbProcess.id);
                            if (!isEnabled) setExpandedIds(prev => new Set(prev).add(dbProcess.id));
                          }}
                          className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isEnabled ? 'bg-brown' : 'bg-gray-300'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${
                            isEnabled ? 'translate-x-4 ml-0.5' : 'ml-0.5'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* 통합 아코디언: 등급 + 개소수 + 상세 */}
                    {isEnabled && isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3 overflow-hidden">

                        {/* 등급 선택 — 왼쪽 정렬 */}
                        {grades.length > 1 && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">등급</p>
                            <div className="flex flex-wrap gap-1.5">
                              {grades.map(g => (
                                <button
                                  key={g}
                                  onClick={() => onGradeChange(dbProcess.id, g)}
                                  className={`px-2.5 py-1 text-[11px] rounded-full border transition-all ${
                                    ps.selectedGrade === g
                                      ? 'bg-brown text-white border-brown'
                                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gold'
                                  }`}
                                >
                                  {gradeLabel(g)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 개소수 조절 */}
                        {isCountable && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">{dbProcess.unit || '개'} 수</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => ps.count > 0 && onCountChange(dbProcess.id, ps.count - 1)}
                                className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 text-sm flex items-center justify-center hover:border-gold"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-sm font-medium text-brown">{ps.count}</span>
                              <button
                                onClick={() => onCountChange(dbProcess.id, ps.count + 1)}
                                className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 text-sm flex items-center justify-center hover:border-gold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 선택된 옵션명 */}
                        {processResult?.selectedOption && (
                          <p className="text-[10px] text-gray-400 truncate">{processResult.selectedOption}</p>
                        )}

                        {/* 아이템 상세 */}
                        {dbProcess.items && dbProcess.items.length > 0 && (
                          <div className="border-t border-gray-50 pt-2">
                            <p className="text-[10px] text-gray-400 mb-1.5">구성 항목</p>
                            <div className="space-y-1">
                              {dbProcess.items.map(item => {
                                const opt = item.options ? findItemOption(item.options, ps.selectedGrade) : null;
                                const price = opt?.price || item.price || 0;
                                return (
                                  <div key={item.id} className="flex items-center justify-between py-0.5">
                                    <span className="text-[11px] text-gray-600 truncate mr-2">
                                      {item.name}
                                      {opt && <span className="text-gray-400"> · {opt.name}</span>}
                                    </span>
                                    <span className="text-[11px] font-medium text-brown flex-shrink-0">
                                      {price >= 10000
                                        ? `${(price / 10000).toFixed(price < 100000 ? 1 : 0)}만`
                                        : `${price.toLocaleString()}`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
