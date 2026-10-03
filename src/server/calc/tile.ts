// ──────────────────────────────────────────────
// 타일 계산기 — 오케스트레이터(서버 전용)
//
// 이 파일이 하는 일(미장·바닥재 계산기와 같은 흐름):
//   1) 공간(간단 모드) 또는 실 카드(정확 모드)를 받아 실마다 벽·바닥 시공 면적을 구한다
//      (욕실 = 둘레×높이 − 문·창·욕조 / 바닥 = 가로×세로 / 거실 = 바닥재 계산기와 같은 62건 평면도 비율)
//   2) 패턴·면별 로스율을 곱해 장 수 → 박스 수(올림)를 낸다
//   3) 줄눈재·압착시멘트(또는 떠붙임 몰탈) 포 수를 낸다
//   4) 맡김이면 철거·방수·인건·경비까지, 셀프면 자재+부자재만 금액 범위를 만든다
//   5) 현장 확인 항목(덧방 조건·대형 타일 덧방·로트)과 견적DB 비교 범위를 붙인다
//
// 내보내는 것: 물량 · 금액 범위 · 근거 문장 · 견적DB 비교 범위(n, 하위25%~상위25%).
// 내보내지 않는 것: 단가표 원본(㎡당·인당 단가), 계수(로스율 표·하루 시공량 등) 원본.
//   비용 줄에 단가 칸이 없는 것도 그 때문이다(금액 범위만 나간다).
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import 'server-only';

import { calculateQuantity } from '@/app/v3/data/quantity';
import type { BayKey } from '@/app/v3/data/types';
import { SQM_PER_PYEONG, EXCLUSIVE_RATIO, PYEONG_TO_EXCLUSIVE_SQM } from './schema/wallpaper-coefficients';
import {
  BATH_PRESETS,
  bathFloorCodeFor,
  defaultSizeCodeFor,
  findTileSize,
  isBathScope,
  isLargeTile,
  methodLabel,
  TILE_SIZES,
  type TileGrade,
  type TileMethod,
  type TilePattern,
  type TileRoomKind,
  type TileScope,
  type TileService,
  type TileSetting,
} from '@/lib/v1/tilePresets';
import {
  defaultMethodFor,
  DOOR_SIZE_M,
  WINDOW_SIZE_M,
  TUB_FRONT_M,
  TUB_FLOOR_M,
  SIMPLE_BATH_DOORS,
  WATERPROOF_ON_DEMOLISH,
  BATH2_DISCOUNT_RATE,
  ENTRANCE_SQM_AT_34,
  ENTRANCE_SQM_MIN,
  ENTRANCE_SQM_MAX,
  BALCONY_SQM_AT_34,
  BALCONY_SQM_MIN,
  BALCONY_SQM_MAX,
  DEFAULT_PYEONG,
  DEFAULT_BAY,
  LOSS_RATE,
  ADHESIVE_KG_PER_SQM,
  ADHESIVE_KG_PER_SQM_LARGE,
  ADHESIVE_BAG_KG,
  MORTAR_BED_KG_PER_SQM,
  MORTAR_BED_BAG_KG,
  GROUT_DEPTH_MM,
  GROUT_DENSITY_KG_PER_L,
  GROUT_LOSS_RATE,
  GROUT_BAG_KG,
  DEFAULT_GROUT_MM,
  PRODUCTIVITY_BATH_SQM_PER_MANDAY,
  PRODUCTIVITY_FLOOR_SQM_PER_MANDAY,
  MIN_MANDAYS,
  MANDAY_STEP,
  PATTERN_LABOR_MULT,
  LARGE_TILE_LABOR_MULT,
  MORTAR_BED_LABOR_MULT,
  LARGE_TILE_LONG_SIDE_MM,
} from './schema/tile-coefficients';
import {
  WALL_TILE_PRICE,
  FLOOR_TILE_PRICE,
  LARGE_TILE_PRICE_MULT,
  TILE_LABOR_PER_MANDAY,
  BATH_DEMOLISH_PER_SQM,
  TILE_DEMOLISH_PER_SQM,
  FLOOR_DEMOLISH_PER_SQM,
  BATH_WATERPROOF_PER_ROOM,
  ADHESIVE_BAG_PRICE,
  MORTAR_BED_BAG_PRICE,
  GROUT_BAG_PRICE,
  MISC_SUBMATERIAL_PER_SQM,
  TILE_OVERHEAD_RATE,
  MARKET_REF_BATH,
  MARKET_REF_ENTRANCE,
  MARKET_REF_BALCONY,
  MARKET_REF_BOX,
  type TilePriceBand,
  type TileMarketRef,
} from '../pricing/tile';

// ── 입력 타입 ──────────────────────────────────

/** 타일 한 종류(벽 또는 바닥) */
export interface TileSpecInput {
  /** 타일 가로(mm) */
  widthMm: number;
  /** 타일 세로(mm) */
  lengthMm: number;
  /** 박스당 장 수 — 없으면 규격 관례값(같은 규격이 없으면 약 1.44㎡가 되게 추정) */
  piecesPerBox?: number;
}

/** 빼는 면적 하나(직접 넣는 문·창 등) */
export interface TileOpeningInput {
  widthMm: number;
  heightMm: number;
  count: number;
}

/** 정확 모드 실 카드 하나 */
export interface TileRoomInput {
  /** 욕실(벽+바닥) / 바닥면 / 벽면 */
  kind: TileRoomKind;
  name?: string;
  /** 가로(mm) — 벽면이면 벽 길이 */
  widthMm?: number;
  /** 세로(mm) — 욕실·바닥면만 */
  depthMm?: number;
  /** 높이(mm) — 욕실·벽면만 */
  heightMm?: number;
  /** 치수 대신 면적(㎡)을 바로 넣었을 때 — 바닥면·벽면만 */
  areaSqm?: number;
  /** 문 개수(표준 크기로 뺀다) */
  doors?: number;
  /** 창 개수(표준 크기로 뺀다) */
  windows?: number;
  /** 욕조 있음 — 욕조 앞판·바닥만큼 뺀다(욕실만) */
  tub?: boolean;
  /** 직접 넣는 빼는 면적 */
  openings?: TileOpeningInput[];
}

/** 타일 계산 입력 — 안 보낸 값은 서버 기본값으로 계산하고 assumed[]에 적는다 */
export interface TileCalcInput {
  mode: 'simple' | 'precise';
  /** 간단 모드 공간 */
  scope?: TileScope;
  method?: TileMethod;
  service?: TileService;
  /** 거실·현관·베란다 평형 */
  pyeong?: number;
  bay?: 2 | 3 | 4;
  pattern?: TilePattern;
  grade?: TileGrade;
  /** 줄눈 폭(mm) */
  groutMm?: number;
  setting?: TileSetting;
  /** 로스율 직접 지정(0~0.3) — 없으면 패턴·면 기본값 */
  lossRate?: number;
  /** 정확 모드 실 카드 */
  rooms?: TileRoomInput[];
  wallTile?: TileSpecInput;
  floorTile?: TileSpecInput;
}

// ── 출력 타입 ──────────────────────────────────

/** 벽 또는 바닥 한쪽 수량 */
export interface TileSurfaceQuantity {
  /** 타일 규격 이름(예: "300×600") */
  sizeLabel: string;
  /** 시공 면적(로스 미포함, ㎡) */
  netSqm: number;
  /** 로스율(%) */
  lossPct: number;
  /** 로스 포함 면적(㎡) */
  grossSqm: number;
  /** 필요 장 수 */
  pieces: number;
  /** 박스 수(올림) */
  boxes: number;
  /** 박스당 장 수 */
  piecesPerBox: number;
  /** 박스당 면적(㎡) */
  sqmPerBox: number;
}

/** 실별 한 줄 */
export interface TileRoomQuantity {
  key: string;
  name: string;
  wallSqm: number;
  floorSqm: number;
  wallBoxes: number;
  floorBoxes: number;
}

/** 비용 층 */
export type TileCostLayer = '자재' | '부자재' | '철거' | '방수' | '인건' | '경비';

/** 비용 한 줄 — 단가 칸 없이 수량·금액 범위만 */
export interface TileCostLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  amountMin: number;
  amountMax: number;
  layer: TileCostLayer;
  grade: 'A' | 'B' | 'C';
  note: string;
}

/** 가정한 값의 종류 */
export type TileAssumption = 'method' | 'size' | 'pyeong' | 'pattern' | 'grade' | 'dims' | 'rooms';

/** 현장 확인 항목 키 — 화면이 문구로 바꾼다 */
export type TileCheck = 'overlayConditions' | 'largeOverlay' | 'lot';

/** 타일 계산 결과 */
export interface TileCalcResult {
  /** 실제로 쓴 값(가정 포함) — 화면 요약·가정 문구용 */
  resolved: {
    mode: 'simple' | 'precise';
    scope?: TileScope;
    method: TileMethod;
    methodLabel: string;
    service: TileService;
    pattern: TilePattern;
    grade: TileGrade;
    groutMm: number;
    setting: TileSetting;
    /** 거실·현관·베란다일 때만 */
    pyeong?: number;
  };
  quantity: {
    wall: TileSurfaceQuantity | null;
    floor: TileSurfaceQuantity | null;
    grout: { lengthM: number; kg: number; bags: number; bagKg: number; grade: 'A' | 'B' | 'C' };
    adhesive: { name: string; kg: number; bags: number; bagKg: number; grade: 'A' | 'B' | 'C' };
    /** 품 수(맡김일 때만, 셀프면 0) */
    mandays: number;
    byRoom: TileRoomQuantity[];
  };
  cost: {
    min: number;
    mid: number;
    max: number;
    basisLine: string;
    breakdown: TileCostLine[];
  };
  assumed: TileAssumption[];
  checks: TileCheck[];
  /** 견적DB 비교 범위(없으면 null) */
  marketRef: TileMarketRef | null;
}

// ── 작은 도우미 ────────────────────────────────

/** 소수 1자리 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
/** 소수 2자리 */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
/** 1,000원 단위 반올림 */
function roundWon(n: number): number {
  return Math.round(n / 1000) * 1000;
}
/** 부동소수 오차로 정수가 한 칸 더 올라가지 않게 아주 작은 값을 빼고 올림 */
function ceilSafe(n: number): number {
  return Math.ceil(n - 1e-9);
}
/** 오늘 기준 "2026.10" 표기 */
function baseMonthLabel(now: Date = new Date()): string {
  return `${now.getFullYear()}.${now.getMonth() + 1}`;
}

/** 타일 규격 → 화면 이름 */
function sizeLabelOf(spec: TileSpecInput): string {
  return `${spec.widthMm}×${spec.lengthMm}`;
}

/** 박스당 장 수 — 입력값 → 같은 규격 관례값 → 약 1.44㎡ 추정 순서 */
function piecesPerBoxOf(spec: TileSpecInput): number {
  if (spec.piecesPerBox && spec.piecesPerBox > 0) return Math.round(spec.piecesPerBox);
  const preset = TILE_SIZES.find(
    (s) =>
      (s.widthMm === spec.widthMm && s.lengthMm === spec.lengthMm) ||
      (s.widthMm === spec.lengthMm && s.lengthMm === spec.widthMm),
  );
  if (preset) return preset.piecesPerBox;
  const tileSqm = (spec.widthMm * spec.lengthMm) / 1e6;
  return Math.max(1, Math.round(1.44 / tileSqm));
}

/** 규격 코드 → 타일 입력 */
function specFromCode(code: string): TileSpecInput {
  const s = findTileSize(code) ?? TILE_SIZES[2];
  return { widthMm: s.widthMm, lengthMm: s.lengthMm, piecesPerBox: s.piecesPerBox };
}

/** 긴 변이 기준 이상인 대형 타일인지(자재·인건 가산 판정) */
function isOversize(spec: TileSpecInput): boolean {
  return Math.max(spec.widthMm, spec.lengthMm) >= LARGE_TILE_LONG_SIDE_MM;
}

/**
 * 박스처럼 쪼갤 수 없는 수량을 실별로 나눈다(바닥재·미장 계산기와 같은 방식):
 * 면적 비율로 나눈 뒤, 모자란 만큼을 소수부가 큰 실부터 하나씩 더 준다.
 */
function allocateWhole(rooms: { key: string; weight: number }[], total: number): Record<string, number> {
  const sum = rooms.reduce((s, r) => s + r.weight, 0);
  const out: Record<string, number> = {};
  if (sum <= 0 || total <= 0) {
    for (const r of rooms) out[r.key] = 0;
    return out;
  }
  const exact = rooms.map((r) => ({ key: r.key, v: (r.weight / sum) * total }));
  let used = 0;
  for (const e of exact) {
    const floor = Math.floor(e.v);
    out[e.key] = floor;
    used += floor;
  }
  const remain = Math.round(total - used);
  const sorted = [...exact].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)));
  for (let i = 0; i < remain; i += 1) out[sorted[i % sorted.length].key] += 1;
  return out;
}

// ── 면적 계산 ──────────────────────────────────

/** 계산 안에서 쓰는 실 하나의 면적 정리본 */
interface ResolvedRoom {
  key: string;
  name: string;
  kind: TileRoomKind;
  /** 벽 시공 면적(㎡, 빼는 면적 차감 후) */
  wallSqm: number;
  /** 바닥 시공 면적(㎡) */
  floorSqm: number;
  /** 철거 단가 종류 — 욕실 / 타일 바닥·벽 / 거실 마루 */
  demolishKind: 'bath' | 'tile' | 'floorFinish';
}

/** 욕실 하나의 벽·바닥 면적 — 벽 = 둘레×높이 − 문·창·욕조 앞판·직접 빼는 면적, 바닥 = 가로×세로 − 욕조 바닥 */
export function bathAreas(r: {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  doors?: number;
  windows?: number;
  tub?: boolean;
  openings?: TileOpeningInput[];
}): { wallSqm: number; floorSqm: number } {
  const w = r.widthMm / 1000;
  const d = r.depthMm / 1000;
  const h = r.heightMm / 1000;
  const doorSqm = (r.doors ?? 0) * DOOR_SIZE_M.widthM * DOOR_SIZE_M.heightM;
  const windowSqm = (r.windows ?? 0) * WINDOW_SIZE_M.widthM * WINDOW_SIZE_M.heightM;
  const tubFront = r.tub ? TUB_FRONT_M.lengthM * TUB_FRONT_M.heightM : 0;
  const custom = (r.openings ?? []).reduce((s, o) => s + (o.widthMm / 1000) * (o.heightMm / 1000) * o.count, 0);
  const wallSqm = Math.max(0, (w + d) * 2 * h - doorSqm - windowSqm - tubFront - custom);
  const floorSqm = Math.max(0, w * d - (r.tub ? TUB_FLOOR_M.lengthM * TUB_FLOOR_M.depthM : 0));
  return { wallSqm, floorSqm };
}

/** 평형 → 전용면적(㎡) — 도배·바닥재와 같은 환산표 */
function exclusiveSqmOf(pyeong: number): number {
  return PYEONG_TO_EXCLUSIVE_SQM[Math.round(pyeong)] ?? r1(pyeong * SQM_PER_PYEONG * EXCLUSIVE_RATIO.value);
}

/** 거실(+주방+복도) 바닥 면적 — 바닥재 계산기 "거실주방" 범위와 같은 62건 비율표(living·kitchen·etc) */
export function livingFloorSqm(pyeong: number, bay: 2 | 3 | 4): number {
  const q = calculateQuantity(exclusiveSqmOf(pyeong), { bay: String(bay) as BayKey });
  const keys = ['living', 'kitchen', 'etc'];
  return r1(q.rooms.filter((r) => keys.includes(r.key)).reduce((s, r) => s + r.area, 0));
}

/** 현관·베란다 기본 면적 — 34평 기준값을 평형에 비례해 늘리고 위아래를 자른다 */
function scaledSqm(at34: number, pyeong: number, min: number, max: number): number {
  return r1(Math.min(max, Math.max(min, (at34 * pyeong) / 34)));
}

// ── 본체 ──────────────────────────────────────

/** 타일 계산기 본체 — 입력 한 번으로 면적 → 수량 → 부자재 → 비용까지 */
export function calcTile(input: TileCalcInput): TileCalcResult {
  const assumed: TileAssumption[] = [];
  const isSimple = input.mode === 'simple';
  const scope: TileScope | undefined = isSimple ? input.scope ?? 'bath1' : undefined;
  const service: TileService = input.service ?? 'pro';
  const pattern: TilePattern = input.pattern ?? 'straight';
  if (!input.pattern) assumed.push('pattern');
  const grade: TileGrade = input.grade ?? 'mid';
  if (!input.grade) assumed.push('grade');
  const setting: TileSetting = input.setting ?? 'press';
  const groutMm = input.groutMm ?? DEFAULT_GROUT_MM;

  // 공법 — 거실은 덧방이 없다(덧방이 오면 철거 없음으로 본다), 거실 아닌 곳에 "철거 없음"이 오면 덧방으로 본다
  let method: TileMethod = input.method ?? defaultMethodFor(scope);
  if (!input.method) assumed.push('method');
  if (scope === 'living' && method === 'overlay') method = 'none';
  if (scope && scope !== 'living' && method === 'none') method = 'overlay';

  // ── 1) 실 목록 ──
  const rooms: ResolvedRoom[] = [];
  let pyeong: number | undefined;
  if (isSimple) {
    if (isBathScope(scope)) {
      const list = scope === 'bath2' ? BATH_PRESETS : BATH_PRESETS.filter((b) => b.key === 'common');
      for (const b of list) {
        const a = bathAreas({ ...b.dims, doors: SIMPLE_BATH_DOORS });
        rooms.push({ key: b.key, name: b.label, kind: 'bath', wallSqm: a.wallSqm, floorSqm: a.floorSqm, demolishKind: 'bath' });
      }
    } else {
      pyeong = input.pyeong ?? DEFAULT_PYEONG;
      if (input.pyeong === undefined) assumed.push('pyeong');
      if (scope === 'living') {
        rooms.push({ key: 'living', name: '거실·주방', kind: 'floor', wallSqm: 0, floorSqm: livingFloorSqm(pyeong, input.bay ?? DEFAULT_BAY), demolishKind: 'floorFinish' });
      } else if (scope === 'entrance') {
        rooms.push({ key: 'entrance', name: '현관', kind: 'floor', wallSqm: 0, floorSqm: scaledSqm(ENTRANCE_SQM_AT_34.value, pyeong, ENTRANCE_SQM_MIN, ENTRANCE_SQM_MAX), demolishKind: 'tile' });
      } else {
        rooms.push({ key: 'balcony', name: '베란다', kind: 'floor', wallSqm: 0, floorSqm: scaledSqm(BALCONY_SQM_AT_34.value, pyeong, BALCONY_SQM_MIN, BALCONY_SQM_MAX), demolishKind: 'tile' });
      }
    }
  } else {
    const src = input.rooms && input.rooms.length > 0 ? input.rooms : null;
    if (!src) assumed.push('rooms');
    const list: TileRoomInput[] = src ?? [{ kind: 'bath', name: '욕실1', doors: SIMPLE_BATH_DOORS }];
    const common = BATH_PRESETS.find((b) => b.key === 'common')!.dims;
    let dimsAssumed = false;
    list.forEach((r, i) => {
      const key = `room${i + 1}`;
      const name = r.name?.trim() || (r.kind === 'bath' ? `욕실${i + 1}` : r.kind === 'floor' ? `바닥${i + 1}` : `벽${i + 1}`);
      if (r.kind === 'bath') {
        // 비어 있는 치수는 84타입 공용욕실 추정값으로 채운다(가정 표시)
        if (r.widthMm === undefined || r.depthMm === undefined || r.heightMm === undefined) dimsAssumed = true;
        const a = bathAreas({
          widthMm: r.widthMm ?? common.widthMm,
          depthMm: r.depthMm ?? common.depthMm,
          heightMm: r.heightMm ?? common.heightMm,
          doors: r.doors ?? SIMPLE_BATH_DOORS,
          windows: r.windows,
          tub: r.tub,
          openings: r.openings,
        });
        rooms.push({ key, name, kind: 'bath', wallSqm: a.wallSqm, floorSqm: a.floorSqm, demolishKind: 'bath' });
      } else if (r.kind === 'floor') {
        let floorSqm = 0;
        if (r.areaSqm !== undefined) floorSqm = r.areaSqm;
        else if (r.widthMm !== undefined && r.depthMm !== undefined) floorSqm = (r.widthMm / 1000) * (r.depthMm / 1000);
        else dimsAssumed = true; // 치수 없는 바닥면은 0㎡ — 계산에서 빠진다
        rooms.push({ key, name, kind: 'floor', wallSqm: 0, floorSqm, demolishKind: 'tile' });
      } else {
        let wallSqm = 0;
        if (r.areaSqm !== undefined) wallSqm = r.areaSqm;
        else if (r.widthMm !== undefined && r.heightMm !== undefined) wallSqm = (r.widthMm / 1000) * (r.heightMm / 1000);
        else dimsAssumed = true;
        const doorSqm = (r.doors ?? 0) * DOOR_SIZE_M.widthM * DOOR_SIZE_M.heightM;
        const windowSqm = (r.windows ?? 0) * WINDOW_SIZE_M.widthM * WINDOW_SIZE_M.heightM;
        const custom = (r.openings ?? []).reduce((s, o) => s + (o.widthMm / 1000) * (o.heightMm / 1000) * o.count, 0);
        rooms.push({ key, name, kind: 'wall', wallSqm: Math.max(0, wallSqm - doorSqm - windowSqm - custom), floorSqm: 0, demolishKind: 'tile' });
      }
    });
    if (dimsAssumed) assumed.push('dims');
  }

  // ── 2) 타일 규격 ──
  // 간단 욕실: 칩 하나로 벽을 정하고 바닥은 관행대로(bathFloorCodeFor). 나머지 공간은 바닥만.
  let wallSpec: TileSpecInput;
  let floorSpec: TileSpecInput;
  if (isSimple) {
    const defaultCode = defaultSizeCodeFor(scope);
    if (isBathScope(scope)) {
      wallSpec = input.wallTile ?? specFromCode(defaultCode);
      floorSpec =
        input.floorTile ??
        specFromCode(bathFloorCodeFor(TILE_SIZES.find((s) => s.widthMm === wallSpec.widthMm && s.lengthMm === wallSpec.lengthMm)?.code ?? defaultCode));
      if (!input.wallTile && !input.floorTile) assumed.push('size');
    } else {
      floorSpec = input.floorTile ?? specFromCode(defaultCode);
      wallSpec = input.wallTile ?? specFromCode('300x600');
      if (!input.floorTile) assumed.push('size');
    }
  } else {
    wallSpec = input.wallTile ?? specFromCode('300x600');
    floorSpec = input.floorTile ?? specFromCode('600x600');
    if (!input.wallTile || !input.floorTile) assumed.push('size');
  }

  // ── 3) 벽·바닥 수량 ──
  const wallNet = rooms.reduce((s, r) => s + r.wallSqm, 0);
  const floorNet = rooms.reduce((s, r) => s + r.floorSqm, 0);
  const lossOf = (type: 'wall' | 'floor') => input.lossRate ?? LOSS_RATE[pattern][type];

  const surface = (net: number, spec: TileSpecInput, loss: number): TileSurfaceQuantity | null => {
    if (net <= 0) return null;
    const tileSqm = (spec.widthMm * spec.lengthMm) / 1e6;
    const ppb = piecesPerBoxOf(spec);
    const gross = net * (1 + loss);
    const pieces = ceilSafe(gross / tileSqm);
    const boxes = ceilSafe(pieces / ppb);
    return {
      sizeLabel: sizeLabelOf(spec),
      netSqm: r1(net),
      lossPct: Math.round(loss * 100),
      grossSqm: r1(gross),
      pieces,
      boxes,
      piecesPerBox: ppb,
      sqmPerBox: r2(ppb * tileSqm),
    };
  };
  const wall = surface(wallNet, wallSpec, lossOf('wall'));
  const floor = surface(floorNet, floorSpec, lossOf('floor'));

  // 실별 박스 배분(면적 비율)
  const wallAlloc = allocateWhole(rooms.map((r) => ({ key: r.key, weight: r.wallSqm })), wall?.boxes ?? 0);
  const floorAlloc = allocateWhole(rooms.map((r) => ({ key: r.key, weight: r.floorSqm })), floor?.boxes ?? 0);
  const byRoom: TileRoomQuantity[] = rooms.map((r) => ({
    key: r.key,
    name: r.name,
    wallSqm: r1(r.wallSqm),
    floorSqm: r1(r.floorSqm),
    wallBoxes: wallAlloc[r.key] ?? 0,
    floorBoxes: floorAlloc[r.key] ?? 0,
  }));

  // ── 4) 줄눈재 — ㎡당 줄눈 길이 = 1000/(가로+줄눈) + 1000/(세로+줄눈) (기하학, A) ──
  const groutPart = (net: number, spec: TileSpecInput) => {
    if (net <= 0) return { lengthM: 0, kg: 0 };
    const perSqmM = 1000 / (spec.widthMm + groutMm) + 1000 / (spec.lengthMm + groutMm);
    // 부피(L/㎡) = 길이(m) × 폭(mm) × 깊이(mm) ÷ 1000
    const litersPerSqm = (perSqmM * groutMm * GROUT_DEPTH_MM) / 1000;
    return { lengthM: net * perSqmM, kg: net * litersPerSqm * GROUT_DENSITY_KG_PER_L };
  };
  const gw = groutPart(wallNet, wallSpec);
  const gf = groutPart(floorNet, floorSpec);
  const groutKg = (gw.kg + gf.kg) * (1 + GROUT_LOSS_RATE);
  const groutBags = groutKg > 0 ? Math.max(1, ceilSafe(groutKg / GROUT_BAG_KG)) : 0;

  // ── 5) 붙임 자재 — 압착시멘트(대형은 두껍게) 또는 떠붙임 몰탈 ──
  const isMortarBed = setting === 'mortar';
  const adhesiveKgOf = (net: number, spec: TileSpecInput) =>
    net * (isMortarBed ? MORTAR_BED_KG_PER_SQM.value : isLargeTile(spec.widthMm, spec.lengthMm) ? ADHESIVE_KG_PER_SQM_LARGE.value : ADHESIVE_KG_PER_SQM.value);
  const adhesiveKg = adhesiveKgOf(wallNet, wallSpec) + adhesiveKgOf(floorNet, floorSpec);
  const adhesiveBagKg = isMortarBed ? MORTAR_BED_BAG_KG : ADHESIVE_BAG_KG;
  const adhesiveBags = adhesiveKg > 0 ? ceilSafe(adhesiveKg / adhesiveBagKg) : 0;
  const adhesiveName = isMortarBed ? '떠붙임 몰탈' : grade === 'high' ? '타일본드' : '압착시멘트';

  // ── 6) 품 수(맡김일 때만) ──
  const patternMult = PATTERN_LABOR_MULT[pattern];
  const bedMult = isMortarBed ? MORTAR_BED_LABOR_MULT : 1;
  const wallMult = patternMult * bedMult * (isOversize(wallSpec) ? LARGE_TILE_LABOR_MULT : 1);
  const floorMult = patternMult * bedMult * (isOversize(floorSpec) ? LARGE_TILE_LABOR_MULT : 1);
  let rawDays = 0;
  for (const r of rooms) {
    const floorProd = r.kind === 'bath' ? PRODUCTIVITY_BATH_SQM_PER_MANDAY.value : PRODUCTIVITY_FLOOR_SQM_PER_MANDAY.value;
    rawDays += (r.wallSqm / PRODUCTIVITY_BATH_SQM_PER_MANDAY.value) * wallMult + (r.floorSqm / floorProd) * floorMult;
  }
  const mandays =
    service === 'pro' && wallNet + floorNet > 0 ? Math.max(MIN_MANDAYS, Math.ceil(rawDays / MANDAY_STEP - 1e-9) * MANDAY_STEP) : 0;

  // ── 7) 비용 ──
  const breakdown: TileCostLine[] = [];
  let sumMin = 0;
  let sumMax = 0;
  const push = (line: Omit<TileCostLine, 'amountMin' | 'amountMax'>, min: number, max: number) => {
    const amountMin = Math.round(min);
    const amountMax = Math.round(max);
    sumMin += amountMin;
    sumMax += amountMax;
    breakdown.push({ ...line, amountMin, amountMax });
  };
  /** 수량 × 단가 범위 */
  const times = (qty: number, band: TilePriceBand, mult = 1) => [qty * band.min * mult, qty * band.max * mult] as const;

  // ① 자재 — 박스 수 × 박스당 ㎡ × ㎡당 단가(대형 가산)
  if (wall) {
    const band = WALL_TILE_PRICE[grade];
    const [a, b] = times(wall.boxes * wall.sqmPerBox, band, isOversize(wallSpec) ? LARGE_TILE_PRICE_MULT : 1);
    push({ key: 'wallTile', name: `벽타일 ${wall.sizeLabel}`, qty: wall.boxes, unit: '박스', layer: '자재', grade: isOversize(wallSpec) ? 'C' : band.grade, note: band.basis }, a, b);
  }
  if (floor) {
    const band = FLOOR_TILE_PRICE[grade];
    const [a, b] = times(floor.boxes * floor.sqmPerBox, band, isOversize(floorSpec) ? LARGE_TILE_PRICE_MULT : 1);
    push({ key: 'floorTile', name: `바닥타일 ${floor.sizeLabel}`, qty: floor.boxes, unit: '박스', layer: '자재', grade: isOversize(floorSpec) ? 'C' : band.grade, note: band.basis }, a, b);
  }

  // ② 부자재 — 붙임 자재·줄눈재·기타
  if (adhesiveBags > 0) {
    const band = isMortarBed ? MORTAR_BED_BAG_PRICE : ADHESIVE_BAG_PRICE[grade];
    const [a, b] = times(adhesiveBags, band);
    push({ key: 'adhesive', name: adhesiveName, qty: adhesiveBags, unit: '포', layer: '부자재', grade: band.grade, note: `${adhesiveBagKg}kg 포 · ${band.basis}` }, a, b);
  }
  if (groutBags > 0) {
    const [a, b] = times(groutBags, GROUT_BAG_PRICE);
    push({ key: 'grout', name: '줄눈재', qty: groutBags, unit: '포', layer: '부자재', grade: GROUT_BAG_PRICE.grade, note: `${GROUT_BAG_KG}kg 포 · 줄눈 ${groutMm}mm` }, a, b);
  }
  const netTotal = wallNet + floorNet;
  if (netTotal > 0) {
    const [a, b] = times(netTotal, MISC_SUBMATERIAL_PER_SQM);
    push({ key: 'misc', name: '기타 부자재', qty: r1(netTotal), unit: '㎡', layer: '부자재', grade: MISC_SUBMATERIAL_PER_SQM.grade, note: '코너비드·실리콘·모래 등' }, a, b);
  }

  if (service === 'pro') {
    // ③ 철거 — 철거 후 새로(거실은 기존 바닥 철거)일 때만
    if (method === 'demolish') {
      let dMin = 0;
      let dMax = 0;
      let dSqm = 0;
      let dGrade: 'A' | 'B' | 'C' = 'B';
      for (const r of rooms) {
        const area = r.wallSqm + r.floorSqm;
        const band = r.demolishKind === 'bath' ? BATH_DEMOLISH_PER_SQM : r.demolishKind === 'floorFinish' ? FLOOR_DEMOLISH_PER_SQM : TILE_DEMOLISH_PER_SQM;
        dMin += area * band.min;
        dMax += area * band.max;
        dSqm += area;
        if (band.grade === 'C') dGrade = 'C';
      }
      if (dSqm > 0) {
        const name = scope === 'living' ? '기존 바닥 철거·폐기물' : '타일 철거·폐기물';
        push({ key: 'demolish', name, qty: r1(dSqm), unit: '㎡', layer: '철거', grade: dGrade, note: '견적DB 철거 단가 ㎡ 환산' }, dMin, dMax);
      }
    }

    // ④ 방수 — 철거 후 새로 시공하는 욕실 칸마다
    const bathCount = rooms.filter((r) => r.kind === 'bath').length;
    if (WATERPROOF_ON_DEMOLISH && method === 'demolish' && bathCount > 0) {
      const [a, b] = times(bathCount, BATH_WATERPROOF_PER_ROOM);
      push({ key: 'waterproof', name: '욕실 방수', qty: bathCount, unit: '칸', layer: '방수', grade: BATH_WATERPROOF_PER_ROOM.grade, note: BATH_WATERPROOF_PER_ROOM.basis }, a, b);
    }

    // ⑤ 인건 — 품 수 × 타일공 1인 단가(욕실 2칸 할인율 반영, 지금은 0)
    if (mandays > 0) {
      const discount = scope === 'bath2' ? 1 - BATH2_DISCOUNT_RATE : 1;
      const [a, b] = times(mandays, TILE_LABOR_PER_MANDAY, discount);
      push({ key: 'labor', name: '타일 시공', qty: mandays, unit: '품', layer: '인건', grade: 'C', note: `타일공 ${mandays}품 · ${TILE_LABOR_PER_MANDAY.basis}` }, a, b);
    }

    // ⑥ 일반경비 — 위 합계에 비율
    const oMin = sumMin * TILE_OVERHEAD_RATE.min;
    const oMax = sumMax * TILE_OVERHEAD_RATE.max;
    push(
      {
        key: 'overhead',
        name: '일반경비',
        qty: 1,
        unit: '식',
        layer: '경비',
        grade: 'C',
        note: `합계의 ${Math.round(TILE_OVERHEAD_RATE.min * 100)}~${Math.round(TILE_OVERHEAD_RATE.max * 100)}%`,
      },
      oMin,
      oMax,
    );
  }

  // ── 8) 현장 확인 ──
  const checks: TileCheck[] = [];
  if (method === 'overlay') {
    checks.push('overlayConditions');
    const wallLarge = wallNet > 0 && isLargeTile(wallSpec.widthMm, wallSpec.lengthMm);
    const floorLarge = floorNet > 0 && isLargeTile(floorSpec.widthMm, floorSpec.lengthMm);
    if (wallLarge || floorLarge) checks.push('largeOverlay');
  }
  checks.push('lot');

  // ── 9) 견적DB 비교 범위 ──
  let marketRef: TileMarketRef | null = null;
  if (service === 'self') marketRef = MARKET_REF_BOX;
  else if (isBathScope(scope) || (!isSimple && rooms.some((r) => r.kind === 'bath'))) marketRef = MARKET_REF_BATH;
  else if (scope === 'entrance') marketRef = MARKET_REF_ENTRANCE;
  else if (scope === 'balcony') marketRef = MARKET_REF_BALCONY;

  return {
    resolved: {
      mode: input.mode,
      scope,
      method,
      methodLabel: methodLabel(scope, method),
      service,
      pattern,
      grade,
      groutMm,
      setting,
      pyeong,
    },
    quantity: {
      wall,
      floor,
      grout: { lengthM: r1(gw.lengthM + gf.lengthM), kg: r1(groutKg), bags: groutBags, bagKg: GROUT_BAG_KG, grade: 'C' },
      adhesive: { name: adhesiveName, kg: r1(adhesiveKg), bags: adhesiveBags, bagKg: adhesiveBagKg, grade: isMortarBed ? 'C' : 'B' },
      mandays,
      byRoom,
    },
    cost: {
      min: roundWon(sumMin),
      mid: roundWon((sumMin + sumMax) / 2),
      max: roundWon(sumMax),
      basisLine: `${baseMonthLabel()} 기준 · 견적DB 단가`,
      breakdown,
    },
    assumed,
    checks,
    marketRef,
  };
}
