// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 — 자재비 계산(순수 함수, 화면 없음)
//
// 원칙: 단가는 전부 사용자가 직접 넣는다(거래처 업체가). 얼마드나 단가 DB 값은 절대 쓰지 않는다.
//   수량은 물량표(computeTilePro)에서 자동으로 뽑고, 사용자가 칸에서 고칠 수 있다(qty 덮어쓰기).
//   금액 = 수량 × 단가. 합계 아래에 부가세 10% 포함 여부를 고른다(단가는 부가세 별도 가격으로 본다).
//
// 항목: 타일(박스/장/㎡ 단가 선택) · 줄눈재 · 접착제(고른 공법) · 코너비드·졸리컷 · 실리콘
//       · 방수제(켰을 때) · 수평 클립·쐐기 · 프라이머 · 사용자가 더하는 줄(운반비·양중 등).
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

import { perimeter, buildRoom } from '@/components/plan/geometry';
import { ADHESIVE_OPTIONS, type TileProForm } from './form';
import { regionsOf, type TileProResult } from './quantity';

// ── 부자재 계수 — 전부 "표준 소요량 추정"값이다(제품·현장마다 다름). 사용자가 수량 칸에서 고칠 수 있다. ──
/** 실리콘 1개(300ml 카트리지)로 시공하는 길이(m) — 표준 소요량 추정 */
export const SILICONE_M_PER_TUBE = 8;
/** 방수제 ㎡당 kg — 도막 방수 2회 기준, 표준 소요량 추정 */
export const WATERPROOF_KG_PER_SQM = 1.5;
/** 수평 클립·쐐기 타일 1장당 개수 — 표준 소요량 추정 */
export const CLIP_PER_TILE = 3;
/** 프라이머 시공 면적 배수(시공 면적 × 이 값) — 표준 소요량 추정 */
export const PRIMER_SQM_PER_SQM = 1;
/** 부가세율 */
export const VAT_RATE = 0.1;

/** 타일 단가 단위 */
export type TileUnit = 'box' | 'piece' | 'sqm';
export const TILE_UNIT_OPTIONS: { value: TileUnit; label: string }[] = [
  { value: 'box', label: '박스당' },
  { value: 'piece', label: '장당' },
  { value: 'sqm', label: '㎡당' },
];

/** 사용자가 직접 더하는 줄 */
export interface ExtraItem {
  name: string;
  unit: string;
  qty: number;
  price: number;
}

/** 자재비 입력 상태 */
export interface CostState {
  tileUnit: TileUnit;
  /** 단가(원) — 키는 priceKey(예: tile_box, grout, cement). 없으면 아직 안 넣은 것 */
  prices: Record<string, number>;
  /** 수량을 직접 고친 항목(키=항목 id). 없으면 자동값 */
  qty: Record<string, number>;
  /** 코너비드·졸리컷 길이(m) — 벽은 외부 모서리, 바닥은 문턱·경계 */
  edgeM: number;
  /** 방수제 포함(욕실 등) */
  waterproof: boolean;
  extras: ExtraItem[];
  /** 부가세 10% 포함 */
  vat: boolean;
}

export const DEFAULT_COST: CostState = {
  tileUnit: 'box',
  prices: {},
  qty: {},
  edgeM: 0,
  waterproof: false,
  extras: [],
  vat: false,
};

/** 자재 한 줄 */
export interface CostRow {
  /** 항목 id(수량 덮어쓰기 키). 추가 항목은 x0, x1… */
  id: string;
  name: string;
  unit: string;
  /** 계산된 자동 수량 */
  auto: number;
  /** 실제 쓰는 수량(고쳤으면 고친 값) */
  qty: number;
  /** 단가를 기억·저장하는 키(추가 항목은 빈 글자) */
  priceKey: string;
  /** 단가(없으면 0) */
  price: number;
  /** 금액 = 수량 × 단가 */
  amount: number;
  extra: boolean;
}

/** 합계 */
export interface CostSummary {
  subtotal: number;
  vat: number;
  total: number;
  /** 단가를 하나라도 넣었는가 */
  hasPrice: boolean;
}

/** 소수 첫째 자리 올림(㎡·m 수량용). 부동소수 오차는 먼저 걷어 낸다 */
const up1 = (v: number) => Math.ceil(Math.round(v * 1e6) / 1e5) / 10;

/** 타일 수량 — 단위별(박스 수 / 필요 장 수 / 주문 장 수 × 타일 1장 면적) */
export function tileQty(result: TileProResult, form: TileProForm, unit: TileUnit): number {
  if (unit === 'box') return result.boxes;
  if (unit === 'piece') return result.total;
  return up1((result.total * form.tileW * form.tileH) / 1e6);
}

/** 실리콘 시공 길이(m) — 바닥: 방 둘레(벽과 만나는 선) / 벽: 붙이는 벽 길이 합 + 벽마다 세로 모서리 1줄 */
export function siliconeMeters(form: TileProForm): number {
  if (form.surface === 'floor') return perimeter(buildRoom(form.shape)) / 1000;
  const walls = regionsOf(form);
  const len = walls.reduce((s, r) => s + r.outline[1].x, 0);
  return (len + walls.length * form.wallH) / 1000;
}

/** 입력값·물량표·자재비 상태 → 자재 목록(추가 항목 포함) */
export function buildCostRows(form: TileProForm, result: TileProResult, cost: CostState): CostRow[] {
  const adhName = ADHESIVE_OPTIONS.find((a) => a.value === form.adhesive)?.label ?? '접착제';
  const tileUnitLabel = cost.tileUnit === 'box' ? '박스' : cost.tileUnit === 'piece' ? '장' : '㎡';
  const sqm = result.netSqm;

  // [id, 이름, 단위, 자동수량, 단가키]
  const base: [string, string, string, number, string][] = [
    ['tile', `타일 ${form.tileW}×${form.tileH}`, tileUnitLabel, tileQty(result, form, cost.tileUnit), `tile_${cost.tileUnit}`],
    ['grout', '줄눈재', `포(${result.grout.packKg}kg)`, result.grout.packs, 'grout'],
    ['adhesive', adhName, `${form.adhesive === 'bond' ? '통' : '포'}(${result.adhesive.packKg}kg)`, result.adhesive.packs, form.adhesive],
    ['edge', form.surface === 'wall' ? '코너비드·졸리컷' : '문턱·경계 마감재', 'm', up1(cost.edgeM), 'edge'],
    ['silicone', '실리콘', '개', Math.ceil(siliconeMeters(form) / SILICONE_M_PER_TUBE), 'silicone'],
  ];
  if (cost.waterproof) base.push(['waterproof', '방수제', 'kg', Math.ceil(sqm * WATERPROOF_KG_PER_SQM), 'waterproof']);
  base.push(
    ['clip', '수평 클립·쐐기', '개', result.total * CLIP_PER_TILE, 'clip'],
    ['primer', '프라이머', '㎡', up1(sqm * PRIMER_SQM_PER_SQM), 'primer'],
  );

  const rows: CostRow[] = base.map(([id, name, unit, auto, priceKey]) => {
    const qty = cost.qty[id] ?? auto;
    const price = cost.prices[priceKey] ?? 0;
    return { id, name, unit, auto, qty, priceKey, price, amount: Math.round(qty * price), extra: false };
  });
  cost.extras.forEach((e, i) => {
    rows.push({
      id: `x${i}`,
      name: e.name || '추가 항목',
      unit: e.unit,
      auto: e.qty,
      qty: e.qty,
      priceKey: '',
      price: e.price,
      amount: Math.round(e.qty * e.price),
      extra: true,
    });
  });
  return rows;
}

/** 합계·부가세 */
export function summarizeCost(rows: CostRow[], vatOn: boolean): CostSummary {
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const vat = vatOn ? Math.round(subtotal * VAT_RATE) : 0;
  return { subtotal, vat, total: subtotal + vat, hasPrice: rows.some((r) => r.price > 0) };
}

// ── 주소 공유(?c=) — 단가는 includePrices 일 때만 담는다(업체가 노출 방지) ──

/** 숫자 하나 검사(0 이상 유한수, 위쪽 한도 있음) */
function num(v: unknown, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
}

/** 밖에서 온 값 → 안전한 자재비 상태 */
export function sanitizeCost(v: unknown): CostState {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const rec = (x: unknown, max: number) => {
    const out: Record<string, number> = {};
    if (x && typeof x === 'object') {
      Object.entries(x as Record<string, unknown>)
        .slice(0, 40)
        .forEach(([k, val]) => {
          if (/^[a-z_]{1,20}$/.test(k)) out[k] = num(val, max);
        });
    }
    return out;
  };
  const extras: ExtraItem[] = Array.isArray(o.extras)
    ? (o.extras as unknown[]).slice(0, 20).map((x) => {
        const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        return { name: String(e.name ?? '').slice(0, 30), unit: String(e.unit ?? '').slice(0, 8), qty: num(e.qty, 1e7), price: num(e.price, 1e9) };
      })
    : [];
  return {
    tileUnit: o.tileUnit === 'piece' || o.tileUnit === 'sqm' ? o.tileUnit : 'box',
    prices: rec(o.prices, 1e9),
    qty: rec(o.qty, 1e7),
    edgeM: num(o.edgeM, 1000),
    waterproof: o.waterproof === true,
    extras,
    vat: o.vat === true,
  };
}

/** 자재비 상태 → 주소용 글자. includePrices 가 false 면 단가(추가 항목 단가 포함)를 뺀다 */
export function encodeCost(cost: CostState, includePrices: boolean): string {
  const c: CostState = includePrices ? cost : { ...cost, prices: {}, extras: cost.extras.map((e) => ({ ...e, price: 0 })) };
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 주소용 글자 → 자재비 상태(깨졌으면 null) */
export function decodeCost(s: string | null | undefined): CostState | null {
  if (!s || s.length > 6000) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return sanitizeCost(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
