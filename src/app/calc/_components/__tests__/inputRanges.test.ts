// ──────────────────────────────────────────────
// inputRanges.ts 순수 함수 시험 — 2026-09-29 검사관 지적 2번(큰 값을 칸에서 막지 않음) 수리.
//
// 여기서 확인하는 것:
//   · isWithinRange: 빈 값·범위 안·범위 밖 판정
//   · rangeCaption: 범위 밖일 때만 짧은 안내 글을 돌려준다(마침표 없이)
//   · isRoomDimValid: 방 하나(가로·세로·높이)가 서버 범위 안인지
//
// 작성일: 2026년 09월 29일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { isWithinRange, rangeCaption, isRoomDimValid, mortarThicknessUxMin } from '../inputRanges';

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
