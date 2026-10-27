// 관리자 화면 순수 함수 시험 — 합산·날짜 채우기·증감·이름 바꾸기
import { describe, it, expect } from 'vitest';
import { addDays, bucketLabel, dayRange, deltaText, fillDays, gaDay, gaRegionKo, groupSum, parseDays } from '../format';

describe('admin format', () => {
  it('parseDays: 허용 값만', () => {
    expect(parseDays('28')).toBe(28);
    expect(parseDays('5')).toBe(7);
    expect(parseDays(undefined, [7, 28])).toBe(7);
    expect(parseDays('90', [7, 28])).toBe(7);
  });
  it('groupSum: 같은 키 합산, 많은 순', () => {
    expect(groupSum([{ k: 'a', v: 1 }, { k: 'b', v: 5 }, { k: 'a', v: 6 }], (r) => r.k, (r) => r.v)).toEqual([
      { key: 'a', n: 7 }, { key: 'b', n: 5 },
    ]);
  });
  it('날짜 계산: 달 넘김·범위·빈 날 0 채움', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dayRange('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    expect(fillDays('2026-10-01', '2026-10-03', [{ key: '2026-10-02', n: 4 }])).toEqual([
      { day: '2026-10-01', n: 0 }, { day: '2026-10-02', n: 4 }, { day: '2026-10-03', n: 0 },
    ]);
  });
  it('deltaText', () => {
    expect(deltaText(15, 10)).toBe('+50%');
    expect(deltaText(5, 10)).toBe('-50%');
    expect(deltaText(3, 0)).toBe('새로');
    expect(deltaText(0, 0)).toBe('-');
  });
  it('이름 바꾸기', () => {
    expect(bucketLabel('30')).toBe('30평대');
    expect(bucketLabel('na')).toBe('미입력');
    expect(gaRegionKo('Seoul')).toBe('서울');
    expect(gaDay('20261028')).toBe('2026-10-28');
  });
});
