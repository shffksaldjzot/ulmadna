// ──────────────────────────────────────────────
// 도배 계산기 — 입력 검증 (API 라우트·결과 공유 화면 공용)
//
// 2026-09-30 지휘관 긴급 전달(중요 1 남은 부분) — 원래 src/app/api/calc/wallpaper/route.ts
// 안에 있던 손검증 로직을 이 파일로 그대로 옮겼다(내용은 한 글자도 안 바꿈, 자리만 옮김).
// route.ts는 이 파일의 parseInput을 그대로 불러 쓰고, 결과 공유 화면(result/page.tsx)도
// 똑같은 이 함수를 불러써서 "같은 입력엔 같은 판정"이 보장된다 — 공유 링크가 서버 API를
// 거치지 않고 계산기를 직접 불러서 검증을 건너뛰던 사고를 막는다.
//
// 옮기기 전/후 API 응답이 바이트 단위로 같은지(정상 5개 + 비정상 10개) 직접 비교해서
// 확인했다 — 검증 문구·순서·조건 전부 그대로다.
//
// 작성일: 2026년 09월 30일 (route.ts에서 분리)
// ──────────────────────────────────────────────

import type { WallpaperCalcInput, WallpaperScope } from '@/server/calc/wallpaper';
import type { DimensionMode, RoomInput, AreaInput } from '@/server/calc/dimensions';

/** 검증 실패를 담는 상자 */
export class ValidationError extends Error {}

/** 값이 객체인지 */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 숫자 칸 하나를 검사한다. 없어도 되는 칸이면 undefined 를 돌려준다 */
function num(
  v: unknown,
  field: string,
  opts: { min?: number; max?: number; required?: boolean } = {},
): number | undefined {
  if (v === undefined || v === null) {
    if (opts.required) throw new ValidationError(`${field} 값이 필요합니다`);
    return undefined;
  }
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new ValidationError(`${field} 은(는) 숫자여야 합니다`);
  }
  if (opts.min !== undefined && n < opts.min) {
    throw new ValidationError(`${field} 은(는) ${opts.min} 이상이어야 합니다`);
  }
  if (opts.max !== undefined && n > opts.max) {
    throw new ValidationError(`${field} 은(는) ${opts.max} 이하여야 합니다`);
  }
  return n;
}

/** 불리언 칸 하나 */
function bool(v: unknown, field: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new ValidationError(`${field} 은(는) true/false 여야 합니다`);
  return v;
}

/** 정해진 값 중 하나인지 */
function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new ValidationError(`${field} 은(는) ${allowed.join(' / ')} 중 하나여야 합니다`);
  }
  return v as T;
}

/** 실측 모드의 방 목록을 검사한다 */
function parseRooms(v: unknown): RoomInput[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ValidationError('rooms 는 배열이어야 합니다');
  if (v.length === 0) throw new ValidationError('rooms 가 비어 있습니다');
  if (v.length > 30) throw new ValidationError('rooms 는 30개까지 넣을 수 있습니다');

  return v.map((raw, i) => {
    if (!isObject(raw)) throw new ValidationError(`rooms[${i}] 형식이 잘못됐습니다`);
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `방${i + 1}`;
    const widthM = num(raw.widthM, `rooms[${i}].widthM`, { min: 0.3, max: 30, required: true }) as number;
    const depthM = num(raw.depthM, `rooms[${i}].depthM`, { min: 0.3, max: 30, required: true }) as number;
    const heightM = num(raw.heightM, `rooms[${i}].heightM`, { min: 1.5, max: 6 });
    const doors = num(raw.doors, `rooms[${i}].doors`, { min: 0, max: 20 });

    // 창 목록 (선택)
    let windows: { widthCm: number; heightCm: number }[] | undefined;
    if (raw.windows !== undefined && raw.windows !== null) {
      if (!Array.isArray(raw.windows)) throw new ValidationError(`rooms[${i}].windows 는 배열이어야 합니다`);
      windows = raw.windows.map((w, j) => {
        if (!isObject(w)) throw new ValidationError(`rooms[${i}].windows[${j}] 형식이 잘못됐습니다`);
        return {
          widthCm: num(w.widthCm, `rooms[${i}].windows[${j}].widthCm`, { min: 10, max: 1000, required: true }) as number,
          heightCm: num(w.heightCm, `rooms[${i}].windows[${j}].heightCm`, { min: 10, max: 400, required: true }) as number,
        };
      });
    }

    return { name, widthM, depthM, heightM, doors, windows };
  });
}

/** 면적 모드의 면적 칸을 검사한다 */
function parseAreas(v: unknown): AreaInput | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw new ValidationError('areas 형식이 잘못됐습니다');
  const wallSqm = num(v.wallSqm, 'areas.wallSqm', { min: 0, max: 5000, required: true });
  const ceilingSqm = num(v.ceilingSqm, 'areas.ceilingSqm', { min: 0, max: 5000 });
  const floorSqm = num(v.floorSqm, 'areas.floorSqm', { min: 0, max: 5000 });
  const perimeterM = num(v.perimeterM, 'areas.perimeterM', { min: 0, max: 2000 });
  return { wallSqm, ceilingSqm, floorSqm, perimeterM };
}

/** 시공 범위 칸을 검사한다 */
function parseScope(v: unknown): WallpaperScope | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') {
    if (v === '전체' || v === '거실주방') return v;
    throw new ValidationError('scope 는 전체 / 거실주방 또는 방 키 배열이어야 합니다');
  }
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[];
  throw new ValidationError('scope 는 전체 / 거실주방 또는 방 키 배열이어야 합니다');
}

/** 제품 직접 입력 칸을 검사한다 */
function parseProduct(v: unknown) {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw new ValidationError('product 형식이 잘못됐습니다');
  return {
    rollPrice: num(v.rollPrice, 'product.rollPrice', { min: 1000, max: 1000000, required: true }) as number,
    widthCm: num(v.widthCm, 'product.widthCm', { min: 20, max: 400, required: true }) as number,
    lengthM: num(v.lengthM, 'product.lengthM', { min: 1, max: 100, required: true }) as number,
    repeatCm: num(v.repeatCm, 'product.repeatCm', { min: 0, max: 200 }),
    // 제품 마스터에서 고른 제품이면 화면이 만든 출처 문구가 실려 온다(길이만 방어적으로 자른다)
    sourceLabel: typeof v.sourceLabel === 'string' ? v.sourceLabel.slice(0, 120) : undefined,
  };
}

/** 요청 몸통 전체를 계산기 입력으로 바꾼다 */
export function parseInput(body: unknown): WallpaperCalcInput {
  if (!isObject(body)) throw new ValidationError('요청 형식이 잘못됐습니다');

  const mode = (oneOf<DimensionMode>(body.mode, 'mode', ['평형', '실측', '면적'] as const) ?? '평형');

  // 베이는 2 / 3 / 4 만. 안 넣으면 계산기 기본값(3)을 쓴다.
  let bay: 2 | 3 | 4 | undefined;
  if (body.bay !== undefined && body.bay !== null) {
    const n = num(body.bay, 'bay', { min: 2, max: 4, required: true }) as number;
    if (n !== 2 && n !== 3 && n !== 4) throw new ValidationError('bay 는 2 / 3 / 4 중 하나여야 합니다');
    bay = n;
  }

  const input: WallpaperCalcInput = {
    mode,
    pyeong: num(body.pyeong, 'pyeong', { min: 5, max: 200 }),
    // 전용면적(㎡) 직접 입력 — 2026-09-15 형아 지시(㎡ 모드). 20~300㎡로 검증한다
    // (34평 국민평형 전용 84㎡가 이 범위 한가운데 오도록 잡은 값).
    exclusiveSqm: num(body.exclusiveSqm, 'exclusiveSqm', { min: 20, max: 300 }),
    bay,
    rooms: parseRooms(body.rooms),
    heightM: num(body.heightM, 'heightM', { min: 1.5, max: 6 }),
    areas: parseAreas(body.areas),
    scope: parseScope(body.scope),
    wall: bool(body.wall, 'wall'),
    ceiling: bool(body.ceiling, 'ceiling'),
    paperType: oneOf(body.paperType, 'paperType', ['합지', '실크'] as const),
    product: parseProduct(body.product),
    region: typeof body.region === 'string' ? body.region.slice(0, 40) : undefined,
    isOld: bool(body.isOld, 'isOld'),
    removeOld: bool(body.removeOld, 'removeOld'),
  };

  // 모드별로 꼭 있어야 하는 칸 확인
  // 평형 모드는 pyeong(평 단위) 또는 exclusiveSqm(㎡ 단위) 둘 중 하나만 있으면 된다
  if (mode === '평형' && input.pyeong === undefined && input.exclusiveSqm === undefined) {
    throw new ValidationError('평형 모드에서는 pyeong 또는 exclusiveSqm 값이 필요합니다');
  }
  if (mode === '실측' && (!input.rooms || input.rooms.length === 0)) {
    throw new ValidationError('실측 모드에서는 rooms 값이 필요합니다');
  }
  if (mode === '면적' && !input.areas) {
    throw new ValidationError('면적 모드에서는 areas 값이 필요합니다');
  }

  return input;
}
