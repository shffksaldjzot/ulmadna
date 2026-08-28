// ──────────────────────────────────────────────
// 도배 계산기 API — POST /api/calc/wallpaper
//
// 단가와 산식은 전부 서버에서만 돌고, 응답에는 물량·소비자가 범위·근거 문장만 나간다.
// (클라이언트 번들에 단가가 실리는 일이 없도록 계산은 여기서만 한다)
//
// 요청 예시:
//   { "mode": "평형", "pyeong": 34, "bay": 3, "scope": "전체",
//     "ceiling": true, "paperType": "실크", "region": "서울" }
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { calcWallpaper } from '@/server/calc/wallpaper';
import type { WallpaperCalcInput, WallpaperScope } from '@/server/calc/wallpaper';
import type { DimensionMode, RoomInput, AreaInput } from '@/server/calc/dimensions';

/** 이 라우트는 매번 새로 계산한다 (캐시 금지) */
export const dynamic = 'force-dynamic';

// ── 입력 검증 (zod 없이 손으로 확인한다) ──────────

/** 검증 실패를 담는 상자 */
class ValidationError extends Error {}

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
  };
}

/** 요청 몸통 전체를 계산기 입력으로 바꾼다 */
function parseInput(body: unknown): WallpaperCalcInput {
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
    bay,
    rooms: parseRooms(body.rooms),
    heightM: num(body.heightM, 'heightM', { min: 1.5, max: 6 }),
    areas: parseAreas(body.areas),
    scope: parseScope(body.scope),
    ceiling: bool(body.ceiling, 'ceiling'),
    paperType: oneOf(body.paperType, 'paperType', ['합지', '실크'] as const),
    product: parseProduct(body.product),
    region: typeof body.region === 'string' ? body.region.slice(0, 40) : undefined,
    isOld: bool(body.isOld, 'isOld'),
    removeOld: bool(body.removeOld, 'removeOld'),
  };

  // 모드별로 꼭 있어야 하는 칸 확인
  if (mode === '평형' && input.pyeong === undefined) {
    throw new ValidationError('평형 모드에서는 pyeong 값이 필요합니다');
  }
  if (mode === '실측' && (!input.rooms || input.rooms.length === 0)) {
    throw new ValidationError('실측 모드에서는 rooms 값이 필요합니다');
  }
  if (mode === '면적' && !input.areas) {
    throw new ValidationError('면적 모드에서는 areas 값이 필요합니다');
  }

  return input;
}

// ── 라우트 핸들러 ──────────────────────────────

/** POST — 도배 계산 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 형식이 아닙니다' }, { status: 400 });
  }

  let input: WallpaperCalcInput;
  try {
    input = parseInput(body);
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : '입력을 확인해 주세요';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = calcWallpaper(input);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    // 계산 중 문제는 서버 문제로 본다. 내부 메시지는 그대로 흘리지 않는다.
    console.error('[calc/wallpaper] 계산 실패', e);
    return NextResponse.json({ error: '계산 중 문제가 생겼습니다' }, { status: 500 });
  }
}

/** GET — 지원하지 않음 (계산은 POST 로만) */
export async function GET() {
  return NextResponse.json(
    { error: 'POST 로 요청해 주세요' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
