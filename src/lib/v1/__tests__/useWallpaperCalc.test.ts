// ──────────────────────────────────────────────
// wallpaperEngineInput.ts의 순수 함수 toEngineInput 단위 테스트
//
// 왜 이 파일만 따로 테스트하나:
//   useWallpaperCalc 훅 전체는 React state·타이머·fetch까지 얽혀 있어 브라우저 없이
//   테스트하기 번거롭다. 하지만 "폼 상태 → 서버에 보낼 요청 모양으로 바꾸는" 부분은
//   React 없이도 그대로 돌아가는 순수 함수(toEngineInput)라서, 그 부분만 여기서 값을
//   확인한다(react 렌더링은 하지 않는다).
//   ※ 2026년 09월 09일: toEngineInput은 useWallpaperCalc.ts에서 wallpaperEngineInput.ts로
//     옮겨졌다(공유 링크 결과 화면이 서버 컴포넌트라 'use client' 훅 파일을 못 써서 분리함).
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { toEngineInput, describePreciseInput } from '../wallpaperEngineInput';
import { DEFAULT_CALC_FORM, type WallpaperFormState, type WallpaperProductOption } from '../wallpaperQuery';

// 제품 마스터 목록이 필요한 자리엔 빈 배열을 넣는다(이 테스트들은 productCode를 쓰지 않는다)
const NO_PRODUCTS: WallpaperProductOption[] = [];

describe('toEngineInput', () => {
  it('평형만 있고 벽지 종류를 아직 안 골랐으면(즉답 기본값) 합지·실크를 병렬로 부르는 병합 요청이 된다', () => {
    // DEFAULT_CALC_FORM은 paperType이 없는 즉답 기본값(34평 3베이)이다
    const input = toEngineInput(DEFAULT_CALC_FORM, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.mode).toBe('평형');
    expect(input!.base.pyeong).toBe(34);
    expect(input!.base.bay).toBe(3);
    // 벽지 종류를 아직 안 골랐으니 병합 호출(합지+실크 두 번)이어야 한다
    expect(input!.paper.mergeBoth).toBe(true);
  });

  it('벽지 종류를 고르면 병합하지 않고 그 종류 하나만 요청한다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크' };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.paper.mergeBoth).toBe(false);
    expect(input!.paper.paperType).toBe('실크');
  });

  it('isOld를 true(구축·재도배)로 두면 요청 바디에 그대로 실린다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, isOld: true };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.base.isOld).toBe(true);
    // 기본값(false)일 때도 확인 — DEFAULT_CALC_FORM 자체가 isOld: false다
    const defaultInput = toEngineInput(DEFAULT_CALC_FORM, NO_PRODUCTS);
    expect(defaultInput!.base.isOld).toBe(false);
  });

  it('벽 길이 모드에서 문 1개·창 1개(120×150cm)를 빼면 벽면적이 3.69㎡ 줄어든다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      entry: 'length',
      wallLength: 10,
      heightM: 2.3,
      lengthOpenings: [
        // 2026-09-09 검사관 지적 수리 후: 문·창 구분 없이 입력한 실제 폭·높이(cm)를 그대로 쓴다.
        // 이 문은 표준 규격(0.9×2.1m)과 우연히 같은 값(90×210)이라 결과는 이전과 같다.
        { kind: 'door', w: 90, h: 210, count: 1 },
        // 창은 입력한 폭·높이(cm)를 그대로 m로 바꿔 계산한다: 1.2m × 1.5m = 1.8㎡
        { kind: 'window', w: 120, h: 150, count: 1 },
      ],
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    // 개구부 없을 때 벽 면적 = 10m(둘레) × 2.3m(높이) = 23㎡
    // 문(1.89㎡) + 창(1.8㎡) = 3.69㎡를 뺀 19.31㎡가 나와야 한다
    expect(input!.base.areas?.wallSqm).toBeCloseTo(19.31, 5);
  });

  it('문 규격을 표준과 다르게 입력하면(1m×2.2m) 표준값이 아니라 입력값 그대로 빠진다', () => {
    // 검사관 지적: 예전엔 문 규격을 아무리 다르게 넣어도 표준 0.9×2.1m(1.89㎡)만 빠졌다.
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      entry: 'length',
      wallLength: 10,
      heightM: 2.3,
      lengthOpenings: [{ kind: 'door', w: 100, h: 220, count: 1 }], // 1.0m × 2.2m = 2.2㎡
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    // 23㎡ - 2.2㎡ = 20.8㎡ (표준값 1.89㎡를 뺐다면 21.11㎡가 나왔을 것 — 그럼 이 테스트가 실패한다)
    expect(input!.base.areas?.wallSqm).toBeCloseTo(20.8, 5);
  });

  it('실측 방 카드가 전부 빈 값이면 정밀 폼을 무시하고 즉답 평형으로 계산한다', () => {
    // 검사관 지적: 예전엔 유효한 방이 0개면 toEngineInput 전체가 null이 되어
    // 즉답(평형)까지 같이 사라졌다. 이제는 평형으로 폴백해야 한다.
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      entry: 'room',
      preciseRooms: [{ w: 0, d: 0, openings: [] }], // 아직 아무 것도 안 채운 빈 방 카드 1장
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.mode).toBe('평형');
    expect(input!.base.pyeong).toBe(34);
  });

  it('평형이 1~4처럼 5 미만이면 계산하지 않는다(null)', () => {
    // 검사관 지적: 서버가 5평 미만을 거부하는데 그대로 보내면 매번 실패만 뜬다.
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, pyeong: 4 };
    expect(toEngineInput(state, NO_PRODUCTS)).toBeNull();
  });

  it('평형 5는 그대로 통과한다(경계값)', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, pyeong: 5 };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.pyeong).toBe(5);
  });

  it('벽지 종류를 바꿨는데 이전 종류의 제품 코드가 안 지워져 있으면 그 제품을 무시한다', () => {
    // 검사관 지적(치명 1번) 안전장치: WallpaperCalculator가 정상 배선되면 이 상황 자체가
    // 안 생기지만, resolvePaperSelection 자체에도 방어 코드를 넣었는지 확인한다.
    const products: WallpaperProductOption[] = [
      {
        code: 'silk_a',
        brand: 'A',
        name: '실크A',
        kind: '실크',
        widthCm: 106,
        lengthM: 15.6,
        repeatCm: 0,
        price: 40000,
        sourceLabel: '웹 조사 기준 · 2026.9',
      },
    ];
    // productCode는 실크 제품인데 paperType은 합지로 바뀐 상태(정상 배선이면 안 생기는 조합)
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '합지', productCode: 'silk_a' };
    const input = toEngineInput(state, products);
    expect(input!.paper.mergeBoth).toBe(false);
    expect(input!.paper.paperType).toBe('합지');
    // 실크 제품 규격이 섞여 들어가면 안 된다
    expect(input!.paper.product).toBeUndefined();
  });
});

describe('describePreciseInput', () => {
  // 검사관 2라운드 지적 N2·N4: QuickAnswer(칩 잠금)·PreciseSection(배지)·result 요약줄이
  // 전부 이 함수 하나로 "정밀 폼이 지금 유효한가"를 판정해야 서로 어긋나지 않는다.

  it('유효한(가로·세로 다 채운) 방이 있으면 {kind:"room", count}를 돌려준다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      entry: 'room',
      preciseRooms: [
        { w: 4, d: 3, openings: [] },
        { w: 3, d: 3, openings: [] },
      ],
    };
    expect(describePreciseInput(state)).toEqual({ kind: 'room', count: 2 });
  });

  it('방 카드가 있어도 전부 빈 값(가로·세로 미입력)이면 null이다 — 빈 카드는 개수에 안 들어간다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      entry: 'room',
      preciseRooms: [{ w: 0, d: 0, openings: [] }],
    };
    expect(describePreciseInput(state)).toBeNull();
  });

  it('유효한 방과 빈 방이 섞여 있으면 유효한 방만 센다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      entry: 'room',
      preciseRooms: [
        { w: 4, d: 3, openings: [] },
        { w: 0, d: 0, openings: [] }, // 아직 안 채운 카드
      ],
    };
    expect(describePreciseInput(state)).toEqual({ kind: 'room', count: 1 });
  });

  it('벽 길이가 유효하면 {kind:"length"}를 돌려준다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, entry: 'length', wallLength: 12 };
    expect(describePreciseInput(state)).toEqual({ kind: 'length' });
  });

  it('정밀 폼을 안 썼으면(즉답 평형만) null이다', () => {
    expect(describePreciseInput(DEFAULT_CALC_FORM)).toBeNull();
  });
});
