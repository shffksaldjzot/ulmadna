// ──────────────────────────────────────────────
// 치수 공통 모듈 — 모든 계산기가 같은 실별 치수를 쓴다
//
// 설계 정본 0-A절 (집사 2026-08-28):
//   모든 물량 계산기의 첫 칸은 "평형으로 / 실측으로 / 면적으로" 세 갈래다.
//     평형으로 — 평형·베이 → 비율표(62건)로 실별 치수 추정. 로스는 "추정"
//     실측으로 — 방마다 가로 m · 세로 m, 높이는 공통 1칸(기본 2.3m). 로스는 실제 재단
//     면적으로 — 이미 뽑아둔 면적을 바로 입력(업체용 지름길). 둘레를 비우면 면적에서 추정
//
//   방마다 산출:
//     벽 면적   = (가로 + 세로) × 2 × 높이 − 개구부(문·창)
//     천장·바닥 = 가로 × 세로
//     둘레      = (가로 + 세로) × 2
//
//   한 번 넣은 치수는 모든 계산기가 공유한다.
//     도배(벽·천장·둘레) · 바닥재(바닥·둘레) · 걸레받이·몰딩(둘레) · 커튼(창) · 타일(욕실)
//   그래서 도배 계산기도 v3 엔진 결과를 여기서 RoomDims[] 로 바꿔 받아 쓴다.
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import 'server-only';

import { calculateQuantity, ROOM_RATIOS } from '@/app/v3/data/quantity';
import type { BayKey } from '@/app/v3/data/types';
import {
  STANDARD_WALL_HEIGHT_M,
  SQM_PER_PYEONG,
  EXCLUSIVE_RATIO,
  PYEONG_TO_EXCLUSIVE_SQM,
} from './schema/wallpaper-coefficients';

/** 입력 방식 */
export type DimensionMode = '평형' | '실측' | '면적';

/** 창 하나의 치수 */
export interface WindowSizeInput {
  /** 창 폭 (cm) */
  widthCm: number;
  /** 창 높이 (cm) */
  heightCm: number;
}

/** 실측 모드에서 방 하나를 적는 칸 */
export interface RoomInput {
  /** 방 이름 (거실·안방·방2 …) */
  name: string;
  /** 가로 (m) */
  widthM: number;
  /** 세로 (m) */
  depthM: number;
  /** 이 방만 다른 높이일 때 (m). 없으면 공통 높이 */
  heightM?: number;
  /** 문 개수 (벽 면적에서 뺀다) */
  doors?: number;
  /** 창 목록 (벽 면적에서 뺀다) */
  windows?: WindowSizeInput[];
}

/** 면적 모드에서 바로 넣는 값 */
export interface AreaInput {
  /** 벽 면적 (㎡) */
  wallSqm?: number;
  /** 천장 면적 (㎡) */
  ceilingSqm?: number;
  /** 바닥 면적 (㎡) */
  floorSqm?: number;
  /** 둘레 (m). 비우면 벽 면적에서 추정한다 */
  perimeterM?: number;
}

/** 치수 모듈에 넣는 값 */
export interface DimensionsInput {
  /** 입력 방식 */
  mode: DimensionMode;
  /** 평형 모드: 공급 평형 */
  pyeong?: number;
  /** 평형 모드: 베이 수 */
  bay?: 2 | 3 | 4;
  /** 실측 모드: 방 목록 */
  rooms?: RoomInput[];
  /** 실측 모드: 공통 높이 (m). 기본 2.3 */
  heightM?: number;
  /** 면적 모드: 이미 뽑아둔 면적 */
  areas?: AreaInput;
}

/** 방 하나의 확정된 치수 — 모든 계산기가 이 모양만 소비한다 */
export interface RoomDims {
  /** 코드용 키 (엔진 실 키와 맞추거나 room1, room2 …) */
  key: string;
  /** 방 이름 */
  name: string;
  /** 가로 (m) */
  widthM: number;
  /** 세로 (m) */
  depthM: number;
  /** 높이 (m) */
  heightM: number;
  /** 벽 면적 (㎡) — 개구부 차감 후 */
  wallSqm: number;
  /** 천장 면적 (㎡) */
  ceilingSqm: number;
  /** 바닥 면적 (㎡) */
  floorSqm: number;
  /** 둘레 (m) */
  perimeterM: number;
  /** 차감한 개구부 면적 (㎡) */
  openingSqm: number;
  /** 치수가 실측인지 추정인지 */
  estimated: boolean;
}

/** 치수 모듈 결과 */
export interface DimensionsResult {
  mode: DimensionMode;
  /** 실별 치수 */
  rooms: RoomDims[];
  /** 합계 */
  totals: {
    wallSqm: number;
    ceilingSqm: number;
    floorSqm: number;
    perimeterM: number;
    /** 차감한 개구부(문·창) 면적 합계 (㎡) */
    openingSqm: number;
  };
  /** 로스를 실제로 잘라 볼 수 있는 치수인지 */
  canRealCut: boolean;
  /** 계산에 쓸 대표 높이 (m) */
  heightM: number;
  /** 추정한 공급 평형 (인건 품수 공식에 쓴다) */
  supplyPyeong: number;
  /** 근거 문장 */
  source: string;
}

// ── 기본값 ────────────────────────────────────

/** 문 하나의 표준 크기 (m). 0.9 × 2.1 = 1.89㎡ */
export const DOOR_SIZE = { widthM: 0.9, heightM: 2.1 };

/**
 * 평형 모드에서 방 모양을 잡을 때 쓰는 가로:세로 비율.
 * 정사각형(1:1)보다 살짝 길쭉한 국내 아파트 방 모양에 맞춘 추정치다.
 */
const ROOM_ASPECT = 1.25;

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 소수점 2자리 반올림 */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 방 이름을 엔진 실 키로 바꾼다.
 * 못 찾으면 undefined — 호출한 쪽에서 room1, room2 … 로 붙인다.
 */
function guessRoomKey(name: string): string | undefined {
  const n = name.replace(/\s/g, '');
  // 거실과 주방은 따로 잡아 둔다. 그래야 "거실·주방만" 범위가 둘 다 집어낸다.
  if (n.includes('거실')) return 'living';
  if (n.includes('주방') || n.includes('식당') || n.includes('키친')) return 'kitchen';
  if (n.includes('안방')) return 'master';
  if (n.includes('침실2') || n === '방2' || n.includes('작은방')) return 'bed2';
  if (n.includes('침실3') || n === '방3') return 'bed3';
  if (n.includes('현관')) return 'entrance';
  if (n.includes('복도') || n.includes('기타') || n.includes('드레스')) return 'etc';
  if (n.includes('욕실') || n.includes('화장실')) return 'bath1';
  return undefined;
}

// ── 본체 ──────────────────────────────────────

/**
 * 입력 방식에 상관없이 항상 같은 모양(RoomDims[])의 실별 치수를 만들어 준다.
 * 도배·바닥재·커튼·타일 계산기가 전부 이 함수 결과만 소비한다.
 */
export function resolveDimensions(input: DimensionsInput): DimensionsResult {
  if (input.mode === '실측') return fromMeasured(input);
  if (input.mode === '면적') return fromAreas(input);
  return fromPyeong(input);
}

// ── 1) 실측으로 ────────────────────────────────
function fromMeasured(input: DimensionsInput): DimensionsResult {
  const commonHeight = input.heightM ?? STANDARD_WALL_HEIGHT_M.value;
  const src = input.rooms ?? [];

  const usedKeys = new Set<string>();
  const rooms: RoomDims[] = src.map((r, i) => {
    // 이름으로 엔진 키를 찾고, 겹치거나 못 찾으면 순번 키를 붙인다
    let key = guessRoomKey(r.name);
    if (!key || usedKeys.has(key)) key = `room${i + 1}`;
    usedKeys.add(key);

    const h = r.heightM ?? commonHeight;
    const perimeter = (r.widthM + r.depthM) * 2;

    // 개구부: 문은 표준 크기, 창은 입력 치수
    const doorArea = (r.doors ?? 0) * DOOR_SIZE.widthM * DOOR_SIZE.heightM;
    const windowArea = (r.windows ?? []).reduce(
      (s, w) => s + (w.widthCm / 100) * (w.heightCm / 100),
      0,
    );
    const openingSqm = doorArea + windowArea;

    // 벽 면적 = 둘레 × 높이 − 개구부 (음수 방지)
    const wallSqm = Math.max(0, perimeter * h - openingSqm);
    const floorSqm = r.widthM * r.depthM;

    return {
      key,
      name: r.name,
      widthM: r2(r.widthM),
      depthM: r2(r.depthM),
      heightM: r2(h),
      wallSqm: r1(wallSqm),
      ceilingSqm: r1(floorSqm),
      floorSqm: r1(floorSqm),
      perimeterM: r1(perimeter),
      openingSqm: r1(openingSqm),
      estimated: false,
    };
  });

  const totals = sumRooms(rooms);
  // 실측 바닥 합계 ≈ 전용면적 → 공급 평형으로 되돌린다 (인건 품수 공식이 공급 평수를 쓴다)
  const supplyPyeong =
    input.pyeong ?? r1(totals.floorSqm / SQM_PER_PYEONG / EXCLUSIVE_RATIO.value);

  return {
    mode: '실측',
    rooms,
    totals,
    canRealCut: rooms.length > 0,
    heightM: commonHeight,
    supplyPyeong,
    source: `실측 ${rooms.length}개 실 · 높이 ${commonHeight}m · 개구부 ${r1(totals.openingSqm)}㎡ 차감`,
  };
}

// ── 2) 평형으로 ────────────────────────────────
function fromPyeong(input: DimensionsInput): DimensionsResult {
  const pyeong = input.pyeong ?? 34;
  const bay = String(input.bay ?? 3) as BayKey;
  const height = input.heightM ?? STANDARD_WALL_HEIGHT_M.value;

  // 공급 평형 → 전용면적
  const exclusiveSqm =
    PYEONG_TO_EXCLUSIVE_SQM[Math.round(pyeong)] ??
    r1(pyeong * SQM_PER_PYEONG * EXCLUSIVE_RATIO.value);

  // 코어 엔진(62건 비율표)에서 실별 면적과 벽·천장 총량을 받는다
  const q = calculateQuantity(exclusiveSqm, { bay });
  const engineWall = q.quantities.wallpaper_wall;
  const engineCeiling = q.quantities.wallpaper_ceiling;

  // 도배·바닥 대상 실만 (욕실은 타일 공정이라 뺀다)
  const target = q.rooms.filter((r) => r.key !== 'bath1' && r.key !== 'bath2');

  // 벽 면적 배분 가중치 = 방 둘레. 방을 가로:세로 1.25 직사각형으로 보고 둘레를 구한다.
  const shaped = target.map((r) => {
    const area = Math.max(r.area, 0.01);
    const widthM = Math.sqrt(area * ROOM_ASPECT);
    const depthM = area / widthM;
    return { ...r, widthM, depthM, perimeterGuess: (widthM + depthM) * 2 };
  });

  const perimeterSum = shaped.reduce((s, r) => s + r.perimeterGuess, 0);
  const ceilingSum = shaped.reduce((s, r) => s + r.area, 0);

  const rooms: RoomDims[] = shaped.map((r) => {
    // 엔진 총량(62건 검증값)이 최종 권위. 둘레 비율로 나눈 뒤 합이 엔진 값과 맞도록 정규화.
    const wallSqm = perimeterSum > 0 ? engineWall * (r.perimeterGuess / perimeterSum) : 0;
    const ceilingSqm = ceilingSum > 0 ? engineCeiling * (r.area / ceilingSum) : 0;
    // 둘레는 벽 면적과 어긋나지 않게 벽 면적 ÷ 높이로 되돌려 맞춘다
    const perimeterM = height > 0 ? wallSqm / height : r.perimeterGuess;

    return {
      key: r.key,
      name: ROOM_RATIOS[r.key]?.name ?? r.name,
      widthM: r2(r.widthM),
      depthM: r2(r.depthM),
      heightM: r2(height),
      wallSqm: r1(wallSqm),
      ceilingSqm: r1(ceilingSqm),
      floorSqm: r1(r.area),
      perimeterM: r1(perimeterM),
      openingSqm: 0, // 비율표 벽 면적에 개구부 처리가 이미 녹아 있다
      estimated: true,
    };
  });

  return {
    mode: '평형',
    rooms,
    totals: sumRooms(rooms),
    canRealCut: false, // 추정 치수라 "잘라보기"를 하지 않는다
    heightM: height,
    supplyPyeong: pyeong,
    source: `${pyeong}평 ${bay}베이 · 62건 비율표로 실별 치수 추정 (전용 ${exclusiveSqm}㎡)`,
  };
}

// ── 3) 면적으로 ────────────────────────────────
function fromAreas(input: DimensionsInput): DimensionsResult {
  const a = input.areas ?? {};
  const height = input.heightM ?? STANDARD_WALL_HEIGHT_M.value;
  const wallSqm = a.wallSqm ?? 0;
  const ceilingSqm = a.ceilingSqm ?? 0;
  const floorSqm = a.floorSqm ?? ceilingSqm;

  // 둘레를 안 넣었으면 벽 면적 ÷ 높이로 추정한다
  const perimeterGiven = typeof a.perimeterM === 'number' && a.perimeterM > 0;
  const perimeterM = perimeterGiven ? (a.perimeterM as number) : (height > 0 ? wallSqm / height : 0);

  const room: RoomDims = {
    key: 'total',
    name: '전체',
    widthM: 0,
    depthM: 0,
    heightM: r2(height),
    wallSqm: r1(wallSqm),
    ceilingSqm: r1(ceilingSqm),
    floorSqm: r1(floorSqm),
    perimeterM: r1(perimeterM),
    openingSqm: 0,
    estimated: !perimeterGiven,
  };

  // 면적만 있으면 공급 평형은 바닥 면적에서 되돌린다
  const supplyPyeong =
    input.pyeong ?? r1((floorSqm || ceilingSqm) / SQM_PER_PYEONG / EXCLUSIVE_RATIO.value);

  return {
    mode: '면적',
    rooms: [room],
    totals: sumRooms([room]),
    // 둘레를 직접 넣었을 때만 재단 계산이 의미가 있다
    canRealCut: perimeterGiven,
    heightM: height,
    supplyPyeong,
    source: perimeterGiven
      ? `면적 직접 입력 · 벽 ${r1(wallSqm)}㎡ · 천장 ${r1(ceilingSqm)}㎡ · 둘레 ${r1(perimeterM)}m`
      : `면적 직접 입력 · 벽 ${r1(wallSqm)}㎡ · 천장 ${r1(ceilingSqm)}㎡ · 둘레는 벽 면적 ÷ ${height}m 로 추정`,
  };
}

// ── 합계 도우미 ────────────────────────────────
function sumRooms(rooms: RoomDims[]) {
  return {
    wallSqm: r1(rooms.reduce((s, r) => s + r.wallSqm, 0)),
    ceilingSqm: r1(rooms.reduce((s, r) => s + r.ceilingSqm, 0)),
    floorSqm: r1(rooms.reduce((s, r) => s + r.floorSqm, 0)),
    perimeterM: r1(rooms.reduce((s, r) => s + r.perimeterM, 0)),
    openingSqm: r1(rooms.reduce((s, r) => s + r.openingSqm, 0)),
  };
}
