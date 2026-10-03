// ──────────────────────────────────────────────
// 물어보기 게시판 — 글자·시간 함수 테스트
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  titleToSlugPart,
  makeSlug,
  idFromSlug,
  timeAgo,
  kstDayStartIso,
  nicknameProblem,
  hasPhoneNumber,
  conditionText,
  fmtDateTime,
} from '../format';

describe('주소 만들기', () => {
  it('한글은 살리고 문장부호는 하이픈으로', () => {
    expect(titleToSlugPart('34평 도배+강마루 견적 580만원, 적정한가요?')).toBe('34평-도배-강마루-견적-580만원-적정한가요');
  });
  it('비어 있으면 "질문"', () => {
    expect(titleToSlugPart('?!')).toBe('질문');
  });
  it('번호를 앞에 붙이고 다시 뽑을 수 있다', () => {
    const s = makeSlug(1024, '욕실 덧방 얼마?');
    expect(s).toBe('1024-욕실-덧방-얼마');
    expect(idFromSlug(s)).toBe(1024);
  });
  it('번호가 없으면 null', () => {
    expect(idFromSlug('abc-1')).toBeNull();
    expect(idFromSlug('0-x')).toBeNull();
  });
});

describe('시간 표기', () => {
  const now = new Date('2026-10-03T05:00:00Z'); // 한국 14:00
  it('분·시간·어제', () => {
    expect(timeAgo('2026-10-03T04:59:40Z', now)).toBe('방금');
    expect(timeAgo('2026-10-03T04:48:00Z', now)).toBe('12분 전');
    expect(timeAgo('2026-10-03T02:00:00Z', now)).toBe('3시간 전');
    expect(timeAgo('2026-10-02T03:00:00Z', now)).toBe('어제');
    expect(timeAgo('2026-09-20T03:00:00Z', now)).toBe('09.20');
  });
  it('한국 날짜 0시', () => {
    expect(kstDayStartIso(now)).toBe('2026-10-02T15:00:00.000Z');
  });
  it('날짜·시각 한국 시간', () => {
    expect(fmtDateTime('2026-10-03T05:12:00Z')).toBe('2026.10.03 14:12');
  });
});

describe('검사', () => {
  it('닉네임', () => {
    expect(nicknameProblem('수원새댁')).toBeNull();
    expect(nicknameProblem('a')).not.toBeNull();
    expect(nicknameProblem('이름 띄움')).not.toBeNull();
    expect(nicknameProblem('얼마드나AI')).not.toBeNull();
  });
  it('전화번호', () => {
    expect(hasPhoneNumber('연락 010-1234-5678 주세요')).toBe(true);
    expect(hasPhoneNumber('580만원 34평')).toBe(false);
  });
  it('조건 한 줄', () => {
    expect(conditionText(34, ['도배', '미장 · 방수'])).toBe('34평 도배·미장·방수');
  });
});
