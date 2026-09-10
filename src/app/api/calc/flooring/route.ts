// ──────────────────────────────────────────────
// 바닥재 계산기 API — POST /api/calc/flooring
//
// 이 파일이 하는 일:
//   화면에서 보낸 값을 하나씩 검사한 뒤 서버 계산기를 돌리고 결과만 돌려준다.
//   단가와 산식은 전부 서버에서만 돌고, 응답에는 물량·소비자가 범위·물량 근거만 나간다.
//   (클라이언트 번들에 단가가 실리는 일이 없도록 계산은 여기서만 한다)
//
// 요청 예시:
//   { "mode": "평형", "pyeong": 34, "bay": 3, "scope": "전체", "kind": "마루" }
//   { "mode": "실측", "kind": "장판",
//     "rooms": [{ "name": "안방", "widthM": 3.6, "depthM": 4.2 }] }
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { calcFlooring } from '@/server/calc/flooring';
import type {
  FlooringCalcInput,
  FlooringMode,
  FlooringScope,
  FlooringRoomInput,
} from '@/server/calc/flooring';
import type { FlooringDirectProduct } from '@/server/pricing/flooring';
import type { FlooringKind } from '@/server/calc/data/flooring-products';

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

/** 실측 모드의 방 목록을 검사한다 (바닥은 가로·세로만 받는다) */
function parseRooms(v: unknown): FlooringRoomInput[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ValidationError('rooms 는 배열이어야 합니다');
  if (v.length === 0) throw new ValidationError('rooms 가 비어 있습니다');
  if (v.length > 30) throw new ValidationError('rooms 는 30개까지 넣을 수 있습니다');

  return v.map((raw, i) => {
    if (!isObject(raw)) throw new ValidationError(`rooms[${i}] 형식이 잘못됐습니다`);
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `방${i + 1}`;
    return {
      name,
      widthM: num(raw.widthM, `rooms[${i}].widthM`, { min: 0.3, max: 30, required: true }) as number,
      depthM: num(raw.depthM, `rooms[${i}].depthM`, { min: 0.3, max: 30, required: true }) as number,
    };
  });
}

/** 제품 칸을 검사한다 (제품 마스터에서 고른 값 또는 직접 입력) */
function parseProduct(v: unknown): FlooringDirectProduct | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw new ValidationError('product 형식이 잘못됐습니다');

  const product: FlooringDirectProduct = {
    // 박스로 파는 자재 (마루·데코타일)
    pricePerBox: num(v.pricePerBox, 'product.pricePerBox', { min: 1000, max: 5000000 }),
    sqmPerBox: num(v.sqmPerBox, 'product.sqmPerBox', { min: 0.1, max: 50 }),
    pcsPerBox: num(v.pcsPerBox, 'product.pcsPerBox', { min: 1, max: 500 }),
    widthMm: num(v.widthMm, 'product.widthMm', { min: 30, max: 4000 }),
    lengthMm: num(v.lengthMm, 'product.lengthMm', { min: 30, max: 4000 }),
    // m 로 파는 자재 (장판)
    pricePerM: num(v.pricePerM, 'product.pricePerM', { min: 1000, max: 1000000 }),
    rollWidthM: num(v.rollWidthM, 'product.rollWidthM', { min: 0.5, max: 5 }),
    thicknessMm: num(v.thicknessMm, 'product.thicknessMm', { min: 0.5, max: 30 }),
    // 공통
    lossRate: num(v.lossRate, 'product.lossRate', { min: 0, max: 0.5 }),
    // 화면이 만든 출처 문구 (길이만 방어적으로 자른다)
    sourceLabel: typeof v.sourceLabel === 'string' ? v.sourceLabel.slice(0, 120) : undefined,
  };

  // 값이 하나도 안 들어왔으면 제품을 안 고른 것으로 본다
  const hasAny = Object.values(product).some((x) => x !== undefined);
  return hasAny ? product : undefined;
}

/** 요청 몸통 전체를 계산기 입력으로 바꾼다 */
function parseInput(body: unknown): FlooringCalcInput {
  if (!isObject(body)) throw new ValidationError('요청 형식이 잘못됐습니다');

  const mode = oneOf<FlooringMode>(body.mode, 'mode', ['평형', '실측'] as const) ?? '평형';

  // 종류는 반드시 있어야 한다 (무엇을 까는지 모르면 계산이 안 된다)
  const kind = oneOf<FlooringKind>(body.kind, 'kind', ['마루', '장판', '데코타일'] as const);
  if (!kind) throw new ValidationError('kind 는 마루 / 장판 / 데코타일 중 하나여야 합니다');

  // 베이는 2 / 3 / 4 만. 안 넣으면 계산기 기본값(3)을 쓴다.
  let bay: 2 | 3 | 4 | undefined;
  if (body.bay !== undefined && body.bay !== null) {
    const n = num(body.bay, 'bay', { min: 2, max: 4, required: true }) as number;
    if (n !== 2 && n !== 3 && n !== 4) throw new ValidationError('bay 는 2 / 3 / 4 중 하나여야 합니다');
    bay = n;
  }

  const input: FlooringCalcInput = {
    mode,
    pyeong: num(body.pyeong, 'pyeong', { min: 5, max: 200 }),
    bay,
    rooms: parseRooms(body.rooms),
    scope: oneOf<FlooringScope>(body.scope, 'scope', ['전체', '방만', '거실주방'] as const),
    kind,
    product: parseProduct(body.product),
    removeOld: bool(body.removeOld, 'removeOld'),
    baseboard: bool(body.baseboard, 'baseboard'),
  };

  // 모드별로 꼭 있어야 하는 칸 확인
  if (mode === '평형' && input.pyeong === undefined) {
    throw new ValidationError('평형 모드에서는 pyeong 값이 필요합니다');
  }
  if (mode === '실측' && (!input.rooms || input.rooms.length === 0)) {
    throw new ValidationError('실측 모드에서는 rooms 값이 필요합니다');
  }

  return input;
}

// ── 라우트 핸들러 ──────────────────────────────

/** POST — 바닥재 계산 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 형식이 아닙니다' }, { status: 400 });
  }

  let input: FlooringCalcInput;
  try {
    input = parseInput(body);
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : '입력을 확인해 주세요';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = calcFlooring(input);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    // 계산 중 문제는 서버 문제로 본다. 내부 메시지는 그대로 흘리지 않는다.
    console.error('[calc/flooring] 계산 실패', e);
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
