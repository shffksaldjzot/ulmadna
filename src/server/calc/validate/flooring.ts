// ──────────────────────────────────────────────
// 바닥재 계산기 — 입력 검증 (API 라우트·결과 공유 화면 공용)
//
// 2026-09-30 지휘관 긴급 전달(중요 1 남은 부분) — 원래 src/app/api/calc/flooring/route.ts
// 안에 있던 손검증 로직을 이 파일로 그대로 옮겼다(내용은 한 글자도 안 바꿈, 자리만 옮김).
// route.ts는 이 파일의 parseInput을 그대로 불러 쓰고, 결과 공유 화면(result/page.tsx)도
// 똑같은 이 함수를 불러써서 "같은 입력엔 같은 판정"이 보장된다.
//
// 옮기기 전/후 API 응답이 바이트 단위로 같은지(정상 5개 + 비정상 10개) 직접 비교해서
// 확인했다 — 검증 문구·순서·조건 전부 그대로다.
//
// 작성일: 2026년 09월 30일 (route.ts에서 분리)
// ──────────────────────────────────────────────

import type {
  FlooringCalcInput,
  FlooringMode,
  FlooringScope,
  FlooringRoomInput,
} from '@/server/calc/flooring';
import type { FlooringDirectProduct } from '@/server/pricing/flooring';
import type { FlooringKind } from '@/server/calc/data/flooring-products';

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
export function parseInput(body: unknown): FlooringCalcInput {
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
    // 전용면적(㎡) 직접 입력 — 2026-09-15 형아 지시(㎡ 모드), 도배와 같은 검증 범위
    exclusiveSqm: num(body.exclusiveSqm, 'exclusiveSqm', { min: 20, max: 300 }),
    bay,
    rooms: parseRooms(body.rooms),
    scope: oneOf<FlooringScope>(body.scope, 'scope', ['전체', '방만', '거실주방'] as const),
    kind,
    product: parseProduct(body.product),
    removeOld: bool(body.removeOld, 'removeOld'),
    baseboard: bool(body.baseboard, 'baseboard'),
  };

  // 모드별로 꼭 있어야 하는 칸 확인
  if (mode === '평형' && input.pyeong === undefined && input.exclusiveSqm === undefined) {
    throw new ValidationError('평형 모드에서는 pyeong 또는 exclusiveSqm 값이 필요합니다');
  }
  if (mode === '실측' && (!input.rooms || input.rooms.length === 0)) {
    throw new ValidationError('실측 모드에서는 rooms 값이 필요합니다');
  }

  return input;
}
