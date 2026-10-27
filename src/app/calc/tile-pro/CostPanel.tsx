// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 — "자재비" 칸(화면)
//
// 항목마다 [수량(자동 계산, 고치면 그 값)] × [단가 입력] = 금액. 맨 아래 합계·부가세 포함 토글.
//   - 단가는 기본 비어 있다(자리 표시 글자만). 얼마드나 단가 DB 값은 넣지 않는다.
//   - 수량 칸을 고치면 옆에 ↺ 가 떠서 자동값으로 되돌릴 수 있다.
//   - 계산은 src/lib/tilepro/cost.ts(순수 함수), 이 파일은 입력·표시만 맡는다.
//   - 상태(단가 기억·추적)는 부모(TileProCalculator)가 들고, 이 칸은 콜백만 부른다.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import NumberField from '@/components/v1/NumberField';
import { TILE_UNIT_OPTIONS, type CostRow, type CostState, type CostSummary, type ExtraItem, type TileUnit } from '@/lib/tilepro/cost';
import type { TileProForm } from '@/lib/tilepro/form';

/** 금액 → "1,234원" */
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;

interface Props {
  form: TileProForm;
  cost: CostState;
  rows: CostRow[];
  summary: CostSummary;
  /** 자재비 입력이 일어났음을 알림(추적용) */
  onTouch: () => void;
  /** 상태 일부 바꾸기 */
  onChange: (patch: Partial<CostState>) => void;
  /** 단가 바꾸기(기기에 기억하는 일은 부모가 한다) */
  onPrice: (key: string, v: number) => void;
}

/** 수량·단가 입력 한 칸의 공통 모양(작게) */
const CELL = '!h-11 !px-[10px]';

export default function CostPanel({ form, cost, rows, summary, onTouch, onChange, onPrice }: Props) {
  /** 수량 고치기 — 빈 칸이면 자동값으로 되돌림 */
  const setQty = (id: string, v: number | '') => {
    onTouch();
    const next = { ...cost.qty };
    if (v === '') delete next[id];
    else next[id] = v;
    onChange({ qty: next });
  };
  /** 추가 항목 한 줄 바꾸기 */
  const setExtra = (i: number, patch: Partial<ExtraItem>) => {
    onTouch();
    onChange({ extras: cost.extras.map((e, k) => (k === i ? { ...e, ...patch } : e)) });
  };

  return (
    <section aria-label="자재비" className="rounded-card border border-line bg-surface p-5 flex flex-col gap-3" id="tilepro-cost">
      <h2 className="t-section text-ink">자재비</h2>

      {/* 타일 단가 단위 */}
      <ChipGroup role="radiogroup" ariaLabel="타일 단가 단위" className="flex gap-2 flex-wrap">
        {TILE_UNIT_OPTIONS.map((u) => (
          <Chip key={u.value} size="sm" asRadio selected={cost.tileUnit === u.value} onClick={() => onChange({ tileUnit: u.value as TileUnit })}>
            타일 {u.label}
          </Chip>
        ))}
      </ChipGroup>

      {/* 마감재 길이 + 방수 */}
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="t-sub text-ink-2">{form.surface === 'wall' ? '외부 모서리 길이' : '문턱·경계 길이'}</span>
          <NumberField
            value={cost.edgeM || ''}
            onChange={(v) => {
              onTouch();
              onChange({ edgeM: v === '' ? 0 : v });
            }}
            suffix="m"
            placeholder="0"
            aria-label="마감재 길이"
            className={CELL}
          />
        </label>
        <Chip size="sm" selected={cost.waterproof} onClick={() => onChange({ waterproof: !cost.waterproof })}>
          방수제 포함
        </Chip>
      </div>

      {/* 자재 줄 */}
      <ul className="flex flex-col">
        {rows
          .filter((r) => !r.extra)
          .map((r) => (
            <li key={r.id} className="border-t border-v1-line-2 py-3 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] text-ink">{r.name}</span>
                <span className="text-[14px] text-ink tabular-nums">{r.price > 0 ? won(r.amount) : '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-[104px] flex-none flex items-center gap-1">
                  <NumberField
                    value={r.qty}
                    onChange={(v) => setQty(r.id, v)}
                    aria-label={`${r.name} 수량`}
                    className={`${CELL} min-w-0`}
                  />
                </div>
                <span className="t-sub text-ink-2 flex-none whitespace-nowrap">{r.unit}</span>
                {r.qty !== r.auto && (
                  <button type="button" onClick={() => setQty(r.id, '')} className="t-sub text-accent flex-none" aria-label={`${r.name} 수량 자동값으로`}>
                    ↺
                  </button>
                )}
                <span className="text-ink-2 flex-none">×</span>
                <NumberField
                  value={r.price || ''}
                  onChange={(v) => {
                    onTouch();
                    onPrice(r.priceKey, v === '' ? 0 : v);
                  }}
                  inputMode="numeric"
                  showCommas
                  suffix="원"
                  placeholder="단가"
                  aria-label={`${r.name} 단가`}
                  className={`${CELL} flex-1 min-w-0`}
                />
              </div>
            </li>
          ))}
      </ul>

      {/* 추가 항목 */}
      {cost.extras.map((e, i) => (
        <div key={i} className="border-t border-v1-line-2 pt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={e.name}
              maxLength={30}
              placeholder="항목 이름 (운반비, 양중…)"
              aria-label="추가 항목 이름"
              onChange={(ev) => setExtra(i, { name: ev.target.value })}
              className="flex-1 min-w-0 h-11 px-[10px] rounded-[4px] border border-v1-line-3 bg-white text-[16px] outline-none focus:border-brown"
            />
            <input
              type="text"
              value={e.unit}
              maxLength={8}
              placeholder="단위"
              aria-label="추가 항목 단위"
              onChange={(ev) => setExtra(i, { unit: ev.target.value })}
              className="w-16 flex-none h-11 px-[10px] rounded-[4px] border border-v1-line-3 bg-white text-[16px] outline-none focus:border-brown"
            />
            <button
              type="button"
              onClick={() => onChange({ extras: cost.extras.filter((_, k) => k !== i) })}
              className="h-11 w-9 flex-none text-ink-2"
              aria-label="추가 항목 지우기"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2">
            <NumberField
              value={e.qty || ''}
              onChange={(v) => setExtra(i, { qty: v === '' ? 0 : v })}
              placeholder="수량"
              aria-label="추가 항목 수량"
              className={`${CELL} w-[104px] flex-none`}
            />
            <span className="text-ink-2 flex-none">×</span>
            <NumberField
              value={e.price || ''}
              onChange={(v) => setExtra(i, { price: v === '' ? 0 : v })}
              inputMode="numeric"
              showCommas
              suffix="원"
              placeholder="단가"
              aria-label="추가 항목 단가"
              className={`${CELL} flex-1 min-w-0`}
            />
            <span className="text-[14px] text-ink tabular-nums flex-none min-w-[72px] text-right">{e.price > 0 ? won(e.qty * e.price) : '-'}</span>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          onTouch();
          onChange({ extras: [...cost.extras, { name: '', unit: '식', qty: 1, price: 0 }] });
        }}
        className="h-11 rounded-[10px] border border-dashed border-v1-line-3 t-sub text-ink-2 active:bg-v1-card-soft"
      >
        + 항목 추가
      </button>

      {/* 합계 */}
      <div className="border-t border-v1-line-3 pt-3 flex flex-col gap-1.5 tabular-nums">
        <div className="flex justify-between text-[14px]">
          <span className="text-ink-2">합계{cost.vat ? ' (공급가)' : ''}</span>
          <span className="text-ink">{summary.hasPrice ? won(summary.subtotal) : '-'}</span>
        </div>
        {cost.vat && (
          <div className="flex justify-between text-[14px]">
            <span className="text-ink-2">부가세 10%</span>
            <span className="text-ink">{won(summary.vat)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <Chip size="sm" selected={cost.vat} onClick={() => onChange({ vat: !cost.vat })}>
            부가세 포함
          </Chip>
          <span className="text-[22px] font-bold text-ink">{summary.hasPrice ? won(summary.total) : '-'}</span>
        </div>
      </div>
      <p className="t-sub text-v1-text-disabled">단가는 직접 입력 · 부자재 수량은 표준 소요량 추정이라 칸에서 고칠 수 있어요</p>
    </section>
  );
}
