// ──────────────────────────────────────────────
// v3 견적 엔진 — 물량 DB + 산출 로직
// 62건 평면도 분석 기반 (59타입 25건, 74타입 16건, 84타입 21건)
// 출처: 얼마드나_62건분석_마스터브리핑.md / 통합비율표_v1.xlsx
// !! 임의 수정 금지 — 도메인 전문가 검증 데이터 !!
//
// [2026-06-04 업그레이드] Bay/구성/확장을 물량에 반영.
//   - 창호 개소: Bay별 결정론적(2Bay=6 / 3Bay=7 / 4Bay=8) — 62건 편차 0
//   - 문 개수: 구성별(순수3룸=6 / 3+알파=8 / 4룸=9)
//   - 도배·걸레받이: Bay 보정계수 (84/59 실측 평균 기반)
//   - 확장: 기본 ON. 비확장이면 발코니 편입면적만큼 기하 차감(추정·데이터 1건)
// ──────────────────────────────────────────────

import type { RoomRatio, ApartmentType, QuantityResult, BayKey, RoomsKey, StructureInput } from './types';
import { WINDOW_AREAS } from './processes/window';

// ── 타입별 평균 물량 ──────────────────────────────
// 통합비율표.xlsx 에서 자동 집계된 값을 그대로 사용 (전 Bay 통합 평균).
// 평면도 추가 시: 엑셀에 행 추가 → `node scripts/gen-engine-data.mjs` → 자동 갱신.
// Bay 보정은 아래 BAY_* 룰로 별도 적용한다.
export { TYPE_AVERAGES, BAY_STATS, SAMPLE_COUNTS } from './averages.generated';
import { TYPE_AVERAGES } from './averages.generated';

// ── 실별 면적 비율 (62건 분석 평균) ──
export const ROOM_RATIOS: Record<string, RoomRatio> = {
  master:   { name: '안방',       ratio: 0.17 },
  bed2:     { name: '침실2',      ratio: 0.09 },
  bed3:     { name: '침실3',      ratio: 0.10 },
  living:   { name: '거실+주방',  ratio: 0.32 },
  entrance: { name: '현관',       ratio: 0.07 },
  bath1:    { name: '욕실1',      ratio: 0.04 },
  bath2:    { name: '욕실2',      ratio: 0.05 },
  etc:      { name: '복도/기타',  ratio: 0.16 },
};

// ── 고급 프리셋용 실별 바닥재 분류 ──
// 방(안방+침실2+침실3) = 강마루, 거실+주방+복도+현관 = 타일
export const FLOOR_ZONE = {
  maru: ['master', 'bed2', 'bed3'],              // 강마루 영역 (36%)
  tile: ['living', 'entrance', 'etc'],            // 타일 영역 (55%)
  exclude: ['bath1', 'bath2'],                    // 욕실은 별도 공정
} as const;

// ── Bay별 보정 (62건 실측) ──────────────────────────
// 창호 개소: 데이터상 편차 0의 결정론적 룰 (2Bay=6, 3Bay=7, 4Bay=8)
const BAY_WINDOW_COUNT: Record<BayKey, number> = { '2': 6, '3': 7, '4': 8 };

// 창호 총면적·도배·걸레받이 보정계수 (3Bay = 기준 1.0)
//   창호면적: 개소비(6/7, 8/7)에서 도출 → 2Bay 0.86 / 4Bay 1.14
//   도배·걸레받이: 84(2Bay 223·4Bay 262) / 59(2Bay 181·4Bay 194) 평균 → 2Bay 0.92 / 4Bay 1.05
const BAY_WINDOW_AREA_MULT: Record<BayKey, number> = { '2': 0.86, '3': 1.0, '4': 1.14 };
const BAY_WALL_MULT:        Record<BayKey, number> = { '2': 0.92, '3': 1.0, '4': 1.05 };

// ── 구성별 문 개수 (62건 + 브리핑 3-4 룰) ──────────
// 순수3룸=6 / 3+알파(DR·다용도 등)=8 / 4룸=9
const ROOMS_DOOR_COUNT: Record<RoomsKey, number> = { pure3: 6, plus: 8, four: 9 };

// ── 비확장 보정 (발코니 표준 편입면적, ㎡) ──────────
// ⚠️ 62건 중 비확장 1건뿐 → 경험치 아닌 기하 추정값. 데이터 보강 시 교체.
// 발코니 깊이 ~1.5m × 전면 길이로 산출한 타입별 표준 편입면적.
const BALCONY_AREA: Record<ApartmentType, number> = { '59': 6, '74': 8, '84': 10 };

// ── ㎡ → 평 환산 상수 ──
const SQM_PER_PYEONG = 3.3058;

/** ㎡를 평으로 환산 (소수점 1자리) */
export function sqmToPyeong(sqm: number): number {
  return Math.round((sqm / SQM_PER_PYEONG) * 10) / 10;
}

/** 평을 ㎡로 환산 */
export function pyeongToSqm(pyeong: number): number {
  return Math.round(pyeong * SQM_PER_PYEONG * 10) / 10;
}

/** 타입별 기준 창호 총면적 (3Bay 기준) */
function baseWindowArea(type: ApartmentType): number {
  return (WINDOW_AREAS[type] ?? WINDOW_AREAS['84']).reduce((s, w) => s + w.area, 0);
}

// ── 물량 산출 함수 ──

/** 전용면적(㎡)으로 가장 가까운 타입 매칭 */
export function matchType(exclusiveArea: number): ApartmentType {
  if (exclusiveArea <= 66) return '59';
  if (exclusiveArea <= 79) return '74';
  return '84';
}

/**
 * 전용면적 + 구조입력 기반 물량 산출.
 * @param exclusiveArea 전용면적(㎡)
 * @param structure Bay/구성/확장 (미지정 시 3Bay·3+알파·확장 기본값)
 */
export function calculateQuantity(exclusiveArea: number, structure: StructureInput = {}): QuantityResult {
  const bay: BayKey = structure.bay ?? '3';
  const rooms_config: RoomsKey = structure.rooms ?? 'plus';
  const expanded: boolean = structure.expanded ?? true;

  const closestType = matchType(exclusiveArea);
  const base = TYPE_AVERAGES[closestType];
  // 면적 비율 보정 (예: 62㎡ → 59타입 기준 × 1.05)
  const areaRatio = exclusiveArea / base.area;

  // 실별 면적 계산
  const rooms = Object.entries(ROOM_RATIOS).map(([key, room]) => ({
    key,
    name: room.name,
    area: Math.round(exclusiveArea * room.ratio * 10) / 10,
  }));

  // ── 보정계수 ──
  const wallMult = BAY_WALL_MULT[bay];

  // 면적 비례 물량 (마루·타일바닥)
  let floor_wood = base.floor_wood * areaRatio;
  const floor_tile = Math.round(base.floor_tile * areaRatio * 10) / 10;

  // 도배: 면적비례 × Bay 보정
  let wallpaper_wall = base.wallpaper_wall * areaRatio * wallMult;
  let wallpaper_ceiling = base.wallpaper_ceiling * areaRatio; // 천장은 바닥면적 종속 → Bay 보정 제외

  // ── 비확장 보정: 발코니 편입면적만큼 마루·도배 차감 (기하 추정) ──
  if (!expanded) {
    const bArea = BALCONY_AREA[closestType];
    floor_wood = Math.max(floor_wood - bArea, floor_wood * 0.85); // 마루 면적 감소(하한 -15%)
    wallpaper_wall = wallpaper_wall * (1 - (bArea / exclusiveArea) * 0.5); // 도배 벽 일부 감소(보수적 0.5계수)
  }

  floor_wood = Math.round(floor_wood * 10) / 10;
  wallpaper_wall = Math.round(wallpaper_wall * 10) / 10;
  wallpaper_ceiling = Math.round(wallpaper_ceiling * 10) / 10;
  const wallpaper_total = Math.round((wallpaper_wall + wallpaper_ceiling) * 10) / 10;

  // 걸레받이: 면적비례 × Bay 보정
  const baseboard = Math.round(base.baseboard * areaRatio * wallMult);

  // 창호: 개소는 Bay 결정론, 면적은 기준면적 × Bay 보정
  const windows = BAY_WINDOW_COUNT[bay];
  const window_area = Math.round(baseWindowArea(closestType) * BAY_WINDOW_AREA_MULT[bay] * 10) / 10;

  // 문: 구성별
  const doors = ROOMS_DOOR_COUNT[rooms_config];

  const quantities = {
    floor_wood,
    floor_tile,
    wallpaper_wall,
    wallpaper_ceiling,
    wallpaper_total,
    wallpaper_pyeong: sqmToPyeong(wallpaper_total),
    bath_tile: Math.round(base.bath_tile * areaRatio * 10) / 10,
    baseboard,
    doors,
    windows,
    window_area,
    area_pyeong: sqmToPyeong(exclusiveArea),
    floor_wood_pyeong: sqmToPyeong(floor_wood),
  };

  return { closestType, areaRatio, bay, rooms_config, expanded, rooms, quantities };
}
