// ──────────────────────────────────────────────
// 타일 계산기 — 오케스트레이터(서버 전용)
//
// 이 파일이 하는 일(미장·바닥재 계산기와 같은 흐름):
//   1) 공간(간단 모드) 또는 공간 하나 + 치수(정확 모드)를 받아 벽·바닥 시공 면적을 구한다
//      (욕실 벽 = 둘레×높이 − 문·창·욕조 / 바닥 = 가로×세로 / 거실 = 바닥재 계산기와 같은 62건 평면도 비율)
//   2) 타일 종류(도기질·자기질·포세린·대형 포세린)·규격을 정하고, 패턴·면별 로스율을 곱해 장 수 → 박스 수(올림)
//   3) 붙임 공법(압착·떠붙임·본드 — 안 고르면 자동 추천)별 접착 자재, 줄눈재(기본·컬러·에폭시),
//      코너비드·실리콘·기타 소모품 수량
//   4) 맡김이면 철거·방수·기공·조공·양중·경비까지, 셀프면 자재+부자재만 금액 범위를 만든다
//   5) 등급 3단(보급·중급·고급) 총액, 절약 팁용 "바꾸면 줄어드는 금액", 현장 확인 항목, 시장 견적 비교 4종
//
// 옛 정확 모드(실 카드 rooms[] 여러 장) 요청도 그대로 받는다 — 예전 공유 링크가 깨지지 않게.
//
// 내보내는 것: 물량 · 금액 범위 · 근거 문장 · 견적DB 비교 범위(n, 하위25%~상위25%).
// 내보내지 않는 것: 단가표 원본(㎡당·일당 단가), 계수(로스율 표·하루 시공량 등) 원본.
//   비용 줄에 단가 칸이 없는 것도 그 때문이다(금액 범위만 나간다).
//
// 작성일: 2026년 10월 03일
// 개편(종류·공법 추천·시공 조건·등급 3단·절약 금액): 2026년 10월 08일
// ──────────────────────────────────────────────

import 'server-only';

import { calculateQuantity } from '@/app/v3/data/quantity';
import type { BayKey } from '@/app/v3/data/types';
import { SQM_PER_PYEONG, EXCLUSIVE_RATIO, PYEONG_TO_EXCLUSIVE_SQM } from './schema/wallpaper-coefficients';
import {
  BATH_PRESETS,
  bathFloorCodeFor,
  bathFloorKindFor,
  defaultKindFor,
  defaultSizeForKind,
  findTileSize,
  isBathScope,
  isLargeTile,
  kindFromSize,
  kindLabel,
  methodLabel,
  recommendSetting,
  scopeSurface,
  settingLabel,
  spaceDimFields,
  spaceSurface,
  TILE_SIZES,
  type TileGrade,
  type TileGroutType,
  type TileKind,
  type TileMethod,
  type TilePattern,
  type TileRoomKind,
  type TileScope,
  type TileService,
  type TileSetting,
  type TileSpace,
  type TileSurface,
} from '@/lib/v1/tilePresets';
import {
  defaultMethodFor,
  defaultWaterproof,
  DOOR_SIZE_M,
  WINDOW_SIZE_M,
  TUB_FRONT_M,
  TUB_FLOOR_M,
  SIMPLE_BATH_DOORS,
  BATH2_DISCOUNT_RATE,
  ENTRANCE_SQM_AT_34,
  ENTRANCE_SQM_MIN,
  ENTRANCE_SQM_MAX,
  BALCONY_SQM_AT_34,
  BALCONY_SQM_MIN,
  BALCONY_SQM_MAX,
  KITCHEN_WALL_SQM_AT_34,
  KITCHEN_WALL_SQM_MIN,
  KITCHEN_WALL_SQM_MAX,
  DEFAULT_PYEONG,
  DEFAULT_BAY,
  LOSS_RATE,
  LARGE_TILE_MIN_LOSS,
  ADHESIVE_KG_PER_SQM,
  ADHESIVE_KG_PER_SQM_LARGE,
  ADHESIVE_BAG_KG,
  MORTAR_BED_KG_PER_SQM,
  MORTAR_BED_BAG_KG,
  BOND_KG_PER_SQM,
  BOND_KG_PER_SQM_LARGE,
  BOND_BAG_KG,
  GROUT_DEPTH_MM,
  GROUT_DENSITY_KG_PER_L,
  GROUT_LOSS_RATE,
  GROUT_BAG_KG,
  EPOXY_GROUT_BAG_KG,
  DEFAULT_GROUT_MM,
  CORNER_BEADS_PER,
  SILICONE_PER,
  PRODUCTIVITY_SQM_PER_DAY,
  SPACE_DIFFICULTY,
  HELPER_RATIO,
  HELPER_RATIO_LARGE_MIN,
  HELPER_MIN_DAYS,
  MIN_MANDAYS,
  MANDAY_STEP,
  PATTERN_LABOR_MULT,
  HEATED_FLOOR_LABOR_MULT,
  LARGE_TILE_LONG_SIDE_MM,
  type TileSizeClass,
} from './schema/tile-coefficients';
import {
  TILE_KIND_PRICE,
  TILE_LABOR_PER_MANDAY,
  TILE_HELPER_PER_MANDAY,
  LIFTING_PER_BOX,
  LIFTING_PER_BAG,
  BATH_DEMOLISH_PER_SQM,
  TILE_DEMOLISH_PER_SQM,
  FLOOR_DEMOLISH_PER_SQM,
  BATH_WATERPROOF_PER_ROOM,
  AREA_WATERPROOF_PER_SQM,
  ADHESIVE_BAG_PRICE,
  BOND_BAG_PRICE,
  MORTAR_BED_BAG_PRICE,
  GROUT_BAG_PRICE,
  COLOR_GROUT_BAG_PRICE,
  EPOXY_GROUT_BAG_PRICE,
  EPOXY_GROUT_LABOR_PER_SQM,
  CORNER_BEAD_PRICE,
  SILICONE_PRICE,
  MISC_SUBMATERIAL_PER_SQM,
  TILE_OVERHEAD_RATE,
  MARKET_REF_BATH,
  MARKET_REF_ENTRANCE,
  MARKET_REF_BALCONY,
  MARKET_REF_BOX,
  MARKET_REFS,
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

/** 옛 정확 모드 실 카드 하나(옛 공유 링크 호환) */
export interface TileRoomInput {
  /** 욕실(벽+바닥) / 바닥면 / 벽면 */
  kind: TileRoomKind;
  name?: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  areaSqm?: number;
  doors?: number;
  windows?: number;
  tub?: boolean;
  openings?: TileOpeningInput[];
}

/** 정확 모드 공간 하나의 치수 */
export interface TileSpaceDims {
  /** 가로(mm) — 주방 벽이면 벽 길이 */
  widthMm?: number;
  /** 세로(mm) — 욕실 벽·바닥면만 */
  depthMm?: number;
  /** 높이(mm) — 욕실 벽·주방 벽만 */
  heightMm?: number;
  /** 문 개수(욕실 벽 기본 1) */
  doors?: number;
  /** 창 개수 */
  windows?: number;
  /** 욕조 있음(욕실 벽·바닥) */
  tub?: boolean;
}

/** 타일 계산 입력 — 안 보낸 값은 서버 기본값으로 계산하고 assumed[]에 적는다 */
export interface TileCalcInput {
  mode: 'simple' | 'precise';
  /** 간단 모드 공간 */
  scope?: TileScope;
  /** 정확 모드 공간(새 흐름) */
  space?: TileSpace;
  /** 정확 모드 치수(새 흐름) */
  dims?: TileSpaceDims;
  /** 철거 후 새로 / 덧방 / 철거 없음(거실) */
  method?: TileMethod;
  service?: TileService;
  /** 거실·현관·베란다·주방 평형(간단 모드) */
  pyeong?: number;
  bay?: 2 | 3 | 4;
  pattern?: TilePattern;
  grade?: TileGrade;
  /** 타일 종류 — 욕실(간단)은 벽 기준, 바닥은 관행대로 따라간다 */
  tileKind?: TileKind;
  /** 줄눈 폭(mm) */
  groutMm?: number;
  /** 줄눈 종류 */
  groutType?: TileGroutType;
  /** 붙임 공법 — 없으면 면·종류별 자동 추천 */
  setting?: TileSetting;
  /** 방수 — 없으면 욕실+철거면 켬 */
  waterproof?: boolean;
  /** 바닥 난방 위 시공 */
  heated?: boolean;
  /** 코너비드 — 없으면 벽이 있으면 켬 */
  cornerBead?: boolean;
  /** 실리콘 — 없으면 켬 */
  silicone?: boolean;
  /** 로스율 직접 지정(0~0.3) — 없으면 패턴·면 기본값 */
  lossRate?: number;
  /** 옛 정확 모드 실 카드 */
  rooms?: TileRoomInput[];
  wallTile?: TileSpecInput;
  floorTile?: TileSpecInput;
}

// ── 출력 타입 ──────────────────────────────────

/** 벽 또는 바닥 한쪽 수량 */
export interface TileSurfaceQuantity {
  /** 타일 규격 이름(예: "300×600") */
  sizeLabel: string;
  /** 타일 종류 */
  kind: TileKind;
  kindLabel: string;
  /** 붙임 공법 */
  setting: TileSetting;
  settingLabel: string;
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

/** 붙임 자재 한 가지(압착시멘트·떠붙임 몰탈·타일본드) */
export interface TileAdhesiveQuantity {
  key: 'press' | 'mortar' | 'bond';
  name: string;
  kg: number;
  bags: number;
  bagKg: number;
  /** 포 단위 이름(포·통) */
  bagUnit: string;
}

/** 비용 층 */
export type TileCostLayer = '자재' | '부자재' | '방수' | '철거' | '인건' | '경비';

/** 비용 한 줄 — 단가 칸 없이 수량·금액 범위만 */
export interface TileCostLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  amountMin: number;
  amountMax: number;
  layer: TileCostLayer;
  /** C면 화면에 "추정" 표식 */
  grade: 'A' | 'B' | 'C';
  note: string;
}

/** 가정한 값의 종류 */
export type TileAssumption = 'method' | 'size' | 'kind' | 'setting' | 'pyeong' | 'pattern' | 'grade' | 'dims' | 'rooms';

/** 현장 확인 항목 키 — 화면이 문구로 바꾼다 */
export type TileCheck = 'overlayConditions' | 'largeOverlay' | 'lot' | 'heatedFloor' | 'noWaterproof';

/** 절약 금액 한 가지(바꾸면 중간값이 이만큼 준다) — 팁 문구는 화면이 만든다 */
export interface TileSaving {
  key: 'overlay' | 'basicGrade' | 'smallerTile' | 'cementGrout' | 'straightPattern';
  /** 줄어드는 금액(중간값 기준, 원) */
  amount: number;
}

/** 타일 계산 결과 */
export interface TileCalcResult {
  /** 실제로 쓴 값(가정 포함) — 화면 요약·가정 문구용 */
  resolved: {
    mode: 'simple' | 'precise';
    scope?: TileScope;
    space?: TileSpace;
    surface: TileSurface;
    method: TileMethod;
    methodLabel: string;
    service: TileService;
    pattern: TilePattern;
    grade: TileGrade;
    groutMm: number;
    groutType: TileGroutType;
    /** 대표 면(벽 우선)의 종류·공법 */
    tileKind: TileKind;
    setting: TileSetting;
    /** 공법을 사용자가 안 골라 추천값을 썼는지 */
    settingRecommended: boolean;
    waterproof: boolean;
    heated: boolean;
    cornerBead: boolean;
    silicone: boolean;
    /** 거실·현관·베란다·주방일 때만 */
    pyeong?: number;
  };
  quantity: {
    wall: TileSurfaceQuantity | null;
    floor: TileSurfaceQuantity | null;
    grout: { lengthM: number; kg: number; bags: number; bagKg: number; type: TileGroutType; grade: 'A' | 'B' | 'C' };
    adhesives: TileAdhesiveQuantity[];
    cornerBeads: number;
    siliconeTubes: number;
    /** 기공 일수(맡김일 때만, 셀프면 0) — 옛 이름 mandays와 같다 */
    mandays: number;
    /** 조공 일수 */
    helperDays: number;
    byRoom: TileRoomQuantity[];
    /** 옛 정확 모드에서 치수가 덜 들어가 계산에서 뺀 실 수 */
    skippedRooms: number;
  };
  cost: {
    min: number;
    mid: number;
    max: number;
    basisLine: string;
    breakdown: TileCostLine[];
    /** 등급 3단 총액(다른 조건은 그대로) */
    gradeTotals: Record<TileGrade, { min: number; max: number }>;
    /** 바꾸면 줄어드는 금액(큰 것부터) */
    savings: TileSaving[];
  };
  assumed: TileAssumption[];
  checks: TileCheck[];
  /** 내 조건과 맞는 견적DB 비교 범위(없으면 null) */
  marketRef: TileMarketRef | null;
  /** 시장 견적 비교 4종(욕실·현관·베란다·1박스) */
  marketRefs: TileMarketRef[];
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
/** 0.5 단위 올림 */
function ceilStep(n: number): number {
  return Math.ceil(n / MANDAY_STEP - 1e-9) * MANDAY_STEP;
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

/** 타일 입력 → 규격 코드(목록에 없으면 null) */
function codeOfSpec(spec: TileSpecInput): string | null {
  return TILE_SIZES.find((s) => (s.widthMm === spec.widthMm && s.lengthMm === spec.lengthMm) || (s.widthMm === spec.lengthMm && s.lengthMm === spec.widthMm))?.code ?? null;
}

/** 긴 변이 기준 이상인 대형 타일인지(크기 묶음 L·로스 하한) */
function isOversize(spec: TileSpecInput): boolean {
  return Math.max(spec.widthMm, spec.lengthMm) >= LARGE_TILE_LONG_SIDE_MM;
}

/** 크기 묶음 — 대형(긴 변 800↑) L / 600각 이상 M / 그 아래 S */
function sizeClassOf(spec: TileSpecInput): TileSizeClass {
  if (isOversize(spec)) return 'L';
  if (Math.min(spec.widthMm, spec.lengthMm) >= 600) return 'M';
  return 'S';
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

/** 공간 성격 — 하루 시공량 난이도·코너비드·실리콘 개수를 가른다 */
type Place = 'bath' | 'kitchen' | 'entrance' | 'balcony' | 'living' | 'generic';

/** 계산 안에서 쓰는 실 하나의 면적 정리본 */
interface ResolvedRoom {
  key: string;
  name: string;
  place: Place;
  /** 벽 시공 면적(㎡, 빼는 면적 차감 후) */
  wallSqm: number;
  /** 바닥 시공 면적(㎡) */
  floorSqm: number;
  /** 철거 단가 종류 — 욕실 / 타일 바닥·벽 / 거실 마루 */
  demolishKind: 'bath' | 'tile' | 'floorFinish';
  /** 욕실 칸으로 세는지(방수 칸 단가) */
  isBath: boolean;
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

/** 현관·베란다·주방 벽 기본 면적 — 34평 기준값을 평형에 비례해 늘리고 위아래를 자른다 */
function scaledSqm(at34: number, pyeong: number, min: number, max: number): number {
  return r1(Math.min(max, Math.max(min, (at34 * pyeong) / 34)));
}

/** 치수가 덜 들어갔을 때 던지는 오류(검증 단계가 400으로 먼저 막는다) */
export class TileIncompleteError extends Error {}

/**
 * 옛 실 카드 치수가 다 들어갔는지 — 욕실: 가로·세로·높이 / 바닥면: 면적 또는 가로·세로 / 벽면: 면적 또는 길이·높이.
 */
export function tileRoomComplete(r: TileRoomInput): boolean {
  if (r.kind === 'bath') return r.widthMm !== undefined && r.depthMm !== undefined && r.heightMm !== undefined;
  if (r.kind === 'floor') return r.areaSqm !== undefined || (r.widthMm !== undefined && r.depthMm !== undefined);
  return r.areaSqm !== undefined || (r.widthMm !== undefined && r.heightMm !== undefined);
}

/** 정확 모드 공간 치수가 다 들어갔는지(검증·계산 공용) */
export function spaceDimsComplete(space: TileSpace, dims: TileSpaceDims | undefined): boolean {
  if (!dims) return false;
  return spaceDimFields(space).every((f) => dims[f] !== undefined);
}

/** 정확 모드 공간 → 실 정리본 하나 */
function roomFromSpace(space: TileSpace, dims: TileSpaceDims): ResolvedRoom {
  const w = (dims.widthMm as number) / 1000;
  const d = (dims.depthMm ?? 0) / 1000;
  const h = (dims.heightMm ?? 0) / 1000;
  const windowSqm = (dims.windows ?? 0) * WINDOW_SIZE_M.widthM * WINDOW_SIZE_M.heightM;
  switch (space) {
    case 'bathWall': {
      const a = bathAreas({ widthMm: dims.widthMm as number, depthMm: dims.depthMm as number, heightMm: dims.heightMm as number, doors: dims.doors ?? SIMPLE_BATH_DOORS, windows: dims.windows, tub: dims.tub });
      return { key: 'room1', name: '욕실 벽', place: 'bath', wallSqm: a.wallSqm, floorSqm: 0, demolishKind: 'bath', isBath: true };
    }
    case 'bathFloor': {
      const floorSqm = Math.max(0, w * d - (dims.tub ? TUB_FLOOR_M.lengthM * TUB_FLOOR_M.depthM : 0));
      return { key: 'room1', name: '욕실 바닥', place: 'bath', wallSqm: 0, floorSqm, demolishKind: 'bath', isBath: true };
    }
    case 'kitchenWall':
      return { key: 'room1', name: '주방 벽', place: 'kitchen', wallSqm: Math.max(0, w * h - windowSqm), floorSqm: 0, demolishKind: 'tile', isBath: false };
    case 'entrance':
      return { key: 'room1', name: '현관', place: 'entrance', wallSqm: 0, floorSqm: w * d, demolishKind: 'tile', isBath: false };
    case 'balcony':
      return { key: 'room1', name: '베란다', place: 'balcony', wallSqm: 0, floorSqm: w * d, demolishKind: 'tile', isBath: false };
    default:
      return { key: 'room1', name: '거실·방 바닥', place: 'living', wallSqm: 0, floorSqm: w * d, demolishKind: 'floorFinish', isBath: false };
  }
}

// ── 본체 ──────────────────────────────────────

/** 등급 3단·절약 금액 없이 한 번 계산한 결과 */
type CoreResult = Omit<TileCalcResult, 'cost'> & { cost: Omit<TileCalcResult['cost'], 'gradeTotals' | 'savings'> };

/** 계산 한 번 — 면적 → 수량 → 부자재 → 비용 */
function calcCore(input: TileCalcInput): CoreResult {
  const assumed: TileAssumption[] = [];
  const isSimple = input.mode === 'simple';
  const scope: TileScope | undefined = isSimple ? input.scope ?? 'bath1' : undefined;
  // 정확 모드 새 흐름(공간 하나) — 공간이 없고 옛 실 카드가 오면 옛 흐름으로 계산한다
  const space: TileSpace | undefined = !isSimple && input.space ? input.space : undefined;
  const legacyRooms = !isSimple && !space;
  const service: TileService = input.service ?? 'pro';
  const pattern: TilePattern = input.pattern ?? 'straight';
  if (!input.pattern) assumed.push('pattern');
  const grade: TileGrade = input.grade ?? 'mid';
  if (!input.grade) assumed.push('grade');
  const groutMm = input.groutMm ?? DEFAULT_GROUT_MM;
  const groutType: TileGroutType = input.groutType ?? 'cement';

  // 붙이는 면 — 간단은 공간에서, 정확은 공간에서, 옛 실 카드는 실 종류에서
  const surface: TileSurface = scope ? scopeSurface(scope) : space ? spaceSurface(space) : 'both';
  const isLivingPlace = scope === 'living' || space === 'livingFloor';

  // 공법 — 거실은 덧방이 없다(덧방이 오면 철거 없음으로 본다), 거실 아닌 곳에 "철거 없음"이 오면 덧방으로 본다
  let method: TileMethod = input.method ?? defaultMethodFor(scope ?? space);
  if (!input.method) assumed.push('method');
  if (isLivingPlace && method === 'overlay') method = 'none';
  if (!isLivingPlace && method === 'none') method = 'overlay';

  // ── 1) 실 목록 ──
  const rooms: ResolvedRoom[] = [];
  let pyeong: number | undefined;
  let skippedRooms = 0;
  if (isSimple) {
    if (isBathScope(scope)) {
      const list = scope === 'bath2' ? BATH_PRESETS : BATH_PRESETS.filter((b) => b.key === 'common');
      for (const b of list) {
        const a = bathAreas({ ...b.dims, doors: SIMPLE_BATH_DOORS });
        rooms.push({ key: b.key, name: b.label, place: 'bath', wallSqm: a.wallSqm, floorSqm: a.floorSqm, demolishKind: 'bath', isBath: true });
      }
    } else {
      pyeong = input.pyeong ?? DEFAULT_PYEONG;
      if (input.pyeong === undefined) assumed.push('pyeong');
      if (scope === 'living') {
        rooms.push({ key: 'living', name: '거실·주방', place: 'living', wallSqm: 0, floorSqm: livingFloorSqm(pyeong, input.bay ?? DEFAULT_BAY), demolishKind: 'floorFinish', isBath: false });
      } else if (scope === 'entrance') {
        rooms.push({ key: 'entrance', name: '현관', place: 'entrance', wallSqm: 0, floorSqm: scaledSqm(ENTRANCE_SQM_AT_34.value, pyeong, ENTRANCE_SQM_MIN, ENTRANCE_SQM_MAX), demolishKind: 'tile', isBath: false });
      } else if (scope === 'kitchen') {
        rooms.push({ key: 'kitchen', name: '주방 벽', place: 'kitchen', wallSqm: scaledSqm(KITCHEN_WALL_SQM_AT_34.value, pyeong, KITCHEN_WALL_SQM_MIN, KITCHEN_WALL_SQM_MAX), floorSqm: 0, demolishKind: 'tile', isBath: false });
      } else {
        rooms.push({ key: 'balcony', name: '베란다', place: 'balcony', wallSqm: 0, floorSqm: scaledSqm(BALCONY_SQM_AT_34.value, pyeong, BALCONY_SQM_MIN, BALCONY_SQM_MAX), demolishKind: 'tile', isBath: false });
      }
    }
  } else if (space) {
    // 새 흐름 — 치수가 덜 들어갔으면 계산하지 않는다(API는 검증 단계에서 400으로 먼저 막는다)
    if (!spaceDimsComplete(space, input.dims)) throw new TileIncompleteError('치수를 다 넣어 주세요');
    rooms.push(roomFromSpace(space, input.dims as TileSpaceDims));
  } else {
    // 옛 흐름 — 실 카드 여러 장(치수가 다 들어간 실만)
    const src = input.rooms && input.rooms.length > 0 ? input.rooms : null;
    if (!src) assumed.push('rooms');
    const list: TileRoomInput[] = src ? src.filter(tileRoomComplete) : [{ kind: 'bath', name: '욕실1', doors: SIMPLE_BATH_DOORS, ...BATH_PRESETS.find((b) => b.key === 'common')!.dims }];
    skippedRooms = src ? src.length - list.length : 0;
    if (list.length === 0) throw new TileIncompleteError('치수를 다 넣은 실이 없습니다');
    list.forEach((r, i) => {
      const key = `room${i + 1}`;
      const name = r.name?.trim() || (r.kind === 'bath' ? `욕실${i + 1}` : r.kind === 'floor' ? `바닥${i + 1}` : `벽${i + 1}`);
      if (r.kind === 'bath') {
        const a = bathAreas({ widthMm: r.widthMm as number, depthMm: r.depthMm as number, heightMm: r.heightMm as number, doors: r.doors ?? SIMPLE_BATH_DOORS, windows: r.windows, tub: r.tub, openings: r.openings });
        rooms.push({ key, name, place: 'bath', wallSqm: a.wallSqm, floorSqm: a.floorSqm, demolishKind: 'bath', isBath: true });
      } else if (r.kind === 'floor') {
        const floorSqm = r.areaSqm !== undefined ? r.areaSqm : ((r.widthMm as number) / 1000) * ((r.depthMm as number) / 1000);
        rooms.push({ key, name, place: 'generic', wallSqm: 0, floorSqm, demolishKind: 'tile', isBath: false });
      } else {
        const wallSqm = r.areaSqm !== undefined ? r.areaSqm : ((r.widthMm as number) / 1000) * ((r.heightMm as number) / 1000);
        const doorSqm = (r.doors ?? 0) * DOOR_SIZE_M.widthM * DOOR_SIZE_M.heightM;
        const windowSqm = (r.windows ?? 0) * WINDOW_SIZE_M.widthM * WINDOW_SIZE_M.heightM;
        const custom = (r.openings ?? []).reduce((s, o) => s + (o.widthMm / 1000) * (o.heightMm / 1000) * o.count, 0);
        rooms.push({ key, name, place: 'generic', wallSqm: Math.max(0, wallSqm - doorSqm - windowSqm - custom), floorSqm: 0, demolishKind: 'tile', isBath: false });
      }
    });
  }

  // ── 2) 타일 종류·규격 ──
  // 대표 종류: 사용자가 고른 값 → (옛 요청) 규격에서 추정 → 공간 기본값
  const place = scope ?? space;
  const mainSurface: 'wall' | 'floor' = surface === 'floor' ? 'floor' : 'wall';
  const mainSpecIn = mainSurface === 'wall' ? input.wallTile : input.floorTile;
  let wallKind: TileKind;
  let floorKind: TileKind;
  if (input.tileKind) {
    wallKind = input.tileKind;
    // 욕실(간단·옛 실 카드)은 바닥이 관행대로 따라간다, 바닥 공간은 고른 종류 그대로
    floorKind = surface === 'floor' ? input.tileKind : bathFloorKindFor(input.tileKind);
  } else {
    assumed.push('kind');
    wallKind = input.wallTile ? kindFromSize(input.wallTile.widthMm, input.wallTile.lengthMm, 'wall') : defaultKindFor(mainSurface === 'wall' ? 'wall' : 'floor', place);
    floorKind = input.floorTile
      ? kindFromSize(input.floorTile.widthMm, input.floorTile.lengthMm, 'floor')
      : surface === 'floor'
        ? defaultKindFor('floor', place)
        : bathFloorKindFor(wallKind);
  }
  // 바닥에 도기질은 쓰지 않는다 — 혹시 오면 자기질로 계산한다
  if (floorKind === 'earthenware') floorKind = 'stoneware';

  const wallSpec: TileSpecInput = input.wallTile ?? specFromCode(defaultSizeForKind(wallKind, 'wall'));
  const floorSpec: TileSpecInput =
    input.floorTile ??
    (surface === 'floor'
      ? specFromCode(defaultSizeForKind(floorKind, 'floor'))
      : specFromCode(bathFloorCodeFor(codeOfSpec(wallSpec) ?? '300x600')));
  if (!mainSpecIn) assumed.push('size');

  // ── 3) 붙임 공법 — 고른 값이 없으면 면·종류별 추천 ──
  const recWall = recommendSetting('wall', wallKind).setting;
  const recFloor = recommendSetting('floor', floorKind).setting;
  const wallSetting: TileSetting = input.setting ?? recWall;
  const floorSetting: TileSetting = input.setting ?? recFloor;
  if (!input.setting) assumed.push('setting');
  const mainSetting = mainSurface === 'wall' ? wallSetting : floorSetting;
  const settingRecommended = !input.setting || input.setting === (mainSurface === 'wall' ? recWall : recFloor);

  // ── 4) 시공 조건 ──
  const anyBath = rooms.some((r) => r.isBath);
  const waterproof = input.waterproof ?? defaultWaterproof(anyBath, method);
  const heated = input.heated ?? false;
  const wallNet = rooms.reduce((s, r) => s + r.wallSqm, 0);
  const floorNet = rooms.reduce((s, r) => s + r.floorSqm, 0);
  const cornerBead = input.cornerBead ?? wallNet > 0;
  const silicone = input.silicone ?? true;

  // ── 5) 벽·바닥 수량 ──
  const lossOf = (type: 'wall' | 'floor', spec: TileSpecInput) =>
    input.lossRate ?? Math.max(LOSS_RATE[pattern][type], isOversize(spec) ? LARGE_TILE_MIN_LOSS : 0);

  const surfaceQty = (net: number, spec: TileSpecInput, loss: number, kind: TileKind, setting: TileSetting): TileSurfaceQuantity | null => {
    if (net <= 0) return null;
    const tileSqm = (spec.widthMm * spec.lengthMm) / 1e6;
    const ppb = piecesPerBoxOf(spec);
    const gross = net * (1 + loss);
    const pieces = ceilSafe(gross / tileSqm);
    const boxes = ceilSafe(pieces / ppb);
    return {
      sizeLabel: sizeLabelOf(spec),
      kind,
      kindLabel: kindLabel(kind),
      setting,
      settingLabel: settingLabel(setting),
      netSqm: r1(net),
      lossPct: Math.round(loss * 100),
      grossSqm: r1(gross),
      pieces,
      boxes,
      piecesPerBox: ppb,
      sqmPerBox: r2(ppb * tileSqm),
    };
  };
  const wall = surfaceQty(wallNet, wallSpec, lossOf('wall', wallSpec), wallKind, wallSetting);
  const floor = surfaceQty(floorNet, floorSpec, lossOf('floor', floorSpec), floorKind, floorSetting);

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

  // ── 6) 줄눈재 — ㎡당 줄눈 길이 = 1000/(가로+줄눈) + 1000/(세로+줄눈) (기하학, A) ──
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
  const groutBagKg = groutType === 'epoxy' ? EPOXY_GROUT_BAG_KG : GROUT_BAG_KG;
  const groutBags = groutKg > 0 ? Math.max(1, ceilSafe(groutKg / groutBagKg)) : 0;

  // ── 7) 붙임 자재 — 면마다 공법이 다를 수 있어(욕실: 벽 압착·바닥 떠붙임) 공법별로 묶는다 ──
  const adhesiveKgOf = (net: number, spec: TileSpecInput, setting: TileSetting) => {
    if (net <= 0) return 0;
    if (setting === 'mortar') return net * MORTAR_BED_KG_PER_SQM.value;
    if (setting === 'bond') return net * (isOversize(spec) ? BOND_KG_PER_SQM_LARGE.value : BOND_KG_PER_SQM.value);
    return net * (isLargeTile(spec.widthMm, spec.lengthMm) ? ADHESIVE_KG_PER_SQM_LARGE.value : ADHESIVE_KG_PER_SQM.value);
  };
  const adhesiveKgBy: Record<TileSetting, number> = { press: 0, mortar: 0, bond: 0 };
  adhesiveKgBy[wallSetting] += adhesiveKgOf(wallNet, wallSpec, wallSetting);
  adhesiveKgBy[floorSetting] += adhesiveKgOf(floorNet, floorSpec, floorSetting);
  const ADHESIVE_META: Record<TileSetting, { name: string; bagKg: number; bagUnit: string }> = {
    press: { name: '압착시멘트', bagKg: ADHESIVE_BAG_KG, bagUnit: '포' },
    mortar: { name: '떠붙임 몰탈', bagKg: MORTAR_BED_BAG_KG, bagUnit: '포' },
    bond: { name: '타일본드', bagKg: BOND_BAG_KG, bagUnit: '통' },
  };
  const adhesives: TileAdhesiveQuantity[] = (['press', 'mortar', 'bond'] as const)
    .filter((k) => adhesiveKgBy[k] > 0)
    .map((k) => ({ key: k, name: ADHESIVE_META[k].name, kg: r1(adhesiveKgBy[k]), bags: ceilSafe(adhesiveKgBy[k] / ADHESIVE_META[k].bagKg), bagKg: ADHESIVE_META[k].bagKg, bagUnit: ADHESIVE_META[k].bagUnit }));

  // ── 8) 코너비드·실리콘 개수 ──
  let cornerBeads = 0;
  let siliconeTubes = 0;
  for (const r of rooms) {
    if (cornerBead && r.wallSqm > 0) cornerBeads += r.place === 'bath' ? CORNER_BEADS_PER.bath : r.place === 'kitchen' ? CORNER_BEADS_PER.kitchen : CORNER_BEADS_PER.wallGeneric;
    if (silicone && r.wallSqm + r.floorSqm > 0) siliconeTubes += SILICONE_PER[r.place];
  }

  // ── 9) 기공·조공 일수(맡김일 때만) — 공법·크기별 하루 시공량 × 공간 난이도 ──
  const patternMult = PATTERN_LABOR_MULT[pattern];
  let rawSkilled = 0;
  let rawHelper = 0;
  const helperRatio = (setting: TileSetting, spec: TileSpecInput) =>
    isOversize(spec) ? Math.max(HELPER_RATIO[setting], HELPER_RATIO_LARGE_MIN) : HELPER_RATIO[setting];
  for (const r of rooms) {
    const diff = SPACE_DIFFICULTY[r.place];
    if (r.wallSqm > 0) {
      const days = (r.wallSqm / (PRODUCTIVITY_SQM_PER_DAY[wallSetting][sizeClassOf(wallSpec)] * diff)) * patternMult;
      rawSkilled += days;
      rawHelper += days * helperRatio(wallSetting, wallSpec);
    }
    if (r.floorSqm > 0) {
      const days = (r.floorSqm / (PRODUCTIVITY_SQM_PER_DAY[floorSetting][sizeClassOf(floorSpec)] * diff)) * patternMult * (heated ? HEATED_FLOOR_LABOR_MULT : 1);
      rawSkilled += days;
      rawHelper += days * helperRatio(floorSetting, floorSpec);
    }
  }
  const isPro = service === 'pro';
  const mandays = isPro && wallNet + floorNet > 0 ? Math.max(MIN_MANDAYS, ceilStep(rawSkilled)) : 0;
  // 조공이 반나절도 안 되는 작은 일(현관·주방 벽 등)은 기공 혼자 한다 — 0.5일 미만이면 조공 없음
  const helperDays = isPro && rawHelper >= HELPER_MIN_DAYS ? ceilStep(rawHelper) : 0;

  // ── 10) 비용 ──
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

  // ① 자재 — 박스 수 × 박스당 ㎡ × 종류·등급별 ㎡당 단가
  if (wall) {
    const band = TILE_KIND_PRICE[wall.kind][grade];
    const [a, b] = times(wall.boxes * wall.sqmPerBox, band);
    push({ key: 'wallTile', name: `벽타일 ${wall.kindLabel} ${wall.sizeLabel}`, qty: wall.boxes, unit: '박스', layer: '자재', grade: band.grade, note: band.basis }, a, b);
  }
  if (floor) {
    const band = TILE_KIND_PRICE[floor.kind][grade];
    const [a, b] = times(floor.boxes * floor.sqmPerBox, band);
    push({ key: 'floorTile', name: `바닥타일 ${floor.kindLabel} ${floor.sizeLabel}`, qty: floor.boxes, unit: '박스', layer: '자재', grade: band.grade, note: band.basis }, a, b);
  }

  // ② 부자재 — 붙임 자재·줄눈재·코너비드·실리콘·기타
  const ADHESIVE_PRICE: Record<TileSetting, TilePriceBand> = { press: ADHESIVE_BAG_PRICE, mortar: MORTAR_BED_BAG_PRICE, bond: BOND_BAG_PRICE };
  for (const ad of adhesives) {
    const band = ADHESIVE_PRICE[ad.key];
    const [a, b] = times(ad.bags, band);
    push({ key: `adhesive-${ad.key}`, name: ad.name, qty: ad.bags, unit: ad.bagUnit, layer: '부자재', grade: band.grade, note: `${ad.kg}kg · ${ad.bagKg}kg ${ad.bagUnit}` }, a, b);
  }
  if (groutBags > 0) {
    const band = groutType === 'epoxy' ? EPOXY_GROUT_BAG_PRICE : groutType === 'color' ? COLOR_GROUT_BAG_PRICE : GROUT_BAG_PRICE;
    const name = groutType === 'epoxy' ? '에폭시 줄눈' : groutType === 'color' ? '컬러 줄눈재' : '줄눈재';
    const [a, b] = times(groutBags, band);
    push({ key: 'grout', name, qty: groutBags, unit: groutType === 'epoxy' ? '세트' : '포', layer: '부자재', grade: band.grade, note: `${r1(groutKg)}kg · 줄눈 ${groutMm}mm` }, a, b);
  }
  if (cornerBeads > 0) {
    const [a, b] = times(cornerBeads, CORNER_BEAD_PRICE);
    push({ key: 'cornerBead', name: '코너비드', qty: cornerBeads, unit: '개', layer: '부자재', grade: CORNER_BEAD_PRICE.grade, note: '2.4m · 모서리 마감' }, a, b);
  }
  if (siliconeTubes > 0) {
    const [a, b] = times(siliconeTubes, SILICONE_PRICE);
    push({ key: 'silicone', name: '실리콘', qty: siliconeTubes, unit: '개', layer: '부자재', grade: SILICONE_PRICE.grade, note: '바이오 실리콘 270ml' }, a, b);
  }
  const netTotal = wallNet + floorNet;
  if (netTotal > 0) {
    const [a, b] = times(netTotal, MISC_SUBMATERIAL_PER_SQM);
    push({ key: 'misc', name: '기타 소모품', qty: r1(netTotal), unit: '㎡', layer: '부자재', grade: MISC_SUBMATERIAL_PER_SQM.grade, note: '모래·스페이서·청소' }, a, b);
  }

  if (isPro) {
    // ③ 방수 — 욕실은 칸마다, 욕실 밖은 바닥 ㎡로
    if (waterproof) {
      const bathCount = rooms.filter((r) => r.isBath).length;
      if (bathCount > 0) {
        const [a, b] = times(bathCount, BATH_WATERPROOF_PER_ROOM);
        push({ key: 'waterproof', name: '방수(재료+시공)', qty: bathCount, unit: '칸', layer: '방수', grade: BATH_WATERPROOF_PER_ROOM.grade, note: `${BATH_WATERPROOF_PER_ROOM.basis} · 바닥+벽 하단` }, a, b);
      } else {
        const area = rooms.reduce((s, r) => s + (r.floorSqm > 0 ? r.floorSqm : r.wallSqm), 0);
        if (area > 0) {
          const [a, b] = times(area, AREA_WATERPROOF_PER_SQM);
          push({ key: 'waterproof', name: '방수(재료+시공)', qty: r1(area), unit: '㎡', layer: '방수', grade: AREA_WATERPROOF_PER_SQM.grade, note: '도막 2회' }, a, b);
        }
      }
    }

    // ④ 철거 — 철거 후 새로(거실은 기존 바닥 철거)일 때만
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
        const name = isLivingPlace ? '기존 바닥 철거·폐기물' : '타일 철거·폐기물';
        push({ key: 'demolish', name, qty: r1(dSqm), unit: '㎡', layer: '철거', grade: dGrade, note: '견적DB 철거 단가 ㎡ 환산' }, dMin, dMax);
      }
    }

    // ⑤ 인건 — 기공·조공 일수 × 1일 노임(욕실 2칸 할인율, 지금은 0)
    const discount = scope === 'bath2' ? 1 - BATH2_DISCOUNT_RATE : 1;
    if (mandays > 0) {
      const [a, b] = times(mandays, TILE_LABOR_PER_MANDAY, discount);
      push({ key: 'labor', name: '기공(타일공)', qty: mandays, unit: '일', layer: '인건', grade: TILE_LABOR_PER_MANDAY.grade, note: TILE_LABOR_PER_MANDAY.basis }, a, b);
    }
    if (helperDays > 0) {
      const [a, b] = times(helperDays, TILE_HELPER_PER_MANDAY, discount);
      push({ key: 'helper', name: '조공', qty: helperDays, unit: '일', layer: '인건', grade: TILE_HELPER_PER_MANDAY.grade, note: '몰탈 비빔·운반·정리' }, a, b);
    }
    if (groutType === 'epoxy' && netTotal > 0) {
      const [a, b] = times(netTotal, EPOXY_GROUT_LABOR_PER_SQM);
      push({ key: 'epoxyLabor', name: '에폭시 줄눈 시공', qty: r1(netTotal), unit: '㎡', layer: '인건', grade: EPOXY_GROUT_LABOR_PER_SQM.grade, note: EPOXY_GROUT_LABOR_PER_SQM.basis }, a, b);
    }
    const totalBoxes = (wall?.boxes ?? 0) + (floor?.boxes ?? 0);
    const totalBags = adhesives.reduce((s, x) => s + x.bags, 0);
    if (totalBoxes > 0) {
      const a = totalBoxes * LIFTING_PER_BOX.min + totalBags * LIFTING_PER_BAG.min;
      const b = totalBoxes * LIFTING_PER_BOX.max + totalBags * LIFTING_PER_BAG.max;
      push({ key: 'lifting', name: '양중(자재 올리기)', qty: totalBoxes + totalBags, unit: '개', layer: '인건', grade: 'C', note: `박스 ${totalBoxes} · 포 ${totalBags}` }, a, b);
    }

    // ⑥ 일반경비 — 위 합계에 비율
    const oMin = sumMin * TILE_OVERHEAD_RATE.min;
    const oMax = sumMax * TILE_OVERHEAD_RATE.max;
    push(
      { key: 'overhead', name: '일반경비', qty: 1, unit: '식', layer: '경비', grade: 'C', note: `합계의 ${Math.round(TILE_OVERHEAD_RATE.min * 100)}~${Math.round(TILE_OVERHEAD_RATE.max * 100)}%` },
      oMin,
      oMax,
    );
  }

  // ── 11) 현장 확인 ──
  const checks: TileCheck[] = [];
  if (method === 'overlay') {
    checks.push('overlayConditions');
    const wallLarge = wallNet > 0 && isLargeTile(wallSpec.widthMm, wallSpec.lengthMm);
    const floorLarge = floorNet > 0 && isLargeTile(floorSpec.widthMm, floorSpec.lengthMm);
    if (wallLarge || floorLarge) checks.push('largeOverlay');
  }
  if (anyBath && method === 'demolish' && !waterproof && isPro) checks.push('noWaterproof');
  if (heated && floorNet > 0) checks.push('heatedFloor');
  checks.push('lot');

  // ── 12) 견적DB 비교 범위 ──
  let marketRef: TileMarketRef | null = null;
  if (service === 'self') marketRef = MARKET_REF_BOX;
  else if (anyBath) marketRef = MARKET_REF_BATH;
  else if (scope === 'entrance' || space === 'entrance') marketRef = MARKET_REF_ENTRANCE;
  else if (scope === 'balcony' || space === 'balcony') marketRef = MARKET_REF_BALCONY;

  return {
    resolved: {
      mode: input.mode,
      scope,
      space,
      surface: legacyRooms ? (wallNet > 0 && floorNet > 0 ? 'both' : wallNet > 0 ? 'wall' : 'floor') : surface,
      method,
      methodLabel: methodLabel(isLivingPlace ? 'living' : scope, method),
      service,
      pattern,
      grade,
      groutMm,
      groutType,
      tileKind: mainSurface === 'wall' ? wallKind : floorKind,
      setting: mainSetting,
      settingRecommended,
      waterproof,
      heated,
      cornerBead,
      silicone,
      pyeong,
    },
    quantity: {
      wall,
      floor,
      grout: { lengthM: r1(gw.lengthM + gf.lengthM), kg: r1(groutKg), bags: groutBags, bagKg: groutBagKg, type: groutType, grade: 'C' },
      adhesives,
      cornerBeads,
      siliconeTubes,
      mandays,
      helperDays,
      byRoom,
      skippedRooms,
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
    marketRefs: MARKET_REFS,
  };
}

/** 중간값만 빨리 — 절약 금액 계산용 */
function midOf(input: TileCalcInput): number {
  return calcCore(input).cost.mid;
}

/**
 * 타일 계산기 본체 — 한 번 계산하고, 등급 3단 총액과 "바꾸면 줄어드는 금액"을 덧붙인다.
 * (같은 조건에서 등급·공법 하나만 바꿔 다시 계산 — 단가는 밖으로 안 나가고 총액 차이만 나간다)
 */
export function calcTile(input: TileCalcInput): TileCalcResult {
  const core = calcCore(input);
  const r = core.resolved;

  // 등급 3단 — 다른 조건은 그대로, 등급만 바꿔서
  const gradeTotals = {} as Record<TileGrade, { min: number; max: number }>;
  for (const g of ['basic', 'mid', 'high'] as const) {
    const c = g === r.grade ? core : calcCore({ ...input, grade: g });
    gradeTotals[g] = { min: c.cost.min, max: c.cost.max };
  }

  // 절약 금액 — 지금 조건에서 하나만 바꿨을 때 중간값 차이(1만 원 이상만)
  const savings: TileSaving[] = [];
  const base = core.cost.mid;
  const add = (key: TileSaving['key'], mid: number) => {
    const amount = roundWon(base - mid);
    if (amount >= 10000) savings.push({ key, amount });
  };
  const isLiving = r.scope === 'living' || r.space === 'livingFloor';
  if (r.service === 'pro' && r.method === 'demolish' && !isLiving) add('overlay', midOf({ ...input, method: 'overlay', waterproof: input.waterproof === true ? true : undefined }));
  if (r.grade !== 'basic') add('basicGrade', (gradeTotals.basic.min + gradeTotals.basic.max) / 2);
  if (r.tileKind === 'largePorcelain') {
    const p = { widthMm: 600, lengthMm: 600 };
    add('smallerTile', midOf({ ...input, tileKind: 'porcelain', ...(r.surface === 'floor' ? { floorTile: p } : { wallTile: p }) }));
  }
  if (r.groutType === 'epoxy') add('cementGrout', midOf({ ...input, groutType: 'cement' }));
  if (r.pattern !== 'straight') add('straightPattern', midOf({ ...input, pattern: 'straight' }));
  savings.sort((a, b) => b.amount - a.amount);

  return { ...core, cost: { ...core.cost, gradeTotals, savings } };
}
