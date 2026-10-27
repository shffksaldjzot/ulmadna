// 관리자 숫자판 순수 함수 시험 — 한국 날짜 계산, 인기 글 상위 N 합산
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ask/server', () => ({ adminOrNull: () => null }));
import { kstDay, topN, getTrafficDash } from '../adminDash';

describe('adminDash', () => {
  it('한국 날짜: UTC 15시 이후는 다음 날', () => {
    expect(kstDay(new Date('2026-10-27T15:30:00Z'))).toBe('2026-10-28');
    expect(kstDay(new Date('2026-10-27T14:30:00Z'), 6)).toBe('2026-10-21');
  });
  it('topN: 같은 글 합산 후 내림차순·개수 제한', () => {
    const r = topN([{ key: 'a', n: 1 }, { key: 'b', n: 5 }, { key: 'a', n: 6 }, { key: 'c', n: 2 }], 2);
    expect(r).toEqual([{ key: 'a', n: 7 }, { key: 'b', n: 5 }]);
  });
  it('열쇠 없으면 null (예외 없음)', async () => {
    expect(await getTrafficDash(new Date(), null)).toBeNull();
  });
});
