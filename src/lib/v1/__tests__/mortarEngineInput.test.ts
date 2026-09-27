// ──────────────────────────────────────────────
// 미장 좁혀가기(2026-09-27) — mortarEngineInput.ts 순수 함수 시험
//
// 계산 훅(useMortarCalc·useMortarQuickCalc)은 React 화면 없이 돌릴 수 없어서, 훅이 판단에 쓰는
// 순수 함수(toEngineInputWithAssumed·canHoldWhileMeasuring·mortarCostOutOfSync)를 여기서 확인한다.
// 훅은 이 함수들의 결과를 그대로 따른다(null이면 서버를 안 부르고, 어긋남이면 stale=true).
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  toEngineInput,
  toEngineInputWithAssumed,
  assumedAreaSqm,
  presetThicknessMm,
  ASSUMED_MORTAR_AREA_PYEONG,
  nonDimensionKey,
  canHoldWhileMeasuring,
  mortarRequestKey,
  mortarCostOutOfSync,
} from '../mortarEngineInput';
import { DEFAULT_MORTAR_FORM, encodeMortarForm, decodeMortarForm, type MortarFormState } from '../mortarQuery';
import { pyeongToExclusiveSqm, SQM_PER_PYEONG } from '../areaUnits';

/** 새 화면이 처음 열렸을 때처럼 아무것도 안 건드린 상태 */
const UNTOUCHED = { touched: {} };
/** 용도(방통)만 고른 상태 */
const USAGE_ONLY = { touched: { usage: true } };

describe('미장 좁혀가기 — 첫 단계(용도)', () => {
  it('용도를 안 골랐으면(touched.usage가 true 아님) 속에 방통 기본값이 있어도 계산하지 않는다', () => {
    expect(toEngineInputWithAssumed(DEFAULT_MORTAR_FORM, [], UNTOUCHED)).toBeNull();
    expect(toEngineInput(DEFAULT_MORTAR_FORM, [], { touched: { usage: false, area: true, thickness: true } })).toBeNull();
  });

  it('touched를 안 넘기면(옛 화면·공유 결과 화면) 예전처럼 기본 용도로 계산한다', () => {
    const input = toEngineInput(DEFAULT_MORTAR_FORM, []);
    expect(input).not.toBeNull();
    expect(input!.thicknessMm).toBe(45);
  });
});

describe('미장 좁혀가기 — 가정값', () => {
  it('용도만 고르면 면적 10평·기본 두께·손미장 가정으로 결과가 나온다', () => {
    const input = toEngineInputWithAssumed(DEFAULT_MORTAR_FORM, [], USAGE_ONLY)!;
    expect(input.assumed).toEqual(['area', 'thickness', 'method']);
    expect(ASSUMED_MORTAR_AREA_PYEONG).toBe(10);
    // 방통은 공급 평형 → 전용 ㎡ 표 규칙(기존 규칙 그대로)
    expect(input.request.areaSqm).toBe(pyeongToExclusiveSqm(10));
    expect(input.request.thicknessMm).toBe(45);
    // 공법 가정이면 공법 칸을 비워 보낸다 → 서버가 기본 손미장으로 계산
    expect(input.request.method).toBeUndefined();
  });

  it('셀프레벨링은 순수 단위 환산(×0.75 없음)·용도 기본 두께·공법 가정 없음', () => {
    const state: MortarFormState = {
      ...DEFAULT_MORTAR_FORM,
      mode: '셀프레벨링',
      usage: undefined,
      selfLevelUsage: '마루장판전',
      area: undefined,
      areaUnit: '㎡',
      thicknessMm: undefined,
    };
    const input = toEngineInputWithAssumed(state, [], USAGE_ONLY)!;
    expect(input.assumed).toEqual(['area', 'thickness']);
    expect(input.request.areaSqm).toBeCloseTo(10 * SQM_PER_PYEONG, 1);
    expect(input.request.thicknessMm).toBe(5);
    expect(presetThicknessMm(state)).toBe(5);
    expect(assumedAreaSqm(state)).toBe(input.request.areaSqm);
  });

  it('touched.area가 false면 폼에 면적(20평)이 있어도 10평 가정으로 계산한다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, area: 20 }, [], USAGE_ONLY)!;
    expect(input.request.areaSqm).toBe(pyeongToExclusiveSqm(10));
  });

  it('면적을 고르면 area 가정이 빠진다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, area: 20 }, [], { touched: { usage: true, area: true } })!;
    expect(input.assumed).toEqual(['thickness', 'method']);
    expect(input.request.areaSqm).toBe(pyeongToExclusiveSqm(20));
  });

  it('두께까지 고르면 thickness 가정이 빠지고 고른 두께로 계산한다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, area: 20, thicknessMm: 60 }, [], {
      touched: { usage: true, area: true, thickness: true },
    })!;
    expect(input.assumed).toEqual(['method']);
    expect(input.request.thicknessMm).toBe(60);
  });

  it('touched.thickness가 false면 폼 두께(60)가 아니라 용도 기본 두께(45)로 계산한다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, thicknessMm: 60 }, [], USAGE_ONLY)!;
    expect(input.request.thicknessMm).toBe(45);
  });

  it('공법 칩을 건드리면 method 가정이 빠지고 고른 공법이 요청에 실린다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, method: '장비타설' }, [], {
      touched: { usage: true, area: true, thickness: true, method: true },
    })!;
    expect(input.assumed).toEqual([]);
    expect(input.request.method).toBe('장비타설');
  });

  it('공법 칩을 안 건드렸으면 폼에 장비타설이 남아 있어도 기본(손미장 = 공법 칸 비움)으로 계산한다', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, method: '장비타설' }, [], USAGE_ONLY)!;
    expect(input.assumed).toContain('method');
    expect(input.request.method).toBeUndefined();
  });

  it('두께가 비어 있으면 touched가 없어도 용도 기본 두께로 가정한다(예전엔 null)', () => {
    const input = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, thicknessMm: undefined }, [])!;
    expect(input.request.thicknessMm).toBe(45);
    expect(input.assumed).toContain('thickness');
  });

  it('입력이 다 찬 경우 요청은 예전(touched 없는 옛 함수)과 같다', () => {
    const full: MortarFormState = { ...DEFAULT_MORTAR_FORM, area: 25, thicknessMm: 50, method: '손미장' };
    const withTouched = toEngineInput(full, [], { touched: { usage: true, area: true, thickness: true, method: true } });
    expect(withTouched).toEqual(toEngineInput(full, []));
  });

  it('공유 링크(?d=) 형식은 그대로다 — 풀어도 같은 요청', () => {
    const state: MortarFormState = { ...DEFAULT_MORTAR_FORM, area: 25, thicknessMm: 50 };
    const restored = decodeMortarForm(encodeMortarForm(state))!;
    expect(restored).toEqual(state);
    expect(toEngineInput(restored, [])).toEqual(toEngineInput(state, []));
  });
});

describe('미장 정확 모드 — 실측 입력 중', () => {
  /** 정확 모드·방통·구역 1개 채움 + 빈 구역 카드 1개 */
  const SHOWN: MortarFormState = {
    ...DEFAULT_MORTAR_FORM,
    view: 'precise',
    preciseRooms: [
      { name: '거실', areaSqm: 30 },
      { name: '', areaSqm: 0 },
    ],
  };
  const TOUCHED = { touched: { usage: true, thickness: true } };
  const shownKey = nonDimensionKey(toEngineInputWithAssumed(SHOWN, [], TOUCHED)!);

  it('구역이 전부 비었으면 10평 가정 + area·measuring', () => {
    const input = toEngineInputWithAssumed({ ...SHOWN, preciseRooms: [{ name: '', areaSqm: 0 }] }, [], TOUCHED)!;
    expect(input.request.areaSqm).toBe(pyeongToExclusiveSqm(10));
    expect(input.assumed).toEqual(['area', 'method', 'measuring']);
  });

  it('구역 면적만 바뀌는 동안은 직전 결과 유지', () => {
    const next = toEngineInputWithAssumed({ ...SHOWN, preciseRooms: [{ name: '거실', areaSqm: 32 }, { name: '', areaSqm: 0 }] }, [], TOUCHED)!;
    expect(canHoldWhileMeasuring(next, shownKey)).toBe(true);
  });

  it('실측 입력 중에 두께·공법·용도를 바꾸면 새 요청(채운 구역만으로)', () => {
    for (const patch of [
      { thicknessMm: 60 },
      { method: '장비타설' as const },
      { mode: '셀프레벨링' as const, usage: undefined, selfLevelUsage: '타일전' as const, thicknessMm: 10 },
    ]) {
      const next = toEngineInputWithAssumed({ ...SHOWN, ...patch }, [], { touched: { usage: true, thickness: true, method: true } })!;
      expect(canHoldWhileMeasuring(next, shownKey)).toBe(false);
      expect(next.request.rooms).toHaveLength(1);
    }
  });
});

describe('미장 수량·금액 어긋남 표시', () => {
  const T = { touched: { usage: true, area: true, thickness: true } };
  const shownFrom = (s: MortarFormState) => {
    const b = toEngineInputWithAssumed(s, [], T)!;
    return { requestKey: mortarRequestKey(b.request), restKey: nonDimensionKey(b) };
  };

  it('두께를 바꾸면 즉시 포수는 새 입력, 금액은 옛 입력 → 어긋남(true)', () => {
    const shown = shownFrom({ ...DEFAULT_MORTAR_FORM, area: 20, thicknessMm: 45 });
    const now = toEngineInputWithAssumed({ ...DEFAULT_MORTAR_FORM, area: 20, thicknessMm: 50 }, [], T);
    expect(mortarCostOutOfSync(now, shown)).toBe(true);
  });

  it('같은 입력이면 어긋남 없음(false)', () => {
    const s = { ...DEFAULT_MORTAR_FORM, area: 20, thicknessMm: 45 };
    expect(mortarCostOutOfSync(toEngineInputWithAssumed(s, [], T), shownFrom(s))).toBe(false);
  });

  it('보이는 금액이 없거나 용도 미선택이면 어긋남 없음(false)', () => {
    expect(mortarCostOutOfSync(toEngineInputWithAssumed(DEFAULT_MORTAR_FORM, [], T), null)).toBe(false);
    expect(mortarCostOutOfSync(null, shownFrom(DEFAULT_MORTAR_FORM))).toBe(false);
  });

  it('실측 입력 중 면적만 바뀌는 유지 상태는 어긋남으로 보지 않는다', () => {
    const P = { touched: { usage: true, thickness: true } };
    const base: MortarFormState = { ...DEFAULT_MORTAR_FORM, view: 'precise', preciseRooms: [{ name: 'a', areaSqm: 30 }, { name: '', areaSqm: 0 }] };
    const b = toEngineInputWithAssumed(base, [], P)!;
    const shown = { requestKey: mortarRequestKey(b.request), restKey: nonDimensionKey(b) };
    const now = toEngineInputWithAssumed({ ...base, preciseRooms: [{ name: 'a', areaSqm: 31 }, { name: '', areaSqm: 0 }] }, [], P);
    expect(mortarCostOutOfSync(now, shown)).toBe(false);
  });
});
