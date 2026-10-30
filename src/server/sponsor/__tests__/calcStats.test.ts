// 광고주 모집 화면 숫자 함수 시험 — 지역 합계·7일 읽기·0이면 전국
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (f: unknown) => f }));
vi.mock('@/lib/ask/server', () => ({ adminOrNull: () => null }));
import { sumByRegion, pickWeek, topRegions, loadWeekMap } from '../calcStats';

const map = sumByRegion([
  { region: '11', runs: 5 }, { region: '11', runs: 7 }, { region: '41', runs: 4 },
  { region: '51', runs: 3 }, { region: 'unknown', runs: 2 },
]);

describe('calcStats', () => {
  it('지역별로 합산', () => {
    expect(map['11']).toBe(12);
    expect(map['41']).toBe(4);
  });
  it('지역 숫자·전국·그 외', () => {
    expect(pickWeek(map, '11')).toEqual({ label: '서울', n: 12 });
    expect(pickWeek(map, 'all')).toEqual({ label: '전국', n: 21 });
    expect(pickWeek(map, 'other')).toEqual({ label: '그 외 지역', n: 3 });
  });
  it('0이면 전국 숫자로 대체', () => {
    expect(pickWeek(map, '26')).toEqual({ label: '전국', n: 21 });
    expect(pickWeek({}, '11').n).toBe(0);
  });
  it('많은 순 표(0인 곳 제외)', () => {
    expect(topRegions(map, 2).map((r) => r.name)).toEqual(['서울', '경기']);
    expect(topRegions(map).length).toBe(3);
  });
  it('7일 범위로 읽고, 열쇠 없으면 빈 묶음', async () => {
    expect(await loadWeekMap(null)).toEqual({});
    const calls: string[][] = [];
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.gte = (_c: string, v: string) => { calls.push(['gte', v]); return q; };
    q.lte = (_c: string, v: string) => { calls.push(['lte', v]); return q; };
    q.range = async () => ({ data: [{ region: '11', runs: 3 }], error: null });
    const sb = { from: () => q } as never;
    const r = await loadWeekMap(sb, new Date('2026-10-30T03:00:00Z'));
    expect(r).toEqual({ '11': 3 });
    expect(calls).toEqual([['gte', '2026-10-24'], ['lte', '2026-10-30']]);
  });
});
