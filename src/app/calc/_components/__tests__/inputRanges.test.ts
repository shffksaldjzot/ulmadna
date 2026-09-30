// ──────────────────────────────────────────────
// inputRanges.ts 순수 함수 시험 — 2026-09-29 검사관 지적 2번(큰 값을 칸에서 막지 않음) 수리.
//
// 여기서 확인하는 것:
//   · isWithinRange: 빈 값·범위 안·범위 밖 판정
//   · rangeCaption: 범위 밖일 때만 짧은 안내 글을 돌려준다(마침표 없이)
//   · isRoomDimValid: 방 하나(가로·세로·높이)가 서버 범위 안인지
//   · moneyRangeCaption: 금액 칸(배송비 등)의 "1,000만원 이하" 식 안내(2026-09-29 다듬기 지적 2번)
//   · resolveSimpleAreaSqmRaw: 자르기 전(raw) ㎡ 환산값(2026-09-30 치명 2 수리)
//   · resolveMortarZonesForCalc: 구역 목록에서 "계산에 쓸 것"을 고르는 규칙(2026-09-30
//     가정 표시 통일 — 개별 범위 밖만 빼고 계산, 합계 초과는 범인을 못 골라 전부 가정값)
//   · pyeongRangeBounds: 미장 "평" 입력 안내에 쓸, 실제로 통과하는 평 경계값(2026-09-30
//     평 입력 안내 단위 통일)
//
// 작성일: 2026년 09월 29일
// moneyRangeCaption 시험 추가(다듬기 라운드): 2026년 09월 29일
// resolveSimpleAreaSqmRaw·mortarZonesValidity 시험 추가(긴급 수리 2·3): 2026년 09월 30일
// mortarZonesValidity → resolveMortarZonesForCalc로 교체, pyeongRangeBounds 추가(가정
// 표시 통일·평 안내 단위 통일): 2026년 09월 30일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  isWithinRange,
  rangeCaption,
  isRoomDimValid,
  mortarThicknessUxMin,
  moneyRangeCaption,
  resolveSimpleAreaSqmRaw,
  resolveMortarZonesForCalc,
  pyeongRangeBounds,
  MORTAR_AREA_SQM_MIN,
  MORTAR_AREA_SQM_MAX,
  MORTAR_ZONE_SQM_MIN,
  MORTAR_ZONE_SQM_MAX,
} from '../inputRanges';

describe('isWithinRange — 범위 판정', () => {
  it('빈 값(\'\')이나 undefined는 아직 판단할 게 없으니 true(방해 안 함)', () => {
    expect(isWithinRange('', 5, 200)).toBe(true);
    expect(isWithinRange(undefined, 5, 200)).toBe(true);
  });
  it('범위 안이면 true, 밖이면 false', () => {
    expect(isWithinRange(24, 5, 200)).toBe(true);
    expect(isWithinRange(5, 5, 200)).toBe(true); // 경계값 포함
    expect(isWithinRange(200, 5, 200)).toBe(true); // 경계값 포함
    expect(isWithinRange(4.9, 5, 200)).toBe(false);
    expect(isWithinRange(201, 5, 200)).toBe(false);
  });
});

describe('rangeCaption — 범위 밖일 때만 짧은 안내', () => {
  it('범위 안이면 안내 없음(undefined)', () => {
    expect(rangeCaption(24, 5, 200, '평')).toBeUndefined();
  });
  it('최솟값 미만이면 "N 이상"', () => {
    expect(rangeCaption(3, 5, 200, '평')).toBe('5평 이상');
  });
  it('최댓값 초과면 "N 이하" — [검사관 재현] 999평', () => {
    expect(rangeCaption(999, 5, 200, '평')).toBe('200평 이하');
  });
  it('빈 값·undefined는 안내 없음(아직 안 적은 칸)', () => {
    expect(rangeCaption('', 5, 200, '평')).toBeUndefined();
    expect(rangeCaption(undefined, 5, 200, '평')).toBeUndefined();
  });
  it('마침표를 붙이지 않는다(설명글 최소화 원칙)', () => {
    expect(rangeCaption(999, 5, 200, '평')).not.toMatch(/\.$/);
  });
});

describe('isRoomDimValid — 방 하나가 서버 범위 안인지', () => {
  it('정상 범위(0.3~30m)면 true', () => {
    expect(isRoomDimValid(3.6, 4.2)).toBe(true);
  });
  it('[검사관 관점 재현] 가로가 30m를 넘으면 false', () => {
    expect(isRoomDimValid(50, 4)).toBe(false);
  });
  it('아직 안 적은 값(0)은 범위 판단 대상이 아니므로 true', () => {
    expect(isRoomDimValid(0, 0)).toBe(true);
  });
  it('높이(h)를 줬을 때만 검사하고, 안 주면(공통 높이 사용) 방 자체는 통과', () => {
    expect(isRoomDimValid(3, 4, undefined)).toBe(true);
    expect(isRoomDimValid(3, 4, 10)).toBe(false); // 6m 넘음
    expect(isRoomDimValid(3, 4, 2.4)).toBe(true);
  });
});

describe('mortarThicknessUxMin — 미장 두께 화면 쪽 최솟값', () => {
  it('레미탈은 10mm(서버 최솟값 1보다 엄격)', () => {
    expect(mortarThicknessUxMin('레미탈', 1)).toBe(10);
  });
  it('셀프레벨링은 서버 최솟값을 그대로 쓴다', () => {
    expect(mortarThicknessUxMin('셀프레벨링', 1)).toBe(1);
  });
});

describe('moneyRangeCaption — 금액 칸(배송비 등) 범위 안내(2026-09-29 지적 2번)', () => {
  it('상한 이하면 안내 없음', () => {
    expect(moneyRangeCaption(5_000_000, 10_000_000)).toBeUndefined();
  });
  it('상한과 정확히 같으면 안내 없음(경계값 포함)', () => {
    expect(moneyRangeCaption(10_000_000, 10_000_000)).toBeUndefined();
  });
  it('[검사관 관점 재현] 상한을 넘으면 "만원" 단위로 콤마 찍어 안내한다', () => {
    expect(moneyRangeCaption(99_000_000, 10_000_000)).toBe('1,000만원 이하');
  });
  it('빈 값(undefined)은 안내 없음(아직 안 넣은 칸)', () => {
    expect(moneyRangeCaption(undefined, 10_000_000)).toBeUndefined();
  });
});

describe('resolveSimpleAreaSqmRaw — 자르기 전(raw) ㎡ 환산값(2026-09-30 치명 2 수리)', () => {
  // 실제 lib 함수(pyeongToExclusiveSqm)와 정확히 같을 필요는 없다 — 이 함수는 "환산한 뒤
  // 자르지 않는다"는 분기 로직 자체를 시험하는 것이라, 간단한 배수로 주입해도 충분하다.
  const toExclusive = (p: number) => p * 3.3; // 평→전용㎡ 흉내
  const sqmPerPyeong = 3.3058;

  it('[검사관 재현] 152평(공급 환산) → 500㎡를 넘는 raw 값을 그대로 돌려준다(안 잘림)', () => {
    const raw = resolveSimpleAreaSqmRaw({ area: 152, areaUnit: '평' }, true, toExclusive, sqmPerPyeong);
    expect(raw).toBeCloseTo(152 * 3.3, 5);
    expect(raw).toBeGreaterThan(MORTAR_AREA_SQM_MAX);
  });

  it('99999평처럼 극단적으로 큰 값도 자르지 않고 그대로 환산한다', () => {
    const raw = resolveSimpleAreaSqmRaw({ area: 99999, areaUnit: '평' }, true, toExclusive, sqmPerPyeong);
    expect(raw).toBeCloseTo(99999 * 3.3, 1);
  });

  it('㎡ 단위 직접 입력은 환산 없이 그대로(자르지 않고)', () => {
    expect(resolveSimpleAreaSqmRaw({ area: 501, areaUnit: '㎡' }, true, toExclusive, sqmPerPyeong)).toBe(501);
  });

  it('작업 면적(셀프레벨링, 공급 환산 아님)은 평×3.3058로 환산한다', () => {
    const raw = resolveSimpleAreaSqmRaw({ area: 150, areaUnit: '평' }, false, toExclusive, sqmPerPyeong);
    expect(raw).toBeCloseTo(150 * 3.3058, 5);
  });

  it('가로×세로(rect) 모드는 곱한 값을 그대로 돌려준다(5×101=505, 500 초과여도 안 잘림)', () => {
    const raw = resolveSimpleAreaSqmRaw({ areaInputMode: 'rect', rectWidth: 5, rectDepth: 101 }, true, toExclusive, sqmPerPyeong);
    expect(raw).toBe(505);
  });

  it('경계값 — 정확히 최댓값(500㎡)이면 그대로 500', () => {
    const raw = resolveSimpleAreaSqmRaw({ areaInputMode: 'rect', rectWidth: 100, rectDepth: 5 }, true, toExclusive, sqmPerPyeong);
    expect(raw).toBe(MORTAR_AREA_SQM_MAX);
  });

  it('값이 아직 없으면(0 이하·undefined) null', () => {
    expect(resolveSimpleAreaSqmRaw({}, true, toExclusive, sqmPerPyeong)).toBeNull();
    expect(resolveSimpleAreaSqmRaw({ area: 0, areaUnit: '평' }, true, toExclusive, sqmPerPyeong)).toBeNull();
    expect(resolveSimpleAreaSqmRaw({ areaInputMode: 'rect', rectWidth: 5 }, true, toExclusive, sqmPerPyeong)).toBeNull();
  });
});

describe('resolveMortarZonesForCalc — 구역 목록에서 계산에 쓸 것 고르기(2026-09-30 가정 표시 통일)', () => {
  it('채운 구역이 없으면 손 안 댐(fullyValid=true, measuring=false)', () => {
    const r = resolveMortarZonesForCalc([{ areaSqm: 0 }, {}]);
    expect(r).toEqual({ hasFilled: false, fullyValid: true, zonesForCalc: [], measuring: false, sumExceeded: false });
  });

  it('전부 정상 범위면 그대로 전부 계산에 쓴다(measuring=false)', () => {
    const r = resolveMortarZonesForCalc([{ areaSqm: 20 }, { areaSqm: 30 }]);
    expect(r.hasFilled).toBe(true);
    expect(r.fullyValid).toBe(true);
    expect(r.measuring).toBe(false);
    expect(r.zonesForCalc).toEqual([{ areaSqm: 20 }, { areaSqm: 30 }]);
  });

  it('[검사관 재현 — 구역 하나만 범위 밖] 구역1 300㎡ + 구역2 600㎡ → 600만 빼고 300으로 계산(합계 300은 범위 안)', () => {
    const r = resolveMortarZonesForCalc([{ areaSqm: 300 }, { areaSqm: 600 }]);
    expect(r.fullyValid).toBe(false);
    expect(r.measuring).toBe(true);
    expect(r.sumExceeded).toBe(false);
    expect(r.zonesForCalc).toEqual([{ areaSqm: 300 }]);
  });

  it('[재현 — 합계 초과, 범인 없음] 300㎡ + 300㎡ = 600㎡(개별은 전부 정상) → 전부 빼고 가정값', () => {
    const r = resolveMortarZonesForCalc([{ areaSqm: 300 }, { areaSqm: 300 }]);
    expect(r.fullyValid).toBe(false);
    expect(r.measuring).toBe(true);
    expect(r.sumExceeded).toBe(true);
    expect(r.zonesForCalc).toEqual([]);
  });

  it('경계값 — 합계가 정확히 500㎡면 그대로 통과(전부 계산에 씀)', () => {
    const r = resolveMortarZonesForCalc([{ areaSqm: 250 }, { areaSqm: 250 }]);
    expect(r.fullyValid).toBe(true);
    expect(r.sumExceeded).toBe(false);
    expect(r.zonesForCalc).toEqual([{ areaSqm: 250 }, { areaSqm: 250 }]);
  });

  it('구역 하나가 개별 최솟값(0.1㎡) 미만이면 그 구역만 빼고 계산(남는 게 없으면 전부 가정값)', () => {
    const r = resolveMortarZonesForCalc([{ areaSqm: 0.05 }]);
    expect(r.fullyValid).toBe(false);
    expect(r.measuring).toBe(true);
    expect(r.sumExceeded).toBe(false); // 살아남은 구역이 0개라 "합계 초과"가 아니다
    expect(r.zonesForCalc).toEqual([]);
  });

  it('MORTAR_ZONE_SQM_MIN·MAX 경계값 자체는 그대로 통과한다(경계 포함)', () => {
    const r = resolveMortarZonesForCalc([{ areaSqm: MORTAR_ZONE_SQM_MIN }, { areaSqm: MORTAR_ZONE_SQM_MAX - MORTAR_ZONE_SQM_MIN }]);
    expect(r.fullyValid).toBe(true);
  });
});

describe('pyeongRangeBounds — 미장 평 입력 안내의 실제 통과 경계값(2026-09-30 평 안내 단위 통일)', () => {
  it('선형 환산(1평=3.3058㎡)에서 0.5~500㎡ 경계를 평으로 뒤집는다', () => {
    const toSqm = (p: number) => p * 3.3058;
    const { minPyeong, maxPyeong } = pyeongRangeBounds(0.5, 500, toSqm);
    expect(toSqm(maxPyeong)).toBeLessThanOrEqual(500);
    expect(toSqm(maxPyeong + 1)).toBeGreaterThan(500);
    expect(toSqm(minPyeong)).toBeGreaterThanOrEqual(0.5);
  });

  it('비선형(공급→전용, 3.3058×0.75 근사) 환산에서도 안내한 값이 실제로 통과한다', () => {
    const toSqm = (p: number) => Math.round(p * 3.3058 * 0.75 * 10) / 10;
    const { minPyeong, maxPyeong } = pyeongRangeBounds(0.5, 500, toSqm);
    expect(toSqm(maxPyeong)).toBeLessThanOrEqual(500);
    expect(toSqm(minPyeong)).toBeGreaterThanOrEqual(0.5);
  });

  it('최솟값은 1평 밑으로 내려가지 않는다', () => {
    const toSqm = (p: number) => p * 3.3058;
    const { minPyeong } = pyeongRangeBounds(0.5, 500, toSqm);
    expect(minPyeong).toBeGreaterThanOrEqual(1);
  });
});
