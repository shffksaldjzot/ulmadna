// ──────────────────────────────────────────────
// flooringEngineInput.ts의 순수 함수 toEngineInput·trimFormForShare 단위 테스트
//
// 도배 계산기의 useWallpaperCalc.test.ts와 같은 방식 — React 없이 "폼 상태 → 서버
// 요청 모양" 변환만 확인한다. 지시서 U(20260910) 검증 항목 4건 그대로.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { toEngineInput, trimFormForShare } from '../flooringEngineInput';
import { DEFAULT_FLOORING_FORM, type FlooringFormState, type FlooringProductOption } from '../flooringQuery';

// 제품 마스터 목록이 필요한 자리엔 빈 배열을 넣는다(이 테스트들은 productCode를 쓰지 않는다)
const NO_PRODUCTS: FlooringProductOption[] = [];

describe('toEngineInput', () => {
  it('종류(kind)를 안 고르면 다른 값이 다 차 있어도 계산하지 않는다(null)', () => {
    // DEFAULT_FLOORING_FORM 자체가 kind 없음 — 평형·베이가 다 있어도 계산 안 함
    expect(toEngineInput(DEFAULT_FLOORING_FORM, NO_PRODUCTS)).toBeNull();
  });

  it('간단 모드에서 종류만 고르고 제품을 안 고르면 계산하지 않는다(null) — 형아 지시', () => {
    const noProduct: FlooringFormState = { ...DEFAULT_FLOORING_FORM, kind: '마루' };
    expect(toEngineInput(noProduct, NO_PRODUCTS)).toBeNull();
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

  it('정확 모드에서 방이 전부 빈 값이면 평형으로 폴백하지 않고 null이다', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      view: 'precise',
      preciseRooms: [{ w: 0, d: 0 }],
    };
    expect(toEngineInput(state, NO_PRODUCTS)).toBeNull();
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

  it('평형이 5 미만이면 계산하지 않는다(null)', () => {
    const state: FlooringFormState = {
      ...DEFAULT_FLOORING_FORM,
      kind: '마루',
      pyeong: 4,
      product: { pricePerBox: 39000, sqmPerBox: 1.5 },
    };
    expect(toEngineInput(state, NO_PRODUCTS)).toBeNull();
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
