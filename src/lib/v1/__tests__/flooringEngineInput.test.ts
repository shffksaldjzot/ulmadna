// ──────────────────────────────────────────────
// flooringEngineInput.ts의 순수 함수 toEngineInput·trimFormForShare 단위 테스트
//
// 도배 계산기의 useWallpaperCalc.test.ts와 같은 방식 — React 없이 "폼 상태 → 서버
// 요청 모양" 변환만 확인한다. 지시서 U(20260910) 검증 항목 4건 그대로.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  toEngineInput,
  toEngineInputWithAssumed,
  trimFormForShare,
  describeAreaPair,
  ASSUMED_PYEONG,
  nonDimensionKey,
  canHoldWhileMeasuring,
  productOptionToRequest,
} from '../flooringEngineInput';
import { isShowableFlooringProduct } from '../flooringProductOptions';
import {
  DEFAULT_FLOORING_FORM,
  encodeFlooringForm,
  decodeFlooringForm,
  type FlooringFormState,
  type FlooringProductOption,
} from '../flooringQuery';

// 제품 마스터 목록이 필요한 자리엔 빈 배열을 넣는다(이 테스트들은 productCode를 쓰지 않는다)
const NO_PRODUCTS: FlooringProductOption[] = [];

describe('toEngineInput', () => {
  it('종류(kind)를 안 고르면 다른 값이 다 차 있어도 계산하지 않는다(null)', () => {
    // DEFAULT_FLOORING_FORM 자체가 kind 없음 — 평형·베이가 다 있어도 계산 안 함
    expect(toEngineInput(DEFAULT_FLOORING_FORM, NO_PRODUCTS)).toBeNull();
  });

  it('간단 모드에서 자재만 고르면 제품 없이 요청을 만들고 "제품" 가정을 표시한다 — 2026-09-27 좁혀가기', () => {
    // 예전(9/10 형아 지시)엔 null이었다. 좁혀가기로 바뀌어 서버가 그 자재의 노출 제품 전체 범위로 계산한다.
    const noProduct: FlooringFormState = { ...DEFAULT_FLOORING_FORM, kind: '마루' };
    const input = toEngineInputWithAssumed(noProduct, NO_PRODUCTS);
    expect(input!.request.product).toBeUndefined();
    expect(input!.assumed).toContain('product');
  });

  it('정확 모드에서 유효한 방이 1개 이상이면 실측 요청을 만든다(제품 없어도 종류 평균가로 계산)', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '장판',
      view: 'precise',
      preciseRooms: [{ w: 4, d: 3 }],
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.mode).toBe('실측');
    expect(input!.rooms).toEqual([{ name: '방1', widthM: 4, depthM: 3 }]);
    expect(input!.kind).toBe('장판');
    expect(input!.product).toBeUndefined();
  });

  it('검사관 1라운드 지적 1번: 정확(실측) 모드는 범위 칩 값과 무관하게 scope를 전체로 고정한다', () => {
    // 폼에 '방만'이 남아 있어도(예: 간단 모드에서 골랐다가 정확 모드로 넘어온 경우)
    // 실측 요청은 항상 scope: '전체'로 나가야 한다 — 엔진이 실측이면 범위를 무시하기 때문
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '장판',
      view: 'precise',
      scope: '방만',
      preciseRooms: [{ w: 4, d: 3 }],
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.scope).toBe('전체');
  });

  it('정확 모드에서 방이 전부 빈 값이면 34평 가정으로 계산하고 area·measuring을 표시한다 — 2026-09-27(예전엔 null)', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      pyeong: 24, // 간단 모드에 남은 값이 아니라 가정값 34평을 써야 한다
      view: 'precise',
      preciseRooms: [{ w: 0, d: 0 }],
    };
    const input = toEngineInputWithAssumed(state, NO_PRODUCTS)!;
    expect(input.request.mode).toBe('평형');
    expect(input.request.pyeong).toBe(ASSUMED_PYEONG);
    expect(input.request.scope).toBe('전체');
    expect(input.assumed).toEqual(['area', 'product', 'measuring']);
  });

  it('간단 모드 + 직접 입력 제품이 있으면 평형 요청을 만든다', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      product: { pricePerBox: 39000, sqmPerBox: 1.5, widthMm: 148, lengthMm: 1818 },
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.mode).toBe('평형');
    expect(input!.pyeong).toBe(34);
    expect(input!.bay).toBe(3);
    expect(input!.product?.pricePerBox).toBe(39000);
  });

  it('평형이 5 미만이면 서버로 보내지 않고 34평 가정으로 계산한다 — 2026-09-27(예전엔 null)', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      pyeong: 4,
      product: { pricePerBox: 39000, sqmPerBox: 1.5 },
    };
    const input = toEngineInputWithAssumed(state, NO_PRODUCTS)!;
    expect(input.request.pyeong).toBe(ASSUMED_PYEONG);
    expect(input.assumed).toContain('area');
  });
});

describe('trimFormForShare', () => {
  it('simple 모드에서는 preciseRooms·unit을 지운다', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      view: 'simple',
      preciseRooms: [{ w: 4, d: 3 }],
      unit: 'mm',
    };
    const trimmed = trimFormForShare(state);
    expect(trimmed.preciseRooms).toBeUndefined();
    expect(trimmed.unit).toBeUndefined();
    // 간단 모드 값(평형·베이)은 그대로 남는다
    expect(trimmed.pyeong).toBe(34);
    expect(trimmed.bay).toBe(3);
  });

  it('precise 모드에서는 pyeong·bay·scope를 지운다(검사관 1라운드 지적 1번)', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      view: 'precise',
      scope: '거실주방',
      preciseRooms: [{ w: 4, d: 3 }],
    };
    const trimmed = trimFormForShare(state);
    expect(trimmed.pyeong).toBeUndefined();
    expect(trimmed.bay).toBeUndefined();
    expect(trimmed.scope).toBeUndefined();
    expect(trimmed.preciseRooms).toEqual([{ w: 4, d: 3 }]);
  });
});

// 2026-09-15 형아 지시: 도배와 같은 ㎡(전용면적 직접 입력) 모드를 바닥재에도 추가했다.
describe('㎡ 모드 (전용면적 직접 입력)', () => {
  const PRODUCT: FlooringFormState['product'] = { pricePerBox: 39000, sqmPerBox: 1.5, widthMm: 148, lengthMm: 1818 };

  it('areaUnit이 ㎡면 exclusiveSqm을 그대로 보내고 pyeong 환산을 거치지 않는다', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      product: PRODUCT,
      areaUnit: '㎡',
      exclusiveSqm: 84,
      pyeong: undefined,
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.mode).toBe('평형');
    expect(input!.exclusiveSqm).toBe(84);
    expect(input!.pyeong).toBeUndefined();
  });

  it('㎡ 모드에서 전용면적이 최소값(20) 미만이면 34평 가정으로 계산한다 — 2026-09-27(예전엔 null)', () => {
    const state: FlooringFormState = { ...DEFAULT_FLOORING_FORM, kind: '마루', product: PRODUCT, areaUnit: '㎡', exclusiveSqm: 10 };
    const input = toEngineInputWithAssumed(state, NO_PRODUCTS)!;
    expect(input.request.pyeong).toBe(ASSUMED_PYEONG);
    expect(input.request.exclusiveSqm).toBeUndefined();
    expect(input.assumed).toContain('area');
  });

  it('기존 공유 링크(areaUnit 필드 없음)는 평 모드로 그대로 해석된다', () => {
    const { areaUnit: _unused, ...withoutAreaUnit } = { ...DEFAULT_FLOORING_FORM, kind: '마루' as const, product: PRODUCT };
    const input = toEngineInput(withoutAreaUnit as FlooringFormState, NO_PRODUCTS);
    expect(input!.pyeong).toBe(34);
    expect(input!.exclusiveSqm).toBeUndefined();
  });
});

describe('describeAreaPair — 결과 요약줄 "34평 · 84㎡" 병기 (2026-09-16: "공급"·"전용" 단어 삭제)', () => {
  it('평 모드는 칩 평형표로 전용 ㎡를 병기한다', () => {
    expect(describeAreaPair({ ...DEFAULT_FLOORING_FORM, pyeong: 34 })).toBe('34평 · 84㎡');
  });

  it('㎡ 모드는 입력한 전용면적을 그대로 쓴다', () => {
    const label = describeAreaPair({ ...DEFAULT_FLOORING_FORM, areaUnit: '㎡', exclusiveSqm: 84 });
    expect(label).toContain('84㎡');
  });
});

// ──────────────────────────────────────────────
// 2026-09-27 좁혀가기(도배와 같은 원칙) — 가정값·가정 목록·실측 입력 중 유지
// ──────────────────────────────────────────────
describe('좁혀가기 — 가정값·가정 목록', () => {
  it('자재를 안 골랐으면 건드림 표시가 다 켜져 있어도 계산하지 않는다(null = 훅이 서버를 부르지 않는다)', () => {
    expect(toEngineInputWithAssumed(DEFAULT_FLOORING_FORM, NO_PRODUCTS, { touched: { area: true, bay: true, scope: true } })).toBeNull();
  });

  it('면적이 비었으면 34평 가정 + area', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_FLOORING_FORM, kind: '장판', pyeong: undefined }, NO_PRODUCTS)!;
    expect(input.request.pyeong).toBe(34);
    expect(input.assumed).toEqual(['area', 'product']);
  });

  it('touched를 넘기면 안 건드린 것은 폼 기본값이 있어도 전부 가정이다(순서 고정)', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_FLOORING_FORM, kind: '마루' }, NO_PRODUCTS, { touched: {} })!;
    expect(input.assumed).toEqual(['area', 'product', 'bay', 'scope']);
  });

  it('touched.area가 false면 폼의 24평이 아니라 34평으로 계산한다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_FLOORING_FORM, kind: '마루', pyeong: 24 }, NO_PRODUCTS, { touched: { area: false } })!;
    expect(input.request.pyeong).toBe(ASSUMED_PYEONG);
  });

  it('면적·베이·범위를 다 건드리고 제품도 고르면 가정이 하나도 없다', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      pyeong: 24,
      bay: 2,
      scope: '방만',
      product: { pricePerBox: 39000, sqmPerBox: 1.5 },
    };
    const input = toEngineInputWithAssumed(state, NO_PRODUCTS, { touched: { area: true, bay: true, scope: true } })!;
    expect(input.assumed).toEqual([]);
    expect(input.request).toMatchObject({ pyeong: 24, bay: 2, scope: '방만' });
  });

  it('철거·걸레받이 토글은 가정 목록에 안 들어간다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_FLOORING_FORM, kind: '마루', removeOld: undefined, baseboard: undefined }, NO_PRODUCTS)!;
    expect(input.assumed).toEqual(['product']);
    expect(input.request.removeOld).toBe(true);
    expect(input.request.baseboard).toBe(true);
  });

  it('toEngineInput(옛 이름)은 요청만 돌려준다 — 공유 결과 화면 호환', () => {
    const state: FlooringFormState = { ...DEFAULT_FLOORING_FORM, kind: '데코타일' };
    expect(toEngineInput(state, NO_PRODUCTS)).toEqual(toEngineInputWithAssumed(state, NO_PRODUCTS)!.request);
  });

  it('isShowableFlooringProduct는 요청을 만들 수 있는 제품만 true', () => {
    const box: FlooringProductOption = {
      code: 'x', brand: 'A', name: '가', kind: '마루', saleUnit: '박스', price: 50000, sqmPerBox: 1.6, pcsPerBox: 8,
      widthMm: 190, lengthMm: 1200, rollWidthM: null, thicknessMm: 7.5, lossRate: null, variant: '',
    };
    expect(isShowableFlooringProduct(box)).toBe(true);
    expect(productOptionToRequest(box)?.pricePerBox).toBe(50000);
    expect(isShowableFlooringProduct({ ...box, sqmPerBox: null })).toBe(false);
    expect(isShowableFlooringProduct({ ...box, price: null })).toBe(false);
  });

  it('공유 링크(?d=) 형식은 그대로다 — 풀어도 같은 요청', () => {
    const state: FlooringFormState = { ...DEFAULT_FLOORING_FORM, kind: '마루', pyeong: 30, product: { pricePerBox: 39000, sqmPerBox: 1.5 } };
    const restored = decodeFlooringForm(encodeFlooringForm(state))!;
    expect(restored).toEqual(state);
    expect(toEngineInput(restored, NO_PRODUCTS)).toEqual(toEngineInput(state, NO_PRODUCTS));
  });
});

describe('실측 입력 중 직전 결과 유지 범위 (도배 검사관 결함 재발 방지)', () => {
  /** 직전 결과 상태: 마루·제품 미정·정확 모드·유효한 방 1개 + 빈 방 카드 1개 */
  const SHOWN: FlooringFormState = {
    ...DEFAULT_FLOORING_FORM,
    kind: '마루',
    view: 'precise',
    preciseRooms: [
      { w: 4, d: 3 },
      { w: 0, d: 0 },
    ],
  };
  const shownKey = nonDimensionKey(toEngineInputWithAssumed(SHOWN, NO_PRODUCTS)!);

  it('치수만 바뀌고 여전히 덜 찬 상태면 새 요청 없이 유지', () => {
    const next = toEngineInputWithAssumed({ ...SHOWN, preciseRooms: [{ w: 4.2, d: 3 }, { w: 2, d: 0 }] }, NO_PRODUCTS)!;
    expect(next.assumed).toContain('measuring');
    expect(canHoldWhileMeasuring(next, shownKey)).toBe(true);
  });

  it('실측 입력 중에 자재를 바꾸면 새 요청(유효한 방만으로)', () => {
    const next = toEngineInputWithAssumed({ ...SHOWN, kind: '장판' }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(next, shownKey)).toBe(false);
    expect(next.request.mode).toBe('실측');
    expect(next.request.rooms).toHaveLength(1);
    expect(next.request.kind).toBe('장판');
  });

  it('실측 입력 중에 제품·철거·걸레받이를 바꾸면 새 요청', () => {
    for (const patch of [
      { product: { pricePerBox: 39000, sqmPerBox: 1.5 } },
      { removeOld: false },
      { baseboard: false },
    ] as Partial<FlooringFormState>[]) {
      const next = toEngineInputWithAssumed({ ...SHOWN, ...patch }, NO_PRODUCTS)!;
      expect(canHoldWhileMeasuring(next, shownKey)).toBe(false);
    }
  });

  it('유효한 방이 없으면 34평 가정으로 새 요청, 그 뒤 치수 입력 중엔 유지', () => {
    const empty = toEngineInputWithAssumed({ ...SHOWN, kind: '장판', preciseRooms: [{ w: 0, d: 0 }] }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(empty, shownKey)).toBe(false);
    expect(empty.request.pyeong).toBe(34);
    const typing = toEngineInputWithAssumed({ ...SHOWN, kind: '장판', preciseRooms: [{ w: 3, d: 0 }] }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(typing, nonDimensionKey(empty))).toBe(true);
  });

  it('보이는 결과가 없거나 실측 입력 중이 아니면 유지하지 않는다', () => {
    const now = toEngineInputWithAssumed(SHOWN, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(now, null)).toBe(false);
    const done = toEngineInputWithAssumed({ ...SHOWN, preciseRooms: [{ w: 4, d: 3 }] }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(done, shownKey)).toBe(false);
  });
});