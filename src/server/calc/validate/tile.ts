// ──────────────────────────────────────────────
// 타일 계산기 — 입력 검증 (API 라우트·결과 공유 화면 공용)
//
// 미장·바닥재 검증과 같은 손검증 방식(zod 없이 칸마다 함수로 확인). 범위는 설계서 §6-1 —
// 숫자 자체는 src/lib/v1/tilePresets.ts 한 곳에서 가져와 화면 안내와 어긋나지 않게 한다.
// 범위를 벗어나거나 형식이 틀리면 ValidationError(→ 400)를 던진다.
//
// 작성일: 2026년 10월 03일
// 개편(정확 모드 공간 하나·종류·공법·시공 조건 검증): 2026년 10월 08일
// ──────────────────────────────────────────────

import type { TileCalcInput, TileOpeningInput, TileRoomInput, TileSpaceDims, TileSpecInput } from '@/server/calc/tile';
import { tileRoomComplete, spaceDimsComplete } from '@/server/calc/tile';
import {
  TILE_PYEONG_MIN,
  TILE_PYEONG_MAX,
  TILE_ROOMS_MAX,
  TILE_ROOM_MM_MIN,
  TILE_ROOM_MM_MAX,
  heightMinFor,
  TILE_HEIGHT_MM_MAX,
  TILE_AREA_SQM_MIN,
  TILE_AREA_SQM_MAX,
  TILE_DIM_MM_MIN,
  TILE_DIM_MM_MAX,
  TILE_PIECES_MIN,
  TILE_PIECES_MAX,
  TILE_GROUT_MM_MIN,
  TILE_GROUT_MM_MAX,
  TILE_LOSS_MAX,
  TILE_OPENING_COUNT_MAX,
  spaceDimFields,
  spaceDimRange,
  type TileGrade,
  type TileGroutType,
  type TileKind,
  type TileSpace,
  type TileMethod,
  type TilePattern,
  type TileRoomKind,
  type TileScope,
  type TileService,
  type TileSetting,
} from '@/lib/v1/tilePresets';

/** 검증 실패를 담는 상자 */
export class ValidationError extends Error {}

/** 값이 객체인지 */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 숫자 칸 하나 — 없어도 되는 칸이면 undefined */
function num(v: unknown, field: string, opts: { min?: number; max?: number; required?: boolean; integer?: boolean } = {}): number | undefined {
  if (v === undefined || v === null) {
    if (opts.required) throw new ValidationError(`${field} 값이 필요합니다`);
    return undefined;
  }
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ValidationError(`${field} 은(는) 숫자여야 합니다`);
  if (opts.integer && !Number.isInteger(n)) throw new ValidationError(`${field} 은(는) 정수여야 합니다`);
  if (opts.min !== undefined && n < opts.min) throw new ValidationError(`${field} 은(는) ${opts.min} 이상이어야 합니다`);
  if (opts.max !== undefined && n > opts.max) throw new ValidationError(`${field} 은(는) ${opts.max} 이하여야 합니다`);
  return n;
}

/** 불리언 칸 하나 */
function bool(v: unknown, field: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new ValidationError(`${field} 은(는) true/false 여야 합니다`);
  return v;
}

/** 정해진 값 중 하나인지 */
function oneOf<T extends string | number>(v: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (v === undefined || v === null) return undefined;
  if (!allowed.includes(v as T)) throw new ValidationError(`${field} 은(는) ${allowed.join(' / ')} 중 하나여야 합니다`);
  return v as T;
}

/** 타일 규격 칸 */
function parseSpec(v: unknown, field: string): TileSpecInput | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw new ValidationError(`${field} 형식이 잘못됐습니다`);
  return {
    widthMm: num(v.widthMm, `${field}.widthMm`, { min: TILE_DIM_MM_MIN, max: TILE_DIM_MM_MAX, required: true }) as number,
    lengthMm: num(v.lengthMm, `${field}.lengthMm`, { min: TILE_DIM_MM_MIN, max: TILE_DIM_MM_MAX, required: true }) as number,
    piecesPerBox: num(v.piecesPerBox, `${field}.piecesPerBox`, { min: TILE_PIECES_MIN, max: TILE_PIECES_MAX, integer: true }),
  };
}

/** 빼는 면적 목록 */
function parseOpenings(v: unknown, field: string): TileOpeningInput[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ValidationError(`${field} 는 배열이어야 합니다`);
  if (v.length > 10) throw new ValidationError(`${field} 는 10개까지 넣을 수 있습니다`);
  return v.map((o, i) => {
    if (!isObject(o)) throw new ValidationError(`${field}[${i}] 형식이 잘못됐습니다`);
    return {
      widthMm: num(o.widthMm, `${field}[${i}].widthMm`, { min: 100, max: TILE_ROOM_MM_MAX, required: true }) as number,
      heightMm: num(o.heightMm, `${field}[${i}].heightMm`, { min: 100, max: TILE_HEIGHT_MM_MAX, required: true }) as number,
      count: num(o.count, `${field}[${i}].count`, { min: 0, max: TILE_OPENING_COUNT_MAX, integer: true, required: true }) as number,
    };
  });
}

/** 정확 모드 실 카드 목록 */
function parseRooms(v: unknown): TileRoomInput[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ValidationError('rooms 는 배열이어야 합니다');
  if (v.length === 0) return undefined;
  if (v.length > TILE_ROOMS_MAX) throw new ValidationError(`rooms 는 ${TILE_ROOMS_MAX}개까지 넣을 수 있습니다`);
  const parsed: TileRoomInput[] = v.map((raw, i) => {
    if (!isObject(raw)) throw new ValidationError(`rooms[${i}] 형식이 잘못됐습니다`);
    const kind = oneOf<TileRoomKind>(raw.kind, `rooms[${i}].kind`, ['bath', 'floor', 'wall'] as const);
    if (!kind) throw new ValidationError(`rooms[${i}].kind 값이 필요합니다`);
    const f = `rooms[${i}]`;
    return {
      kind,
      name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 20) : undefined,
      widthMm: num(raw.widthMm, `${f}.widthMm`, { min: TILE_ROOM_MM_MIN, max: TILE_ROOM_MM_MAX }),
      depthMm: num(raw.depthMm, `${f}.depthMm`, { min: TILE_ROOM_MM_MIN, max: TILE_ROOM_MM_MAX }),
      heightMm: num(raw.heightMm, `${f}.heightMm`, { min: heightMinFor(kind), max: TILE_HEIGHT_MM_MAX }),
      areaSqm: num(raw.areaSqm, `${f}.areaSqm`, { min: TILE_AREA_SQM_MIN, max: TILE_AREA_SQM_MAX }),
      doors: num(raw.doors, `${f}.doors`, { min: 0, max: TILE_OPENING_COUNT_MAX, integer: true }),
      windows: num(raw.windows, `${f}.windows`, { min: 0, max: TILE_OPENING_COUNT_MAX, integer: true }),
      tub: bool(raw.tub, `${f}.tub`),
      openings: parseOpenings(raw.openings, `${f}.openings`),
    };
  });
  // 치수가 덜 들어간 실은 계산에서 뺀다 — 하나도 완성 안 됐으면 금액을 낼 수 없으니 400(2026-10-03 검사관 지적)
  if (!parsed.some(tileRoomComplete)) throw new ValidationError('치수를 다 넣은 실이 없습니다');
  return parsed;
}

/**
 * 정확 모드 공간 치수(새 흐름) — 공간마다 필요한 칸이 다 있어야 하고 범위 안이어야 한다.
 * 범위는 tilePresets.spaceDimRange(화면 안내와 같은 값).
 */
function parseDims(v: unknown, space: TileSpace): TileSpaceDims {
  if (!isObject(v)) throw new ValidationError('dims 값이 필요합니다');
  const field = (f: 'widthMm' | 'depthMm' | 'heightMm') => {
    const need = spaceDimFields(space).includes(f);
    const range = spaceDimRange(space, f);
    return need ? num(v[f], `dims.${f}`, { min: range.min, max: range.max }) : undefined;
  };
  const dims: TileSpaceDims = {
    widthMm: field('widthMm'),
    depthMm: field('depthMm'),
    heightMm: field('heightMm'),
    doors: num(v.doors, 'dims.doors', { min: 0, max: TILE_OPENING_COUNT_MAX, integer: true }),
    windows: num(v.windows, 'dims.windows', { min: 0, max: TILE_OPENING_COUNT_MAX, integer: true }),
    tub: bool(v.tub, 'dims.tub'),
  };
  // 치수가 다 안 들어오면 금액을 낼 수 없으니 400
  if (!spaceDimsComplete(space, dims)) throw new ValidationError('치수를 다 넣어 주세요');
  return dims;
}

/** 요청 몸통 전체를 계산기 입력으로 바꾼다 */
export function parseInput(body: unknown): TileCalcInput {
  if (!isObject(body)) throw new ValidationError('요청 형식이 잘못됐습니다');
  const mode = oneOf<'simple' | 'precise'>(body.mode, 'mode', ['simple', 'precise'] as const);
  if (!mode) throw new ValidationError('mode 는 simple / precise 중 하나여야 합니다');

  const scope = oneOf<TileScope>(body.scope, 'scope', ['bath1', 'bath2', 'kitchen', 'living', 'entrance', 'balcony'] as const);
  if (mode === 'simple' && !scope) throw new ValidationError('scope 값이 필요합니다');
  // 정확 모드 새 흐름(공간 하나) — space가 오면 dims가 필수, 옛 rooms는 무시
  const space = mode === 'precise' ? oneOf<TileSpace>(body.space, 'space', ['bathWall', 'bathFloor', 'kitchenWall', 'entrance', 'balcony', 'livingFloor'] as const) : undefined;
  const dims = space ? parseDims(body.dims, space) : undefined;

  return {
    mode,
    scope,
    method: oneOf<TileMethod>(body.method, 'method', ['overlay', 'demolish', 'none'] as const),
    service: oneOf<TileService>(body.service, 'service', ['pro', 'self'] as const),
    pyeong: num(body.pyeong, 'pyeong', { min: TILE_PYEONG_MIN, max: TILE_PYEONG_MAX }),
    bay: oneOf<2 | 3 | 4>(body.bay, 'bay', [2, 3, 4] as const),
    pattern: oneOf<TilePattern>(body.pattern, 'pattern', ['straight', 'offset', 'diagonal', 'herringbone'] as const),
    grade: oneOf<TileGrade>(body.grade, 'grade', ['basic', 'mid', 'high'] as const),
    groutMm: num(body.groutMm, 'groutMm', { min: TILE_GROUT_MM_MIN, max: TILE_GROUT_MM_MAX }),
    setting: oneOf<TileSetting>(body.setting, 'setting', ['press', 'mortar', 'bond'] as const),
    tileKind: oneOf<TileKind>(body.tileKind, 'tileKind', ['earthenware', 'stoneware', 'porcelain', 'largePorcelain'] as const),
    groutType: oneOf<TileGroutType>(body.groutType, 'groutType', ['cement', 'color', 'epoxy'] as const),
    waterproof: bool(body.waterproof, 'waterproof'),
    heated: bool(body.heated, 'heated'),
    cornerBead: bool(body.cornerBead, 'cornerBead'),
    silicone: bool(body.silicone, 'silicone'),
    lossRate: num(body.lossRate, 'lossRate', { min: 0, max: TILE_LOSS_MAX }),
    space,
    dims,
    rooms: mode === 'precise' && !space ? parseRooms(body.rooms) : undefined,
    wallTile: parseSpec(body.wallTile, 'wallTile'),
    floorTile: parseSpec(body.floorTile, 'floorTile'),
  };
}
