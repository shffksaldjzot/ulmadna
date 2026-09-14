// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 계산기 API — POST /api/calc/mortar
//
// 이 파일이 하는 일:
//   화면에서 보낸 값을 하나씩 검사한 뒤 서버 계산기를 돌리고 결과만 돌려준다.
//   단가와 산식은 전부 서버에서만 돌고, 응답에는 물량·소비자가 범위·물량 근거만 나간다.
//   (도배·바닥재 API 라우트와 같은 손검증 방식 — zod 없이 함수로 하나씩 확인한다)
//
// 요청 예시:
//   { "mode": "레미탈", "areaSqm": 10, "thicknessMm": 30 }
//   { "mode": "셀프레벨링", "areaSqm": 20, "thicknessMm": 5 }
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { calcMortar } from '@/server/calc/mortar';
import type { MortarCalcInput, MortarProductInput, MortarRoomInput } from '@/server/calc/mortar';
import type { MortarMode, MortarUsage, MortarMethod } from '@/server/calc/schema/mortar-coefficients';

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

/** 제품 칸을 검사한다 (제품 마스터에서 고른 값 또는 직접 입력) */
function parseProduct(v: unknown): MortarProductInput | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw new ValidationError('product 형식이 잘못됐습니다');

  const product: MortarProductInput = {
    kgPerMmSqm: num(v.kgPerMmSqm, 'product.kgPerMmSqm', { min: 0.5, max: 5 }),
    bagKg: num(v.bagKg, 'product.bagKg', { min: 5, max: 100 }),
    pricePerBag: num(v.pricePerBag, 'product.pricePerBag', { min: 500, max: 200000 }),
    sourceLabel: typeof v.sourceLabel === 'string' ? v.sourceLabel.slice(0, 120) : undefined,
  };

  const hasAny = Object.values(product).some((x) => x !== undefined);
  return hasAny ? product : undefined;
}

/** 정밀 모드 실별 면적 목록을 검사한다 */
function parseRooms(v: unknown): MortarRoomInput[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ValidationError('rooms 는 배열이어야 합니다');
  if (v.length === 0) return undefined;
  if (v.length > 30) throw new ValidationError('rooms 는 30개까지 넣을 수 있습니다');

  return v.map((raw, i) => {
    if (!isObject(raw)) throw new ValidationError(`rooms[${i}] 형식이 잘못됐습니다`);
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `구역${i + 1}`;
    return {
      name,
      areaSqm: num(raw.areaSqm, `rooms[${i}].areaSqm`, { min: 0.1, max: 500, required: true }) as number,
    };
  });
}

/** 요청 몸통 전체를 계산기 입력으로 바꾼다 */
function parseInput(body: unknown): MortarCalcInput {
  if (!isObject(body)) throw new ValidationError('요청 형식이 잘못됐습니다');

  const mode = oneOf<MortarMode>(body.mode, 'mode', ['레미탈', '셀프레벨링'] as const);
  if (!mode) throw new ValidationError('mode 는 레미탈 / 셀프레벨링 중 하나여야 합니다');

  const areaSqm = num(body.areaSqm, 'areaSqm', { min: 0.5, max: 500, required: true }) as number;
  const thicknessMm = num(body.thicknessMm, 'thicknessMm', { min: 1, max: 100, required: true }) as number;

  const input: MortarCalcInput = {
    mode,
    areaSqm,
    thicknessMm,
    // 레미탈 모드 용도 — 공법(장비 타설/손미장) 기본값을 정하는 근거. 잘못된 값이면 400
    usage: oneOf<MortarUsage>(body.usage, 'usage', ['확장부바닥', '욕실현관구배', '마루철거보수', '방통전체'] as const),
    usageLabel: typeof body.usageLabel === 'string' ? body.usageLabel.slice(0, 40) : undefined,
    // 공법 오버라이드 — 정밀 모드 토글. 없으면 오케스트레이터가 usage 기본값을 쓴다
    method: oneOf<MortarMethod>(body.method, 'method', ['장비타설', '손미장'] as const),
    mixRatio: oneOf<'1:2' | '1:3'>(body.mixRatio, 'mixRatio', ['1:2', '1:3'] as const),
    lossRate: num(body.lossRate, 'lossRate', { min: 0, max: 0.2 }),
    wireMesh: bool(body.wireMesh, 'wireMesh'),
    primer: bool(body.primer, 'primer'),
    product: parseProduct(body.product),
    rooms: parseRooms(body.rooms),
  };

  return input;
}

// ── 라우트 핸들러 ──────────────────────────────

/** POST — 미장(레미탈·셀프레벨링) 계산 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 형식이 아닙니다' }, { status: 400 });
  }

  let input: MortarCalcInput;
  try {
    input = parseInput(body);
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : '입력을 확인해 주세요';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = calcMortar(input);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error('[calc/mortar] 계산 실패', e);
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
