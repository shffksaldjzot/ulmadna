'use client';

import { useState } from 'react';
import type { ProcessUserState, CalculatorOutput, CalculatorAction, DBProcess, DBOption, DBItem } from '@/types/calculator';
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

// ─── 가격 포맷 ───
function formatPrice(price: number): string {
  if (price === 0) return '0';
  if (price >= 100000) {
    const man = price / 10000;
    return `${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}만`;
  }
  if (price >= 10000) {
    const man = price / 10000;
    return `${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}만`;
  }
  return `${price.toLocaleString()}원`;
}

// 가격 + 단위 표시
function formatPriceWithUnit(option: DBOption): string {
  if (option.price_per_pyeong) return `${formatPrice(option.price_per_pyeong)}/평`;
  if (option.price_per_m) return `${formatPrice(option.price_per_m)}/m`;
  if (option.price_per_ja) return `${formatPrice(option.price_per_ja)}/자`;
  if (option.price !== undefined) return formatPrice(option.price);
  return '';
}

interface ProcessTogglesProps {
  processes: ProcessUserState[];
  output?: CalculatorOutput;
  dispatch: React.Dispatch<CalculatorAction>;
}

// ─── 미니 토글 스위치 ───
function MiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-brown' : 'bg-gray-300'}`}
    >
      <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mt-[1px] ${
        checked ? 'translate-x-[15px] ml-0.5' : 'ml-[2px]'
      }`} />
    </button>
  );
}

// ─── 스텝퍼 ───
function Stepper({ value, onChange, min = 0, max = 99, unit = '' }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => value > min && onChange(value - 1)}
        className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 text-xs flex items-center justify-center hover:border-gold"
      >
        -
      </button>
      <span className="w-8 text-center text-xs font-medium text-brown">
        {value}{unit}
      </span>
      <button
        onClick={() => value < max && onChange(value + 1)}
        className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 text-xs flex items-center justify-center hover:border-gold"
      >
        +
      </button>
    </div>
  );
}

// ─── 셀렉트 드롭다운 (옵션 선택) ───
function OptionSelect({ options, selectedGrade, onChange }: {
  options: DBOption[];
  selectedGrade: string;
  onChange: (grade: string) => void;
}) {
  return (
    <select
      value={selectedGrade}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none"
    >
      {options.map(opt => (
        <option key={opt.grade} value={opt.grade}>
          {opt.name} · {formatPriceWithUnit(opt)}
        </option>
      ))}
    </select>
  );
}

// ─── 수치 입력 (미터, 자) ───
function DimensionInput({ value, onChange, unit, label }: {
  value: number; onChange: (v: number) => void; unit: string; label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 0) onChange(v);
          }}
          step={unit === 'm' ? 0.1 : 1}
          min={0}
          className="w-16 px-2 py-1 text-xs text-right rounded border border-gray-200 focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none text-brown font-medium"
        />
        <span className="text-[10px] text-gray-400">{unit}</span>
      </div>
    </div>
  );
}

// ─── 아이템 행 렌더링 ───
function ItemRow({
  item,
  ps,
  processId,
  dispatch,
  multiplier,
}: {
  item: DBItem;
  ps: ProcessUserState;
  processId: string;
  dispatch: React.Dispatch<CalculatorAction>;
  multiplier?: number; // bathroom count for per-unit items
}) {
  // Item with options -> dropdown
  if (item.options && item.options.length > 0) {
    const selectedGrade = ps.itemSelections[item.id] || item.options[0].grade;
    const selectedOption = item.options.find(o => o.grade === selectedGrade) || item.options[0];

    // Check if it needs a dimension input
    const needsDimM = selectedOption?.price_per_m !== undefined;
    const needsDimJa = selectedOption?.price_per_ja !== undefined;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-600 flex-shrink-0">{item.name}</span>
        </div>
        <OptionSelect
          options={item.options}
          selectedGrade={selectedGrade}
          onChange={grade => dispatch({
            type: 'SET_ITEM_SELECTION',
            payload: { processId, itemId: item.id, grade },
          })}
        />
        {needsDimM && (
          <DimensionInput
            label="길이"
            value={ps.dimensions[item.id === 'sink_cabinet' || item.id === 'countertop' ? 'sink_length' : `${item.id}_length`] || 3.5}
            onChange={v => dispatch({
              type: 'SET_DIMENSION',
              payload: {
                processId,
                key: item.id === 'sink_cabinet' || item.id === 'countertop' ? 'sink_length' : `${item.id}_length`,
                value: v,
              },
            })}
            unit="m"
          />
        )}
        {needsDimJa && (
          <DimensionInput
            label="크기"
            value={ps.dimensions[`${item.id}_ja`] || 12}
            onChange={v => dispatch({
              type: 'SET_DIMENSION',
              payload: { processId, key: `${item.id}_ja`, value: v },
            })}
            unit="자"
          />
        )}
      </div>
    );
  }

  // Fixed price item with stepper unit (EA, M)
  if (item.price !== undefined && (item.unit === 'EA' || item.unit === 'M')) {
    const isToggled = ps.itemToggles[item.id] !== false;
    const count = ps.itemCounts[item.id] || 0;
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MiniToggle
            checked={isToggled}
            onChange={v => dispatch({
              type: 'SET_ITEM_TOGGLE',
              payload: { processId, itemId: item.id, enabled: v },
            })}
          />
          <span className={`text-[11px] ${isToggled ? 'text-gray-600' : 'text-gray-400'}`}>
            {item.name}
            <span className="text-gray-400"> · {formatPrice(item.price)}/{item.unit}</span>
          </span>
        </div>
        {isToggled && (
          <Stepper
            value={count}
            onChange={v => dispatch({
              type: 'SET_ITEM_COUNT',
              payload: { processId, itemId: item.id, count: v },
            })}
            unit={item.unit}
          />
        )}
      </div>
    );
  }

  // Fixed price item -> toggle
  if (item.price !== undefined) {
    const isToggled = ps.itemToggles[item.id] !== false;
    const unitLabel = item.unit ? `/${item.unit}` : '';
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MiniToggle
            checked={isToggled}
            onChange={v => dispatch({
              type: 'SET_ITEM_TOGGLE',
              payload: { processId, itemId: item.id, enabled: v },
            })}
          />
          <span className={`text-[11px] ${isToggled ? 'text-gray-600' : 'text-gray-400'}`}>
            {item.name}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">
          {formatPrice(item.price)}{unitLabel}
          {multiplier && multiplier > 1 ? ` × ${multiplier}` : ''}
        </span>
      </div>
    );
  }

  // price_per_pyeong item (like cleaning in misc)
  if ((item as unknown as { price_per_pyeong?: number }).price_per_pyeong) {
    const isToggled = ps.itemToggles[item.id] !== false;
    const ppyeong = (item as unknown as { price_per_pyeong: number }).price_per_pyeong;
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MiniToggle
            checked={isToggled}
            onChange={v => dispatch({
              type: 'SET_ITEM_TOGGLE',
              payload: { processId, itemId: item.id, enabled: v },
            })}
          />
          <span className={`text-[11px] ${isToggled ? 'text-gray-600' : 'text-gray-400'}`}>
            {item.name}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">
          {formatPrice(ppyeong)}/평
        </span>
      </div>
    );
  }

  return null;
}

// ─── Sub item 행 (토글 + 옵션) ───
function SubItemRow({
  item,
  ps,
  processId,
  dispatch,
}: {
  item: DBItem;
  ps: ProcessUserState;
  processId: string;
  dispatch: React.Dispatch<CalculatorAction>;
}) {
  const isToggled = ps.itemToggles[item.id] === true;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MiniToggle
            checked={isToggled}
            onChange={v => dispatch({
              type: 'SET_ITEM_TOGGLE',
              payload: { processId, itemId: item.id, enabled: v },
            })}
          />
          <span className={`text-[11px] ${isToggled ? 'text-gray-600' : 'text-gray-400'}`}>
            {item.name}
          </span>
        </div>
      </div>
      {isToggled && item.options && item.options.length > 0 && (
        <div className="ml-10 space-y-1.5">
          <OptionSelect
            options={item.options}
            selectedGrade={ps.itemSelections[item.id] || item.options[0].grade}
            onChange={grade => dispatch({
              type: 'SET_ITEM_SELECTION',
              payload: { processId, itemId: item.id, grade },
            })}
          />
          {/* Check for dimension input */}
          {(() => {
            const selGrade = ps.itemSelections[item.id] || item.options[0].grade;
            const selOpt = item.options.find(o => o.grade === selGrade);
            if (selOpt?.price_per_ja !== undefined) {
              return (
                <DimensionInput
                  label="크기"
                  value={ps.dimensions[`${item.id}_ja`] || 6}
                  onChange={v => dispatch({
                    type: 'SET_DIMENSION',
                    payload: { processId, key: `${item.id}_ja`, value: v },
                  })}
                  unit="자"
                />
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ───
export default function ProcessToggles({ processes, output, dispatch }: ProcessTogglesProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
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
              {groupProcesses.map(dbProcess => {
                const ps = processes.find(p => p.id === dbProcess.id);
                if (!ps) return null;

                const isEnabled = ps.enabled;
                const isExpanded = expandedIds.has(dbProcess.id);
                const processResult = output?.processes.find(p => p.id === dbProcess.id);
                const amount = processResult?.amount || 0;
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
                    {/* 헤더 */}
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
                            dispatch({ type: 'TOGGLE_PROCESS', payload: dbProcess.id });
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

                    {/* 아코디언 내용 */}
                    {isEnabled && isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3 overflow-hidden">

                        {/* 공정 수량 (개소수) */}
                        {isCountable && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">{dbProcess.unit || '개'} 수</span>
                            <Stepper
                              value={ps.count}
                              onChange={v => dispatch({
                                type: 'SET_PROCESS_COUNT',
                                payload: { processId: dbProcess.id, count: v },
                              })}
                            />
                          </div>
                        )}

                        {/* B_area 공정: process-level 옵션 드롭다운 */}
                        {dbProcess.type === 'B_area' && dbProcess.options && dbProcess.options.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">자재 선택</p>
                            <OptionSelect
                              options={dbProcess.options}
                              selectedGrade={ps.itemSelections['__process__'] || dbProcess.options[0].grade}
                              onChange={grade => dispatch({
                                type: 'SET_ITEM_SELECTION',
                                payload: { processId: dbProcess.id, itemId: '__process__', grade },
                              })}
                            />
                          </div>
                        )}

                        {/* A_item 공정: process-level 옵션 (items가 없을 때) */}
                        {dbProcess.type === 'A_item' && dbProcess.options && dbProcess.options.length > 0 && !dbProcess.items?.length && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">자재/등급 선택</p>
                            <OptionSelect
                              options={dbProcess.options}
                              selectedGrade={ps.itemSelections['__process__'] || dbProcess.options[0].grade}
                              onChange={grade => dispatch({
                                type: 'SET_ITEM_SELECTION',
                                payload: { processId: dbProcess.id, itemId: '__process__', grade },
                              })}
                            />
                          </div>
                        )}

                        {/* 폐기물 처리 (철거) */}
                        {dbProcess.waste_disposal && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">폐기물 처리</p>
                            <OptionSelect
                              options={dbProcess.waste_disposal.options}
                              selectedGrade={ps.itemSelections['__waste__'] || dbProcess.waste_disposal.options[0].grade}
                              onChange={grade => dispatch({
                                type: 'SET_ITEM_SELECTION',
                                payload: { processId: dbProcess.id, itemId: '__waste__', grade },
                              })}
                            />
                          </div>
                        )}

                        {/* 도배: 천정 포함 토글 */}
                        {dbProcess.id === 'wallpaper' && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">천정 도배 포함</span>
                            <MiniToggle
                              checked={ps.ceilingIncluded || false}
                              onChange={v => dispatch({
                                type: 'SET_CEILING_INCLUDED',
                                payload: { processId: dbProcess.id, included: v },
                              })}
                            />
                          </div>
                        )}

                        {/* 바닥: 기존 마루 철거 포함 토글 */}
                        {dbProcess.id === 'flooring' && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">기존 마루 철거 포함 (+3.5만/평)</span>
                            <MiniToggle
                              checked={ps.demolitionIncluded || false}
                              onChange={v => dispatch({
                                type: 'SET_DEMOLITION_INCLUDED',
                                payload: { processId: dbProcess.id, included: v },
                              })}
                            />
                          </div>
                        )}

                        {/* 아이템 목록 */}
                        {dbProcess.items && dbProcess.items.length > 0 && (
                          <div className="border-t border-gray-50 pt-2 space-y-2.5">
                            <p className="text-[10px] text-gray-400">구성 항목</p>
                            {dbProcess.items.map(item => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                ps={ps}
                                processId={dbProcess.id}
                                dispatch={dispatch}
                                multiplier={dbProcess.id === 'bathroom' ? ps.count : undefined}
                              />
                            ))}
                          </div>
                        )}

                        {/* 주방: 싱크대 길이 입력 */}
                        {dbProcess.id === 'kitchen' && (
                          <div className="border-t border-gray-50 pt-2">
                            <DimensionInput
                              label="싱크대 길이"
                              value={ps.dimensions['sink_length'] || 3.5}
                              onChange={v => dispatch({
                                type: 'SET_DIMENSION',
                                payload: { processId: dbProcess.id, key: 'sink_length', value: v },
                              })}
                              unit="m"
                            />
                          </div>
                        )}

                        {/* Sub items (주방 부속품) */}
                        {dbProcess.sub_items && dbProcess.sub_items.length > 0 && (
                          <div className="border-t border-gray-50 pt-2 space-y-2.5">
                            <p className="text-[10px] text-gray-400">추가 옵션</p>
                            {dbProcess.sub_items.map(item => (
                              <SubItemRow
                                key={item.id}
                                item={item}
                                ps={ps}
                                processId={dbProcess.id}
                                dispatch={dispatch}
                              />
                            ))}
                          </div>
                        )}

                        {/* Extras */}
                        {dbProcess.extras && dbProcess.extras.length > 0 && (
                          <div className="border-t border-gray-50 pt-2 space-y-2">
                            <p className="text-[10px] text-gray-400">추가 공사</p>
                            {dbProcess.extras.map(extra => (
                              <div key={extra.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <MiniToggle
                                    checked={ps.extraToggles?.[extra.name] || false}
                                    onChange={v => dispatch({
                                      type: 'SET_EXTRA_TOGGLE',
                                      payload: { processId: dbProcess.id, extraName: extra.name, enabled: v },
                                    })}
                                  />
                                  <span className={`text-[11px] ${ps.extraToggles?.[extra.name] ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {extra.name}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {extra.price ? formatPrice(extra.price) : ''}
                                  {extra.price_per_unit ? `${formatPrice(extra.price_per_unit)}/대` : ''}
                                </span>
                              </div>
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
}
