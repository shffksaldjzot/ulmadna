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
import {
  toEngineInput,
  describePreciseInput,
  describeAreaPair,
  resolveView,
  ASSUMED_PYEONG,
  productOptionToRequest,
  nonDimensionKey,
  canHoldWhileMeasuring,
} from '../wallpaperEngineInput';
import {
  DEFAULT_CALC_FORM,
  encodeWallpaperForm,
  decodeWallpaperForm,
  type WallpaperFormState,
  type WallpaperProductOption,
} from '../wallpaperQuery';

// 제품 마스터 목록이 필요한 자리엔 빈 배열을 넣는다(이 테스트들은 productCode를 쓰지 않는다)
const NO_PRODUCTS: WallpaperProductOption[] = [];

describe('toEngineInput', () => {
  // DEFAULT_CALC_FORM은 paperType이 없는 상태다(2026-09-09 화면 재배치 — 벽지 최우선 A안).
  // 아래 대부분의 테스트는 계산이 실제로 되는 경로를 보고 싶은 것이므로 paperType을 따로 얹는다.
  // 2026-09-09 형아 지시: 간단 모드는 벽지 제품까지 골라야 계산하므로 직접 입력 제품을 얹어 둔다
  const SILK: WallpaperFormState = {
    ...DEFAULT_CALC_FORM,
    paperType: '실크',
    product: { rollPrice: 40000, widthCm: 106, lengthM: 15.6 },
  };

  it('간단 모드에서 벽지 종류만 고르면 제품 없이 계산하고 "제품" 가정을 표시한다 — 2026-09-27 좁혀가기', () => {
    // 2026-09-09에는 여기서 null(계산 안 함)이었다. 좁혀가기 결정으로 바뀌었다:
    // 제품 칸을 비워 보내면 서버가 그 종류의 노출 제품 전체 범위로 계산한다.
    const noProduct: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크' };
    const input = toEngineInput(noProduct, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.paper.paperType).toBe('실크');
    expect(input!.paper.product).toBeUndefined();
    expect(input!.assumed).toContain('product');
  });

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

  it('견적은 항상 구축 기준(isOld true)이고, 기존 벽지 제거는 removeOld 토글로만 바뀐다 (2026-09-09 형아 결정)', () => {
    // 옛 링크에 isOld:false가 남아 있어도 무시하고 구축 기준으로 보낸다
    const legacy = toEngineInput({ ...SILK, isOld: false }, NO_PRODUCTS);
    expect(legacy!.base.isOld).toBe(true);
    // 기본값: 철거 포함
    const defaultInput = toEngineInput(SILK, NO_PRODUCTS);
    expect(defaultInput!.base.removeOld).toBe(true);
    // 토글을 끄면 철거만 빠진다(구축 기준은 그대로)
    const noRemoval = toEngineInput({ ...SILK, removeOld: false }, NO_PRODUCTS);
    expect(noRemoval!.base.isOld).toBe(true);
    expect(noRemoval!.base.removeOld).toBe(false);
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

  it('precise 모드에서 방이 전부 빈 값이면 34평 가정으로 계산하고 "면적"·"실측 입력 중"을 표시한다 — 2026-09-27', () => {
    // 2026-09-09에는 null이었다. 좁혀가기(지시서 5-4)로 바뀌었다: 실측이 비었으면 34평으로 가정한다.
    // 이때 사용자가 폼에 넣어 둔 간단 모드 평형(예: 24평)이 아니라 가정값 34평을 써야 가정 줄과 계산이 맞는다.
    const state: WallpaperFormState = {
      ...SILK,
      pyeong: 24,
      view: 'precise',
      entry: 'room',
      preciseRooms: [{ w: 0, d: 0, openings: [] }], // 아직 아무 것도 안 채운 빈 방 카드 1장
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.mode).toBe('평형');
    expect(input!.base.pyeong).toBe(ASSUMED_PYEONG);
    expect(input!.base.bay).toBe(3);
    expect(input!.assumed).toContain('area');
    expect(input!.assumed).toContain('measuring');
    // 정확 모드엔 베이 조정 칩이 없으니 'bay'는 가정 목록에 안 넣는다
    expect(input!.assumed).not.toContain('bay');
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

  it('평형이 1~4처럼 5 미만이면 서버로 보내지 않고 34평 가정으로 계산한다 — 2026-09-27', () => {
    // 검사관 지적: 서버가 5평 미만을 거부하는데 그대로 보내면 매번 실패만 뜬다.
    // 2026-09-09에는 null이었지만, 좁혀가기에서는 종류를 고른 뒤 결과가 사라지면 안 되므로 34평 가정으로 바꿨다.
    const input = toEngineInput({ ...SILK, pyeong: 4 }, NO_PRODUCTS);
    expect(input!.base.pyeong).toBe(ASSUMED_PYEONG);
    expect(input!.assumed).toContain('area');
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
    // productCode는 실크 제품인데 paperType은 합지로 바뀐 상태(정상 배선이면 안 생기는 조합).
    // 간단 모드는 제품이 없으면 계산 자체를 안 하므로(2026-09-09 규칙) 정밀 모드로 확인한다.
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      paperType: '합지',
      productCode: 'silk_a',
      view: 'precise',
      entry: 'room',
      preciseRooms: [{ w: 4, d: 3, openings: [] }],
    };
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
    // 간단 모드는 제품이 있어야 계산하므로(2026-09-09 규칙) 직접 입력 제품을 얹는다
    const state: WallpaperFormState = {
      ...withoutView,
      paperType: '실크',
      product: { rollPrice: 40000, widthCm: 106, lengthM: 15.6 },
    };
    expect(resolveView(state)).toBe('simple');
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.base.mode).toBe('평형');
  });
});

// 2026-09-15 형아 지시: 칩=[18,24,25,30,34,40,45]평은 "공급 평형"이고, 화면에 전용/공급 표기·
// ㎡ 토글이 없었다. areaUnit === '㎡'면 직접 입력한 값을 전용면적으로 그대로(0.75 환산 없이)
// 엔진에 넘겨야 한다.
describe('㎡ 모드 (전용면적 직접 입력)', () => {
  // 이 describe 블록 바깥이라 위 toEngineInput 블록의 SILK 상수를 못 쓴다 — 같은 모양으로 새로 둔다
  const SILK: WallpaperFormState = {
    ...DEFAULT_CALC_FORM,
    paperType: '실크',
    product: { rollPrice: 40000, widthCm: 106, lengthM: 15.6 },
  };

  it('areaUnit이 ㎡면 exclusiveSqm을 그대로 보내고 pyeong 환산을 거치지 않는다', () => {
    const state: WallpaperFormState = {
      ...SILK,
      areaUnit: '㎡',
      exclusiveSqm: 84,
      pyeong: undefined,
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.mode).toBe('평형');
    expect(input!.base.exclusiveSqm).toBe(84);
    expect(input!.base.pyeong).toBeUndefined();
  });

  it('㎡ 모드에서 전용면적이 최소값(20) 미만이면 34평 가정으로 계산한다 — 2026-09-27(예전엔 null)', () => {
    const state: WallpaperFormState = { ...SILK, areaUnit: '㎡', exclusiveSqm: 10 };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.base.pyeong).toBe(ASSUMED_PYEONG);
    expect(input!.base.exclusiveSqm).toBeUndefined();
    expect(input!.assumed).toContain('area');
  });

  it('㎡ 모드인데 exclusiveSqm이 없으면 폼의 평형 값이 아니라 34평 가정으로 계산한다 — 2026-09-27(예전엔 null)', () => {
    // 폼에 남아 있는 pyeong(24)으로 조용히 넘어가지 않는다 — 가정값 34평이어야 "34평 가정" 표시와 맞는다
    const state: WallpaperFormState = { ...SILK, areaUnit: '㎡', exclusiveSqm: undefined, pyeong: 24 };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.base.pyeong).toBe(ASSUMED_PYEONG);
    expect(input!.assumed).toContain('area');
  });

  it('기존 공유 링크(areaUnit 필드 없음)는 평 모드로 그대로 해석된다', () => {
    // areaUnit이 없는 옛 상태 — DEFAULT_CALC_FORM에서 일부러 지워서 옛 링크를 흉내낸다
    const { areaUnit: _unused, ...withoutAreaUnit } = SILK;
    const input = toEngineInput(withoutAreaUnit as WallpaperFormState, NO_PRODUCTS);
    expect(input!.base.pyeong).toBe(34);
    expect(input!.base.exclusiveSqm).toBeUndefined();
  });
});

describe('describeAreaPair — 결과 요약줄 "34평 · 84㎡" 병기 (2026-09-16: "공급"·"전용" 단어 삭제)', () => {
  it('평 모드는 칩 평형표로 전용 ㎡를 병기한다', () => {
    expect(describeAreaPair({ ...DEFAULT_CALC_FORM, pyeong: 34 })).toBe('34평 · 84㎡');
  });

  it('㎡ 모드는 입력한 전용면적을 그대로 쓰고 공급 평형은 역산해서 보여준다', () => {
    // 84㎡는 34평 칩의 표값(PYEONG_TO_EXCLUSIVE_SQM)이라 역산하면 반올림 차이로 33.9평이 된다
    // (34×3.3058×0.75=84.30을 표는 정수 84로 저장 — "약"이라고 적는 이유가 이거다)
    const label = describeAreaPair({ ...DEFAULT_CALC_FORM, areaUnit: '㎡', exclusiveSqm: 84 });
    expect(label).toContain('84㎡');
    expect(label).toContain('약 33.9평');
  });

  it('평형·전용면적이 둘 다 없으면 null이다', () => {
    expect(describeAreaPair({ ...DEFAULT_CALC_FORM, pyeong: undefined })).toBeNull();
  });
});

// ──────────────────────────────────────────────
// 2026-09-27 좁혀가기(형아 결정) — 가정값과 가정 목록(assumed)
// 첫 단계(벽지 종류)만 골라도 계산이 되고, 안 고른 값은 가정값으로 채운 뒤 무엇을 가정했는지 알려 준다.
// ──────────────────────────────────────────────
describe('좁혀가기 — 가정값·가정 목록', () => {
  it('종류를 안 골랐으면 가정값이 있어도 계산하지 않는다(null = 훅이 서버를 부르지 않는다)', () => {
    // 건드림 표시를 전부 켜서 넘겨도 종류가 없으면 null이어야 한다
    expect(toEngineInput(DEFAULT_CALC_FORM, NO_PRODUCTS, { touched: { area: true, bay: true, scope: true } })).toBeNull();
  });

  it('종류만 있고 면적이 비었으면 34평으로 가정하고 assumed에 area·product가 들어간다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '합지', pyeong: undefined };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input).not.toBeNull();
    expect(input!.base.mode).toBe('평형');
    expect(input!.base.pyeong).toBe(34);
    expect(input!.assumed).toEqual(['area', 'product']);
  });

  it('화면이 touched를 넘기면 폼에 기본값(34평·3베이·벽+천장)이 있어도 안 건드린 것은 전부 가정이다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크' };
    const input = toEngineInput(state, NO_PRODUCTS, { touched: {} });
    // 순서는 늘 area → product → bay → scope 로 고정
    expect(input!.assumed).toEqual(['area', 'product', 'bay', 'scope']);
  });

  it('touched.area가 false면 폼의 평형(24평)이 아니라 가정값 34평으로 계산한다(가정 줄과 계산이 어긋나지 않게)', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크', pyeong: 24 };
    const input = toEngineInput(state, NO_PRODUCTS, { touched: { area: false } });
    expect(input!.base.pyeong).toBe(ASSUMED_PYEONG);
    expect(input!.assumed).toContain('area');
  });

  it('면적을 고르면 area 가정이 빠지고 그 평형으로 계산한다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크', pyeong: 24 };
    const input = toEngineInput(state, NO_PRODUCTS, { touched: { area: true } });
    expect(input!.base.pyeong).toBe(24);
    expect(input!.assumed).not.toContain('area');
  });

  it('베이·범위 칩을 건드리면 bay·scope 가정이 빠지고, 고른 베이가 요청에 실린다', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크', bay: 2, target: 'wall' };
    const input = toEngineInput(state, NO_PRODUCTS, { touched: { area: true, bay: true, scope: true } });
    expect(input!.base.bay).toBe(2);
    expect(input!.base.wall).toBe(true);
    expect(input!.base.ceiling).toBe(false);
    expect(input!.assumed).toEqual(['product']);
  });

  it('면적 가정 중에도 사용자가 바꾼 베이는 그대로 쓴다(34평 · 2베이)', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크', bay: 2 };
    const input = toEngineInput(state, NO_PRODUCTS, { touched: { area: false, bay: true } });
    expect(input!.base.pyeong).toBe(34);
    expect(input!.base.bay).toBe(2);
    expect(input!.assumed).not.toContain('bay');
  });

  it('touched를 안 넘기면(옛 화면·공유 결과 화면) 값이 들어 있는 것은 사용자가 고른 것으로 본다 — 예전 동작 그대로', () => {
    const SILK_FULL: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      paperType: '실크',
      product: { rollPrice: 40000, widthCm: 106, lengthM: 15.6 },
    };
    const input = toEngineInput(SILK_FULL, NO_PRODUCTS);
    expect(input!.assumed).toEqual([]);
    expect(input!.base.pyeong).toBe(34);
  });

  it('목록에서 제품을 고르면 product 가정이 빠지고, 규격·가격이 빈 제품은 가정(종류 전체 범위)으로 남는다', () => {
    const products: WallpaperProductOption[] = [
      { code: 'ok', brand: 'A', name: '가', kind: '실크', widthCm: 106, lengthM: 15.6, repeatCm: null, price: 45000, sourceLabel: '' },
      { code: 'half', brand: 'B', name: '나', kind: '실크', widthCm: null, lengthM: 15.6, repeatCm: null, price: 45000, sourceLabel: '' },
    ];
    const picked = toEngineInput({ ...DEFAULT_CALC_FORM, paperType: '실크', productCode: 'ok' }, products);
    expect(picked!.paper.product?.rollPrice).toBe(45000);
    expect(picked!.assumed).not.toContain('product');
    const half = toEngineInput({ ...DEFAULT_CALC_FORM, paperType: '실크', productCode: 'half' }, products);
    expect(half!.paper.product).toBeUndefined();
    expect(half!.assumed).toContain('product');
  });

  it('productOptionToRequest는 규격이 하나라도 비면 null, 다 있으면 서버 요청 모양을 만든다', () => {
    const full: WallpaperProductOption = { code: 'x', brand: 'A', name: '가', kind: '합지', widthCm: 93, lengthM: 17.75, repeatCm: null, price: 25400, sourceLabel: '' };
    expect(productOptionToRequest(full)).toEqual({ rollPrice: 25400, widthCm: 93, lengthM: 17.75, repeatCm: undefined, sourceLabel: 'A 가' });
    expect(productOptionToRequest({ ...full, price: null })).toBeNull();
  });

  it('정확 모드: 유효한 방 + 덜 찬 방 카드가 섞이면 유효한 방으로 요청을 만들고 measuring을 표시한다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      paperType: '실크',
      view: 'precise',
      entry: 'room',
      preciseRooms: [
        { w: 4, d: 3, openings: [] },
        { w: 3, d: 0, openings: [] }, // 세로를 아직 안 넣은 카드
      ],
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.base.mode).toBe('실측');
    expect(input!.base.rooms).toHaveLength(1);
    expect(input!.assumed).toContain('measuring');
    expect(input!.assumed).not.toContain('area');
  });

  it('정확 모드: 방이 다 차 있으면 measuring·area 가정이 없다', () => {
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      paperType: '실크',
      view: 'precise',
      entry: 'room',
      preciseRooms: [{ w: 4, d: 3, openings: [] }],
    };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.assumed).not.toContain('measuring');
    expect(input!.assumed).not.toContain('area');
  });

  it('정확 모드 벽 길이 입력이 비었으면 34평 가정이다(measuring은 방 카드에만 쓴다)', () => {
    const state: WallpaperFormState = { ...DEFAULT_CALC_FORM, paperType: '실크', view: 'precise', entry: 'length' };
    const input = toEngineInput(state, NO_PRODUCTS);
    expect(input!.base.pyeong).toBe(34);
    expect(input!.assumed).toContain('area');
    expect(input!.assumed).not.toContain('measuring');
  });

  it('공유 링크(?d=) 형식은 그대로다 — 옛 링크를 풀어도 같은 요청이 나온다', () => {
    // 가정 정보는 공유 형식에 넣지 않는다. 인코딩→디코딩을 거쳐도 요청이 똑같아야 한다.
    const state: WallpaperFormState = {
      ...DEFAULT_CALC_FORM,
      paperType: '실크',
      pyeong: 24,
      product: { rollPrice: 40000, widthCm: 106, lengthM: 15.6 },
    };
    const restored = decodeWallpaperForm(encodeWallpaperForm(state))!;
    expect(restored).toEqual(state);
    expect(toEngineInput(restored, NO_PRODUCTS)).toEqual(toEngineInput(state, NO_PRODUCTS));
  });
});

// ──────────────────────────────────────────────
// 2026-09-27 검사관 결함 수리 — 실측 입력 중 "직전 결과 유지"는 치수만 바뀌는 동안에만
// 재현: 정확 → 합지 → 제품 미정 → 빈 방 추가 → 천장 끔 → 실크로 바꿈. 예전엔 금액이 합지·천장 포함 그대로였다.
// 훅은 canHoldWhileMeasuring이 false면 새 요청을 만든다(true면 요청 없이 직전 결과 유지).
// ──────────────────────────────────────────────
describe('실측 입력 중 직전 결과 유지 범위', () => {
  /** 직전 결과를 계산할 때의 상태: 합지·제품 미정·정확 모드·유효한 방 1개 + 빈 방 카드 1개 */
  const SHOWN: WallpaperFormState = {
    ...DEFAULT_CALC_FORM,
    paperType: '합지',
    view: 'precise',
    entry: 'room',
    target: 'both',
    preciseRooms: [
      { w: 4, d: 3, openings: [] },
      { w: 0, d: 0, openings: [] }, // 방 추가만 하고 치수를 비운 카드
    ],
  };
  const shownKey = nonDimensionKey(toEngineInput(SHOWN, NO_PRODUCTS)!);

  it('치수만 바뀌고 여전히 덜 찬 상태면 새 요청 없이 직전 결과를 유지한다', () => {
    const next: WallpaperFormState = {
      ...SHOWN,
      preciseRooms: [
        { w: 4.5, d: 3, openings: [] }, // 유효한 방의 치수만 바뀜
        { w: 2, d: 0, openings: [] }, // 빈 카드는 가로만 넣어 아직 덜 참
      ],
    };
    const input = toEngineInput(next, NO_PRODUCTS)!;
    expect(input.assumed).toContain('measuring');
    expect(canHoldWhileMeasuring(input, shownKey)).toBe(true);
  });

  it('실측 입력 중에 벽지 종류를 바꾸면 새 요청을 만든다(유효한 방만으로 다시 계산)', () => {
    const input = toEngineInput({ ...SHOWN, paperType: '실크' }, NO_PRODUCTS)!;
    expect(input.assumed).toContain('measuring');
    expect(canHoldWhileMeasuring(input, shownKey)).toBe(false);
    // 새 요청은 덜 찬 방을 뺀 유효한 방 1개로 만들어진다
    expect(input.base.mode).toBe('실측');
    expect(input.base.rooms).toHaveLength(1);
    expect(input.paper.paperType).toBe('실크');
  });

  it('실측 입력 중에 범위(천장 끔)를 바꾸면 새 요청을 만든다', () => {
    const input = toEngineInput({ ...SHOWN, target: 'wall' }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(input, shownKey)).toBe(false);
    expect(input.base.ceiling).toBe(false);
  });

  it('실측 입력 중에 철거 여부를 바꿔도 새 요청을 만든다', () => {
    const input = toEngineInput({ ...SHOWN, removeOld: false }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(input, shownKey)).toBe(false);
  });

  it('유효한 방이 하나도 없으면 34평 가정으로 새 요청을 만들고, 그 뒤 치수만 바뀌는 동안은 유지한다', () => {
    const empty: WallpaperFormState = { ...SHOWN, paperType: '실크', preciseRooms: [{ w: 0, d: 0, openings: [] }] };
    const first = toEngineInput(empty, NO_PRODUCTS)!;
    // 보이는 결과(합지)와 종류가 달라 다시 계산 — 요청은 34평 가정
    expect(canHoldWhileMeasuring(first, shownKey)).toBe(false);
    expect(first.base.pyeong).toBe(ASSUMED_PYEONG);
    // 그 결과가 화면에 올라간 뒤, 빈 카드에 가로만 넣는 동안은 유지
    const typing = toEngineInput({ ...empty, preciseRooms: [{ w: 3, d: 0, openings: [] }] }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(typing, nonDimensionKey(first))).toBe(true);
  });

  it('보이는 결과가 없거나 실측 입력 중이 아니면 유지하지 않는다', () => {
    const input = toEngineInput(SHOWN, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(input, null)).toBe(false);
    const done = toEngineInput({ ...SHOWN, preciseRooms: [{ w: 4, d: 3, openings: [] }] }, NO_PRODUCTS)!;
    expect(canHoldWhileMeasuring(done, shownKey)).toBe(false);
  });
});