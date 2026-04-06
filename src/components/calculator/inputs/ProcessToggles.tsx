'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import type { ProcessUserState, CalculatorOutput, CalculatorAction, DBProcess, DBOption, DBItem } from '@/types/calculator';
import { db } from '@/lib/calculator';
import { formatWonExact } from '@/lib/format';

// ─── 공정 순서 (시공 순서 기준) ───
const PROCESS_GROUPS: { label: string; ids: string[] }[] = [
  { label: '철거', ids: ['demolition'] },
  { label: '확장·설비', ids: ['expansion', 'plumbing'] },
  { label: '전기·조명', ids: ['electrical', 'lighting'] },
  { label: '에어컨', ids: ['aircon'] },
  { label: '목공', ids: ['door', 'entrance_door', 'molding', 'art_wall', 'ceiling_work'] },
  { label: '창호', ids: ['window'] },
  { label: '도배·바닥', ids: ['wallpaper', 'flooring'] },
  { label: '도장·필름', ids: ['painting', 'film'] },
  { label: '타일', ids: ['tile'] },
  { label: '욕실', ids: ['bathroom'] },
  { label: '주방', ids: ['kitchen'] },
  { label: '가구', ids: ['furniture'] },
  { label: '부대비용', ids: ['misc'] },
];

// ─── 가격 포맷 ───
function fmtPrice(price: number): string {
  if (price === 0) return '0';
  if (price >= 10000) {
    const man = price / 10000;
    return `${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}만`;
  }
  return `${price.toLocaleString()}원`;
}

function fmtPriceUnit(opt: DBOption): string {
  if (opt.price_per_pyeong) return `${fmtPrice(opt.price_per_pyeong)}/평`;
  if (opt.price_per_m) return `${fmtPrice(opt.price_per_m)}/m`;
  if (opt.price_per_ja) return `${fmtPrice(opt.price_per_ja)}/자`;
  if (opt.price !== undefined) return fmtPrice(opt.price);
  return '';
}

interface Props {
  processes: ProcessUserState[];
  output?: CalculatorOutput;
  dispatch: React.Dispatch<CalculatorAction>;
}

// ═══════════════════════════════════════
// 라디오 칩 (2~4개 선택지)
// ═══════════════════════════════════════
function RadioChips({ options, selected, onChange, label }: {
  options: DBOption[]; selected: string; onChange: (g: string) => void; label?: string;
}) {
  return (
    <div className="mb-2">
      {label && <p className="text-[11px] text-gray-500 mb-1.5">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt.grade}
            onClick={() => onChange(opt.grade)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
              selected === opt.grade
                ? 'bg-brown text-white border-brown'
                : 'bg-cream text-gray-600 border-gray-200 hover:border-gold'
            }`}
          >
            {opt.name}
            <span className="ml-1 opacity-70">{fmtPriceUnit(opt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 토글 스위치
// ═══════════════════════════════════════
function Toggle({ checked, onChange, label, price }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; price?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] ${checked ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
        {price && <span className="text-[10px] text-gray-300">{price}</span>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-8 h-[18px] rounded-full flex-shrink-0 ${checked ? 'bg-brown' : 'bg-gray-300'}`}
      >
        <div className={`w-3.5 h-3.5 bg-white rounded-full shadow mt-[1px] transition-transform ${
          checked ? 'translate-x-[15px] ml-0.5' : 'ml-[2px]'
        }`} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
// 스텝퍼
// ═══════════════════════════════════════
function Stepper({ value, onChange, label, unit, min = 0 }: {
  value: number; onChange: (v: number) => void; label: string; unit?: string; min?: number;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => value > min && onChange(value - 1)}
          className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 text-xs flex items-center justify-center hover:border-gold">-</button>
        <span className="w-8 text-center text-xs font-medium text-brown">{value}{unit || ''}</span>
        <button onClick={() => onChange(value + 1)}
          className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 text-xs flex items-center justify-center hover:border-gold">+</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 세로 라디오 리스트 (5개 이상 또는 긴 옵션명)
// ═══════════════════════════════════════
function RadioList({ options, selected, onChange, label }: {
  options: DBOption[]; selected: string; onChange: (g: string) => void; label?: string;
}) {
  return (
    <div className="mb-2">
      {label && <p className="text-[11px] text-gray-500 mb-1.5">{label}</p>}
      <div className="flex flex-col gap-1">
        {options.map(opt => (
          <button
            key={opt.grade}
            onClick={() => onChange(opt.grade)}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg border transition-all ${
              selected === opt.grade
                ? 'bg-brown/5 border-brown/30 text-brown font-medium'
                : 'bg-white border-gray-100 text-gray-600 hover:border-gold/50'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              selected === opt.grade ? 'border-brown' : 'border-gray-300'
            }`}>
              {selected === opt.grade && <span className="w-1.5 h-1.5 rounded-full bg-brown" />}
            </span>
            <span>{opt.name}</span>
            <span className="ml-auto opacity-60 flex-shrink-0">{fmtPriceUnit(opt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 숫자 입력 (m, 자)
// ═══════════════════════════════════════
function DimInput({ value, onChange, label, unit }: {
  value: number; onChange: (v: number) => void; label: string; unit: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" value={value} step={unit === 'm' ? 0.1 : 1} min={0}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onChange(v); }}
          className="w-14 px-2 py-1 text-xs text-right rounded border border-gray-200 focus:border-gold outline-none text-brown font-medium"
        />
        <span className="text-[10px] text-gray-400">{unit}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 옵션 자동 선택: 가로 칩 vs 세로 리스트
// ═══════════════════════════════════════
function OptionSelector({ options, selected, onChange, label }: {
  options: DBOption[]; selected: string; onChange: (g: string) => void; label?: string;
}) {
  // 옵션명이 15자 이상이면 세로 리스트
  const hasLongName = options.some(o => o.name.length > 15);
  // 5개 이상이거나 긴 이름이 있으면 세로 리스트
  if (options.length >= 5 || hasLongName) {
    return <RadioList options={options} selected={selected} onChange={onChange} label={label} />;
  }
  return <RadioChips options={options} selected={selected} onChange={onChange} label={label} />;
}

// ═══════════════════════════════════════
// 아이템 렌더링 (자동 판단)
// ═══════════════════════════════════════
function ItemRenderer({ item, ps, processId, dispatch }: {
  item: DBItem; ps: ProcessUserState; processId: string; dispatch: React.Dispatch<CalculatorAction>;
}) {
  // 옵션 있는 아이템 → 라디오 or 드롭다운
  if (item.options && item.options.length > 0) {
    const selected = ps.itemSelections[item.id] || item.options[0].grade;
    const selectedOpt = item.options.find(o => o.grade === selected) || item.options[0];
    const needsM = selectedOpt?.price_per_m !== undefined;
    const needsJa = selectedOpt?.price_per_ja !== undefined;

    return (
      <div>
        <OptionSelector
          options={item.options}
          selected={selected}
          onChange={g => dispatch({ type: 'SET_ITEM_SELECTION', payload: { processId, itemId: item.id, grade: g } })}
          label={item.name}
        />
        {needsM && (
          <DimInput label="길이" unit="m"
            value={ps.dimensions[item.id === 'sink_cabinet' || item.id === 'countertop' ? 'sink_length' : `${item.id}_length`] || 3.5}
            onChange={v => dispatch({ type: 'SET_DIMENSION', payload: { processId, key: item.id === 'sink_cabinet' || item.id === 'countertop' ? 'sink_length' : `${item.id}_length`, value: v } })}
          />
        )}
        {needsJa && (
          <DimInput label="크기" unit="자"
            value={ps.dimensions[`${item.id}_ja`] || 12}
            onChange={v => dispatch({ type: 'SET_DIMENSION', payload: { processId, key: `${item.id}_ja`, value: v } })}
          />
        )}
      </div>
    );
  }

  // 수량 아이템 (EA, M) → 토글 + 스텝퍼
  if (item.price !== undefined && (item.unit === 'EA' || item.unit === 'M')) {
    const on = ps.itemToggles[item.id] !== false;
    return (
      <div>
        <Toggle checked={on} label={item.name} price={`${fmtPrice(item.price)}/${item.unit}`}
          onChange={v => dispatch({ type: 'SET_ITEM_TOGGLE', payload: { processId, itemId: item.id, enabled: v } })} />
        {on && (
          <Stepper label="수량" unit={item.unit} value={ps.itemCounts[item.id] || 0}
            onChange={v => dispatch({ type: 'SET_ITEM_COUNT', payload: { processId, itemId: item.id, count: v } })} />
        )}
      </div>
    );
  }

  // 단가 고정 아이템 → 토글
  if (item.price !== undefined) {
    const on = ps.itemToggles[item.id] !== false;
    return (
      <Toggle checked={on} label={item.name} price={fmtPrice(item.price)}
        onChange={v => dispatch({ type: 'SET_ITEM_TOGGLE', payload: { processId, itemId: item.id, enabled: v } })} />
    );
  }

  return null;
}

// ═══════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════
const ProcessToggles = forwardRef<{ expandAll: () => void; collapseAll: () => void }, Props>(
  function ProcessToggles({ processes, output, dispatch }, ref) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const allProcessIds = db.processes.map(p => p.id);

  useImperativeHandle(ref, () => ({
    expandAll: () => setExpandedIds(new Set(allProcessIds)),
    collapseAll: () => setExpandedIds(new Set()),
  }));

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
              {groupProcesses.map(proc => {
                const ps = processes.find(p => p.id === proc.id);
                if (!ps) return null;

                const on = ps.enabled;
                const open = expandedIds.has(proc.id);
                const result = output?.processes.find(p => p.id === proc.id);
                const amt = result?.amount || 0;
                const isCountable = proc.type === 'A_item' && proc.unit && proc.unit !== '1식';

                return (
                  <div key={proc.id} className={`rounded-xl border overflow-hidden transition-all ${
                    on ? 'border-brown/15 bg-white shadow-sm' : 'border-gray-100 bg-gray-50/50'
                  }`}>
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <button onClick={() => on && toggle(proc.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${on ? 'bg-brown' : 'bg-gray-300'}`} />
                        <span className={`text-sm font-semibold truncate ${on ? 'text-brown' : 'text-gray-400'}`}>{proc.name}</span>
                        {on && <span className="text-[10px] text-gray-300 flex-shrink-0">{open ? '▲' : '▼'}</span>}
                      </button>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {on && amt > 0 && <span className="text-sm font-bold text-gold">{formatWonExact(amt)}</span>}
                        <button
                          onClick={() => { dispatch({ type: 'TOGGLE_PROCESS', payload: proc.id }); if (!on) setExpandedIds(prev => new Set(prev).add(proc.id)); }}
                          className={`w-9 h-5 rounded-full ${on ? 'bg-brown' : 'bg-gray-300'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${on ? 'translate-x-4 ml-0.5' : 'ml-0.5'}`} />
                        </button>
                      </div>
                    </div>

                    {/* 펼침 내용 */}
                    {on && open && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2 overflow-hidden">

                        {/* 공정 수량 (욕실 2개소, 방문 5조 등) */}
                        {isCountable && (
                          <Stepper label={`${proc.unit} 수`} value={ps.count}
                            onChange={v => dispatch({ type: 'SET_PROCESS_COUNT', payload: { processId: proc.id, count: v } })} />
                        )}

                        {/* B_area 공정: 자재 선택 */}
                        {proc.options && proc.options.length > 0 && (
                          <OptionSelector
                            options={proc.options}
                            selected={ps.itemSelections['__process__'] || proc.options[0].grade}
                            onChange={g => dispatch({ type: 'SET_ITEM_SELECTION', payload: { processId: proc.id, itemId: '__process__', grade: g } })}
                          />
                        )}

                        {/* 도배: 천정 포함 */}
                        {proc.id === 'wallpaper' && (
                          <Toggle checked={ps.ceilingIncluded || false} label="천정 도배 포함"
                            onChange={v => dispatch({ type: 'SET_CEILING_INCLUDED', payload: { processId: proc.id, included: v } })} />
                        )}

                        {/* 바닥: 기존 마루 철거 */}
                        {proc.id === 'flooring' && (
                          <Toggle checked={ps.demolitionIncluded || false} label="기존 마루 철거 포함" price="+3.5만/평"
                            onChange={v => dispatch({ type: 'SET_DEMOLITION_INCLUDED', payload: { processId: proc.id, included: v } })} />
                        )}

                        {/* 폐기물 처리 (철거) */}
                        {proc.waste_disposal && (
                          <OptionSelector
                            options={proc.waste_disposal.options}
                            selected={ps.itemSelections['__waste__'] || proc.waste_disposal.options[0].grade}
                            onChange={g => dispatch({ type: 'SET_ITEM_SELECTION', payload: { processId: proc.id, itemId: '__waste__', grade: g } })}
                            label={proc.waste_disposal.name}
                          />
                        )}

                        {/* 아이템들 */}
                        {proc.items && proc.items.map(item => (
                          <div key={item.id}>
                            <ItemRenderer item={item} ps={ps} processId={proc.id} dispatch={dispatch} />
                            {/* 붙박이장 슬라이딩 도어 옵션 */}
                            {proc.id === 'furniture' && item.id === 'builtin_closet' && (
                              <div className="ml-1 mt-1">
                                <Toggle
                                  checked={ps.extraToggles?.['sliding_door'] || false}
                                  label="슬라이딩 도어로 변경"
                                  price="+40만"
                                  onChange={v => dispatch({ type: 'SET_EXTRA_TOGGLE', payload: { processId: 'furniture', extraName: 'sliding_door', enabled: v } })}
                                />
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 서브 아이템 (주방 부속 등) */}
                        {proc.sub_items && proc.sub_items.length > 0 && (
                          <div className="border-t border-gray-50 pt-2 mt-2">
                            <p className="text-[10px] text-gray-400 mb-1.5">추가 옵션</p>
                            {proc.sub_items.map(sub => {
                              const subOn = ps.itemToggles[sub.id] || false;
                              return (
                                <div key={sub.id}>
                                  <Toggle checked={subOn} label={sub.name}
                                    onChange={v => dispatch({ type: 'SET_ITEM_TOGGLE', payload: { processId: proc.id, itemId: sub.id, enabled: v } })} />
                                  {subOn && sub.options && sub.options.length > 0 && (
                                    <div className="ml-4">
                                      <OptionSelector
                                        options={sub.options}
                                        selected={ps.itemSelections[sub.id] || sub.options[0].grade}
                                        onChange={g => dispatch({ type: 'SET_ITEM_SELECTION', payload: { processId: proc.id, itemId: sub.id, grade: g } })}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 추가 옵션 (토글) */}
                        {proc.extras && proc.extras.length > 0 && (
                          <div className="border-t border-gray-50 pt-2 mt-2">
                            <p className="text-[10px] text-gray-400 mb-1">추가 시공</p>
                            {proc.extras.map(extra => (
                              <Toggle key={extra.name} checked={ps.extraToggles?.[extra.name] || false}
                                label={extra.name}
                                price={extra.price ? fmtPrice(extra.price) : extra.price_per_unit ? `${fmtPrice(extra.price_per_unit)}/개` : ''}
                                onChange={v => dispatch({ type: 'SET_EXTRA_TOGGLE', payload: { processId: proc.id, extraName: extra.name, enabled: v } })} />
                            ))}
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
});

export default ProcessToggles;
