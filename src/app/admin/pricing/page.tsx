'use client';

import { useState } from 'react';
import dbRaw from '@/data/ulmadna_db.json';
import { formatRawWon } from '@/lib/format';
import type { UlmadnaDB, DBProcess, DBOption, DBItem } from '@/types/calculator';

const db = dbRaw as UlmadnaDB;

function PriceCell({ option }: { option: DBOption }) {
  if (option.price_per_pyeong) return <span>{formatRawWon(option.price_per_pyeong)}원/평</span>;
  if (option.price_per_m) return <span>{formatRawWon(option.price_per_m)}원/m</span>;
  if (option.price_per_ja) return <span>{formatRawWon(option.price_per_ja)}원/자</span>;
  if (option.price_per_unit) return <span>{formatRawWon(option.price_per_unit)}원/개</span>;
  if (option.price) return <span>{formatRawWon(option.price)}원</span>;
  return <span className="text-gray-300">-</span>;
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    basic: 'bg-gray-100 text-gray-600',
    partial: 'bg-gray-100 text-gray-600',
    mid_low: 'bg-blue-50 text-blue-600',
    mid: 'bg-blue-100 text-blue-700',
    mid_high: 'bg-indigo-50 text-indigo-600',
    full: 'bg-blue-100 text-blue-700',
    high_low: 'bg-amber-50 text-amber-600',
    high: 'bg-amber-100 text-amber-700',
    premium: 'bg-rose-50 text-rose-700',
    room: 'bg-green-50 text-green-600',
    living: 'bg-green-100 text-green-700',
    kitchen: 'bg-green-50 text-green-600',
    full_downlight: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[grade] || 'bg-gray-50 text-gray-500'}`}>
      {grade}
    </span>
  );
}

function OptionsTable({ options, label }: { options: DBOption[]; label?: string }) {
  return (
    <div className="mt-2">
      {label && <p className="text-xs text-gray-400 mb-1">{label}</p>}
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left px-3 py-1.5">등급</th>
            <th className="text-left px-3 py-1.5">옵션명</th>
            <th className="text-right px-3 py-1.5">단가</th>
            <th className="text-left px-3 py-1.5">브랜드</th>
          </tr>
        </thead>
        <tbody>
          {options.map((opt, i) => (
            <tr key={i} className="border-t border-gray-50">
              <td className="px-3 py-1.5"><GradeBadge grade={opt.grade} /></td>
              <td className="px-3 py-1.5 text-gray-700">{opt.name}</td>
              <td className="px-3 py-1.5 text-right font-mono text-brown"><PriceCell option={opt} /></td>
              <td className="px-3 py-1.5 text-gray-400">{opt.brand || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemsSection({ items }: { items: DBItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="mt-2 space-y-1">
      {items.map((item) => (
        <div key={item.id} className="border border-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-cream/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{expanded === item.id ? '▼' : '▶'}</span>
              <span className="font-medium text-gray-700">{item.name}</span>
              {item.price && (
                <span className="font-mono text-brown">{formatRawWon(item.price)}원{item.unit ? `/${item.unit}` : ''}</span>
              )}
            </div>
            {item.options && (
              <span className="text-[10px] text-gray-400">{item.options.length}개 옵션</span>
            )}
          </button>
          {expanded === item.id && item.options && (
            <div className="px-3 pb-2">
              <OptionsTable options={item.options} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProcessCard({ process }: { process: DBProcess }) {
  const [open, setOpen] = useState(false);

  const typeBadge = process.type === 'B_area'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-violet-50 text-violet-700 border-violet-200';

  const totalOptions = (process.options?.length || 0) +
    (process.items?.reduce((sum, item) => sum + (item.options?.length || 0), 0) || 0) +
    (process.sub_items?.reduce((sum, item) => sum + (item.options?.length || 0), 0) || 0) +
    Object.keys(process.presets || {}).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-cream/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{open ? '▼' : '▶'}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">{process.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${typeBadge}`}>
                {process.type === 'B_area' ? '면적(B)' : '개수(A)'}
              </span>
              {process.unit && (
                <span className="text-[10px] text-gray-400">단위: {process.unit}</span>
              )}
            </div>
            {process.description && (
              <p className="text-xs text-gray-400 mt-0.5">{process.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-400">{totalOptions}개 옵션</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
          {/* Presets */}
          {process.presets && Object.keys(process.presets).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">프리셋 (등급별 세트 가격)</p>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-1.5">등급</th>
                    <th className="text-left px-3 py-1.5">이름</th>
                    <th className="text-right px-3 py-1.5">가격</th>
                    <th className="text-left px-3 py-1.5">출처</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(process.presets).map(([grade, preset]) => (
                    <tr key={grade} className="border-t border-gray-50">
                      <td className="px-3 py-1.5"><GradeBadge grade={grade} /></td>
                      <td className="px-3 py-1.5 text-gray-700">{preset.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-brown">
                        {preset.total ? `${formatRawWon(preset.total)}원` :
                         preset.total_per_unit ? `${formatRawWon(preset.total_per_unit)}원/개소` : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-400 max-w-[200px] truncate">{preset.source || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Options (B_area type mainly) */}
          {process.options && process.options.length > 0 && (
            <OptionsTable options={process.options} label="옵션 목록" />
          )}

          {/* Items (A_item type mainly) */}
          {process.items && process.items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">세부 항목 (클릭하여 옵션 확인)</p>
              <ItemsSection items={process.items} />
            </div>
          )}

          {/* Sub items */}
          {process.sub_items && process.sub_items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">추가 항목 (선택)</p>
              <ItemsSection items={process.sub_items} />
            </div>
          )}

          {/* Waste disposal */}
          {process.waste_disposal && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">{process.waste_disposal.name}</p>
              <OptionsTable options={process.waste_disposal.options} />
            </div>
          )}

          {/* Extras */}
          {process.extras && process.extras.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">부가 항목</p>
              <table className="w-full text-xs">
                <tbody>
                  {process.extras.map((extra, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-1.5 text-gray-700">{extra.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-brown">{formatRawWon(extra.price || extra.price_per_unit || 0)}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          {process.note && (
            <p className="text-xs text-gray-400 bg-cream/30 rounded-lg px-3 py-2">
              {process.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PricingAdmin() {
  const { config, processes } = db;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">단가 관리</h2>
          <p className="text-xs text-gray-400 mt-1">
            ulmadna_db.json v{db.meta.version} | 최종 업데이트: {db.meta.updated}
          </p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">읽기 전용</span>
      </div>

      {/* Config 섹션 */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">설정값 (config)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">마진율 범위</p>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-600">최소</span>
              <span className="font-mono text-brown">{(config.margin_rate_range.min * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-600">최대</span>
              <span className="font-mono text-brown">{(config.margin_rate_range.max * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between py-1 text-sm border-t border-gray-50 mt-1 pt-1">
              <span className="text-gray-600">예비비율</span>
              <span className="font-mono text-brown">{(config.contingency_rate * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">거주 상태 계수</p>
            {Object.entries(config.living_condition_coefficient).map(([key, val]) => (
              <div key={key} className="flex justify-between py-1 text-sm">
                <span className="text-gray-600">{key === 'empty' ? '공실' : '거주중'}</span>
                <span className="font-mono text-brown">x{val}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">기타</p>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-600">지역 계수</span>
              <span className="font-mono text-brown">x{config.region_coefficient}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-600">천장 기준 높이</span>
              <span className="font-mono text-brown">{config.ceiling_height_base_mm}mm</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-600">기본 인원</span>
              <span className="font-mono text-brown">{config.labor_default_workers}인</span>
            </div>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <p className="text-2xl font-bold text-brown">{processes.length}</p>
          <p className="text-xs text-gray-400 mt-1">전체 공정</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <p className="text-2xl font-bold text-emerald-600">{processes.filter(p => p.type === 'B_area').length}</p>
          <p className="text-xs text-gray-400 mt-1">면적(B) 타입</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <p className="text-2xl font-bold text-violet-600">{processes.filter(p => p.type === 'A_item').length}</p>
          <p className="text-xs text-gray-400 mt-1">개수(A) 타입</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <p className="text-2xl font-bold text-gold">
            {processes.reduce((sum, p) => {
              return sum +
                (p.options?.length || 0) +
                (p.items?.reduce((s, item) => s + (item.options?.length || 0), 0) || 0) +
                (p.sub_items?.reduce((s, item) => s + (item.options?.length || 0), 0) || 0) +
                Object.keys(p.presets || {}).length;
            }, 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">총 옵션 수</p>
        </div>
      </div>

      {/* 공정별 카드 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">공정별 상세 ({processes.length}개)</h3>
        {processes.map((process) => (
          <ProcessCard key={process.id} process={process} />
        ))}
      </div>
    </div>
  );
}
