// ──────────────────────────────────────────────
// v1 허브 — 숫자 입력칸(NumberField)의 글자 해석 테스트
//
// 이 테스트가 지키는 것:
//   높이 2.3을 치면 23이 되던 사고를 막는다.
//   "3."처럼 아직 다 치지 않은 상태는 null(= 입력 중)이라 바깥 값을 건드리지 않아야 하고,
//   "3.6"은 3.6, "1,000"은 1000, 빈 칸은 ''(값 없음)이어야 한다.
//
// 작성일: 2026년 09월 09일
//
// 2026-09-30 결함 수리(미장 정확 구역 "0.05"를 치면 "5"가 되던 사고) — shouldResyncText
// 테스트 추가: 칸에 초점이 있는 동안(사용자가 치는 중)에는 부르는 쪽이 0을 ''로 접어
// 돌려줘도(예: `r.areaSqm || ''`) 절대 화면 글자를 되돌려 쓰면 안 된다. "0.", "0.0",
// ".5", "1." 같은 입력 도중 글자가 유지되는지 확인한다.
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { parseNumberInput, shouldResyncText } from '@/components/v1/NumberField';

describe('숫자 입력칸 글자 해석', () => {
  it('소수점을 막 찍은 "3."은 입력 중(null)이라 바깥 값을 바꾸지 않는다', () => {
    expect(parseNumberInput('3.')).toBeNull();
    // 소수점만 있거나 두 번 찍힌 것도 아직 숫자가 아니다
    expect(parseNumberInput('.')).toBeNull();
    expect(parseNumberInput('1.2.3')).toBeNull();
  });

  it('소수를 끝까지 치면 그 숫자가 된다', () => {
    expect(parseNumberInput('3.6')).toBe(3.6);
    expect(parseNumberInput('2.3')).toBe(2.3);
    expect(parseNumberInput('18')).toBe(18);
    // 앞자리 0을 생략하고 ".9"로 쳐도 0.9로 받는다
    expect(parseNumberInput('.9')).toBe(0.9);
  });

  it('쉼표는 자릿수 구분으로 보고, 빈 칸은 값 없음이다', () => {
    expect(parseNumberInput('1,000')).toBe(1000);
    expect(parseNumberInput('44,000')).toBe(44000);
    expect(parseNumberInput('')).toBe('');
  });
});

describe('바깥 값 동기화 판단(shouldResyncText) — 2026-09-30 결함 수리', () => {
  it('초점이 있으면(치는 중) 바깥 값이 어떻게 와도 절대 되돌려 쓰지 않는다', () => {
    // "0.05"를 치다가 "0"을 친 순간, 부르는 쪽이 0을 ''로 접어 돌려주는 상황을 흉내낸다
    expect(shouldResyncText(true, '0', '')).toBe(false);
    expect(shouldResyncText(true, '0.', '')).toBe(false);
    expect(shouldResyncText(true, '0.0', '')).toBe(false);
    // "0.5"를 치다가 첫 글자 "0"에서도 마찬가지
    expect(shouldResyncText(true, '0', '')).toBe(false);
    // 아예 값이 늘 같아도(참일 필요 없음) 초점 중엔 항상 false
    expect(shouldResyncText(true, '1.', 1)).toBe(false);
  });

  it('초점이 없으면(진짜 바깥 변경) 글자 뜻이 값과 다를 때만 되돌려 쓴다', () => {
    // 단위 토글·초기화처럼 이 칸 밖에서 값이 바뀐 경우
    expect(shouldResyncText(false, '3', 5)).toBe(true); // "3"은 5와 다른 뜻 → 되돌려 씀
    expect(shouldResyncText(false, '1,000', 1000)).toBe(false); // "1,000"은 1000과 같은 뜻 → 그대로 둠
    expect(shouldResyncText(false, '', '')).toBe(false); // 둘 다 빈 값 → 그대로 둠
    expect(shouldResyncText(false, '0', 0)).toBe(false); // 실제로 0을 친 상태에서 값도 0 → 그대로 둠
  });

  it('아직 소수점을 못 끝낸 글자("0.", "1.")는 초점 중엔 항상 유지 대상이다', () => {
    // parseNumberInput이 null을 주는(=아직 입력 중) 글자들 — 초점 중엔 무조건 false
    for (const mid of ['0.', '1.']) {
      expect(parseNumberInput(mid)).toBeNull();
      expect(shouldResyncText(true, mid, 0)).toBe(false);
      expect(shouldResyncText(true, mid, '')).toBe(false);
    }
  });

  it('".5"·"0.0"처럼 이미 유효한 숫자로 읽히는 중간 글자도 초점 중엔 그대로 둔다', () => {
    // "0.05"를 치는 도중 "0"을 지나 ".5"·"0.0"이 되는 순간에도(parseNumberInput이 값을
    // 돌려주더라도) 초점이 있으면 되돌려 쓰지 않아야 한다 — 안 그러면 바깥이 그 사이값을
    // ''로 접어 돌려줄 때(예: `r.areaSqm || ''`) 방금 친 "0"이 지워지는 사고가 재발한다.
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('0.0')).toBe(0);
    expect(shouldResyncText(true, '.5', '')).toBe(false);
    expect(shouldResyncText(true, '0.0', '')).toBe(false);
  });
});
