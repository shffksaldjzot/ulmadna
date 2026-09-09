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
import { toEngineInput, describePreciseInput, resolveView } from '../wallpaperEngineInput';
import { DEFAULT_CALC_FORM, type WallpaperFormState, type WallpaperProductOption } from '../wallpaperQuery';

// 제품 마스터 목록이 필요한 자리엔 빈 배열을 넣는다(이 테스트들은 productCode를 쓰지 않는다)
const NO_PRODUCTS: WallpaperProductOption[] = [];

describe('toEngineInput', () => {
  // DEFAULT_CALC_FORM은 paperType이 없는 상태다(2026-09-09 화면 재배치 — 벽지 최우선 A안).
  // 아래 대부분의 테스트는 계산이 실제로 되는 경로를 보고 싶은 것이므로 paperType을 따로 얹는다.
  const SILK: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크' };

  it('벽지 종류를 안 골랐으면 다른 값이 다 차 있어도 계산하지 않는다(null) — 병합 즉답 폐기', () => {
    // 예전엔 종류 미선택 시 합지·실크를 둘 다 계산해 범위를 합치는 "병합 즉답"이 있었지만,
    // 벽지가 1번 카드로 맨 위에 오면서 폐기했다. DEFAULT_CALC_FORM 자체가 paperType 없음이다.
    expect(toEngineInput(DEFAULT_CALC_FORM, NO_PRODUCTS)).toBeNull();
  });

  it('벽지 종류를 고르면 그 종류 하나만 요청한다', () => {
    const input = toEngineInput(SILK, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.mode).toBe('평형');
    expect(input!.base.pyeong).toBe(34);
    expect(input!.base.bay).toBe(3);
    expect(input!.paper.paperType).toBe('실크');
  });

  it('isOld를 true(구축·재도배)로 두면 요청 바디에 그대로 실린다', () => {
    const input = toEngineInput({ ...SILK, isOld: true }, NO_PRODUCTS);
    expect(input!.base.isOld).toBe(true);
    // 기본값(false)일 때도 확인
    const defaultInput = toEngineInput(SILK, NO_PRODUCTS);
    expect(defaultInput!.base.isOld).toBe(false);
  });

  it('precise 모드 + 벽 길이 모드에서 문 1개·창 1개(120×150cm)를 빼면 벽면적이 3.69㎡ 줄어든다', () => {
    const state: WallpaperFormState = {
      ...SILK,
      view: 'precise',
      entry: 'length',
      wallLength: 10,
      heightM: 2.3,
      lengthOpenings: [
        // 문·창 구분 없이 입력한 실제 폭·높이(cm)를 그대로 쓴다.
        // 이 문은 표준 규격(0.9×2.1m)과 우연히 같은 값(90×210)이라 결과는 표준값과 같다.
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
      ...SILK,
      view: 'precise',
      entry: 'length',
      wallLength: 10,
      heightM: 2.3,
      lengthOpenings: [{ kind: 'door', w: 100, h: 220, count: 1 }], // 1.0m × 2.2m = 2.2㎡
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    // 23㎡ - 2.2㎡ = 20.8㎡ (표준값 1.89㎡를 뺐다면 21.11㎡가 나왔을 것 — 그럼 이 테스트가 실패한다)
    expect(input!.base.areas?.wallSqm).toBeCloseTo(20.8, 5);
  });

  it('precise 모드에서 방이 전부 빈 값이면 평형으로 폴백하지 않고 null이다', () => {
    // 2026-09-09 재배치 새 규칙: "간단하게"와 "정확하게"가 이제 아예 다른 카드라서,
    // 정밀 입력이 무효하다고 평형(간단 모드) 값으로 조용히 넘어가면 안 된다.
    const state: WallpaperFormState = {
      ...SILK,
      view: 'precise',
      entry: 'room',
      preciseRooms: [{ w: 0, d: 0, openings: [] }], // 아직 아무 것도 안 채운 빈 방 카드 1장
    };
    expect(toEngineInput(state, NO_PRODUCTS)).toBeNull();
  });

  it('simple 모드면 정밀 폼에 값이 남아 있어도 무시하고 평형만 본다', () => {
    // 정밀 모드를 썼다가 간단 모드로 돌아온 경우(view만 바뀌고 preciseRooms는 안 지워짐)를
    // 흉내낸다 — 계산은 평형 기준으로만 나와야 한다.
    const state: WallpaperFormState = {
      ...SILK,
      view: 'simple',
      pyeong: 24,
      preciseRooms: [{ w: 4, d: 3, openings: [] }], // 남아 있는 정밀 값(무시돼야 한다)
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.mode).toBe('평형');
    expect(input!.base.pyeong).toBe(24);
  });

  it('평형이 1~4처럼 5 미만이면 계산하지 않는다(null)', () => {
    // 검사관 지적: 서버가 5평 미만을 거부하는데 그대로 보내면 매번 실패만 뜬다.
    expect(toEngineInput({ ...SILK, pyeong: 4 }, NO_PRODUCTS)).toBeNull();
  });

  it('평형 5는 그대로 통과한다(경계값)', () => {
    const input = toEngineInput({ ...SILK, pyeong: 5 }, NO_PRODUCTS);
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
    expect(input!.paper.paperType).toBe('합지');
    // 실크 제품 규격이 섞여 들어가면 안 된다
    expect(input!.paper.product).toBeUndefined();
  });
});

describe('describePreciseInput', () => {
  // 검사관 2라운드 지적 N2·N4: QuickAnswer(칩 잠금)·PreciseSection(배지)·result 요약줄이
  // 전부 이 함수 하나로 "정밀 폼이 지금 유효한가"를 판정해야 서로 어긋나지 않는다.
  // 아래 대부분은 view: 'precise'를 명시한다 — DEFAULT_CALC_FORM은 view: 'simple'이라
  // (검사관 2라운드 지적 1번 수리 후) 정밀 값이 있어도 view가 simple이면 무조건 null이기 때문.

  it('view가 precise고 유효한(가로·세로 다 채운) 방이 있으면 {kind:"room", count}를 돌려준다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      view: 'precise',
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
      view: 'precise',
      entry: 'room',
      preciseRooms: [{ w: 0, d: 0, openings: [] }],
    };
    expect(describePreciseInput(state)).toBeNull();
  });

  it('유효한 방과 빈 방이 섞여 있으면 유효한 방만 센다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      view: 'precise',
      entry: 'room',
      preciseRooms: [
        { w: 4, d: 3, openings: [] },
        { w: 0, d: 0, openings: [] }, // 아직 안 채운 카드
      ],
    };
    expect(describePreciseInput(state)).toEqual({ kind: 'room', count: 1 });
  });

  it('벽 길이가 유효하면 {kind:"length"}를 돌려준다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, view: 'precise', entry: 'length', wallLength: 12 };
    expect(describePreciseInput(state)).toEqual({ kind: 'length' });
  });

  it('정밀 폼을 안 썼으면(즉답 평형만) null이다', () => {
    expect(describePreciseInput(DEFAULT_CALC_FORM)).toBeNull();
  });

  it('검사관 2라운드 지적 1번: view가 simple이면 정밀 값이 남아 있어도 null이다', () => {
    // "간단하게"로 되돌아왔는데 예전에 채워 둔 실측 방 목록이 폼에 남아 있는 상황을 흉내낸다.
    // 요약줄·배지가 실제 계산(toEngineInput, simple이면 정밀 값 무시)과 어긋나면 안 된다.
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      view: 'simple',
      entry: 'room',
      preciseRooms: [{ w: 4, d: 3, openings: [] }],
    };
    expect(describePreciseInput(state)).toBeNull();
  });
});

describe('resolveView (view가 없는 옛 공유 링크 추정)', () => {
  it('view가 있으면 그대로 쓴다', () => {
    expect(resolveView({ ...DEFAULT_CALC_FORM, view: 'precise' })).toBe('precise');
    expect(resolveView({ ...DEFAULT_CALC_FORM, view: 'simple' })).toBe('simple');
  });

  it('검사관 2라운드 지적 2번: view가 없는 옛 링크는 정밀 입력이 유효하면 precise로 추정한다', () => {
    // view 필드 자체가 없던 시절(2026-09-09 재배치 이전)의 공유 링크를 흉내낸다.
    const { view: _unused, ...withoutView } = DEFAULT_CALC_FORM;
    const state: WallpaperFormState = {
      ...withoutView,
      entry: 'room',
      preciseRooms: [{ w: 4, d: 3, openings: [] }],
    };
    expect(resolveView(state)).toBe('precise');
    // describePreciseInput·toEngineInput도 같은 추정을 따라야 한다 — 평형 폴백 없이 실측으로 계산된다
    expect(describePreciseInput(state)).toEqual({ kind: 'room', count: 1 });
    const input = toEngineInput({ ...state, paperType: '실크' }, NO_PRODUCTS);
    expect(input!.base.mode).toBe('실측');
  });

  it('view가 없는 옛 링크인데 정밀 입력도 무효하면 simple로 추정해 평형을 본다', () => {
    const { view: _unused, ...withoutView } = DEFAULT_CALC_FORM;
    const state: WallpaperFormState = { ...withoutView, paperType: '실크' };
    expect(resolveView(state)).toBe('simple');
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.base.mode).toBe('평형');
  });
});
