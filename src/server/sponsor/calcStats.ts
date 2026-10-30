// ──────────────────────────────────────────────
// 광고주 모집 화면(/sponsor)용 "이번 주 계산한 사람 수" — 2026년 10월 30일
//
// [무슨 기능인가]
//   Supabase 일별 표 calc_runs_daily 에서 최근 7일(오늘 포함) 계산 성공 수를 지역(시·도)별로
//   합쳐 한 묶음(지역코드 → 합계)으로 만든다. 공정은 구분하지 않고 견적 전체 합이다.
//   화면은 이 묶음에서 지역 하나의 숫자를 뽑아 쓴다(못 읽거나 0이면 전국 숫자로 대체).
//
// [캐시]
//   unstable_cache 1시간. 지역마다 따로 읽지 않고 "지역코드→합계" 묶음 하나를 캐시한다
//   (지역별 열쇠를 만들어도 DB 읽기는 같은 표라서, 한 번 읽어 모든 지역이 같이 쓰는 쪽이 싸다).
//
// [안전장치] 표가 없거나 연결이 안 되면 빈 묶음(모두 0) — 예외를 밖으로 던지지 않는다.
// ──────────────────────────────────────────────
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminOrNull } from '@/lib/ask/server';
import { kstDay, readAll } from '@/server/metrics/adminDash';
import { SIDO_CODES, REGION_NAMES } from '@/server/admin/format';

/** 지역코드 → 최근 7일 계산 수 합계 */
export type WeekMap = Record<string, number>;

/** 지역 바꿔 보기 칩 — key 는 API 에 넘기는 값 */
export const REGION_CHIPS: { key: string; label: string }[] = [
  { key: '11', label: '서울' },
  { key: '41', label: '경기' },
  { key: '26', label: '부산' },
  { key: '27', label: '대구' },
  { key: '28', label: '인천' },
  { key: '30', label: '대전' },
  { key: 'other', label: '그 외' },
];

/** 칩에 따로 있는 시·도 코드 — "그 외" 는 나머지 시·도 합 */
const CHIP_CODES = REGION_CHIPS.filter((c) => c.key !== 'other').map((c) => c.key);

/** 표에서 읽은 줄들 → 지역코드별 합계 (순수 함수) */
export function sumByRegion(rows: { region: string; runs: number }[]): WeekMap {
  const out: WeekMap = {};
  for (const r of rows) out[r.region] = (out[r.region] ?? 0) + (Number(r.runs) || 0);
  return out;
}

/** 지역 열쇠('all'·시도 코드·'other') → 화면에 쓸 {지역 글자, 숫자}. 0이면 전국 숫자로 대체 (순수 함수) */
export function pickWeek(map: WeekMap, key: string): { label: string; n: number } {
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  let label = '전국';
  let n = total;
  if (key === 'other') {
    n = SIDO_CODES.filter((c) => !CHIP_CODES.includes(c)).reduce((s, c) => s + (map[c] ?? 0), 0);
    label = '그 외 지역';
  } else if (key !== 'all' && SIDO_CODES.includes(key)) {
    n = map[key] ?? 0;
    label = REGION_NAMES[key];
  }
  // 그 지역 숫자가 0이면 거짓 "0명" 대신 전국 숫자
  if (n <= 0) return { label: '전국', n: total };
  return { label, n };
}

/** 시·도별 이번 주 계산 수 표 — 많은 순 상위 limit 개(0인 곳은 뺌) (순수 함수) */
export function topRegions(map: WeekMap, limit = 8): { code: string; name: string; n: number }[] {
  return SIDO_CODES.map((code) => ({ code, name: REGION_NAMES[code], n: map[code] ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code))
    .slice(0, limit);
}

/** 표에서 최근 7일(오늘 포함)을 읽어 묶음을 만든다. 실패하면 빈 묶음 */
export async function loadWeekMap(sb: SupabaseClient | null, now: Date = new Date()): Promise<WeekMap> {
  if (!sb) return {};
  try {
    const today = kstDay(now);
    const from7 = kstDay(now, 6);
    const rows = await readAll<{ region: string; runs: number }>((a, b) =>
      sb.from('calc_runs_daily').select('region,runs').gte('day', from7).lte('day', today).range(a, b));
    return sumByRegion(rows);
  } catch (e) {
    console.warn('[sponsor][week]', e instanceof Error ? e.message : e);
    return {};
  }
}

/** 1시간 캐시된 묶음 — 페이지·API 가 같이 쓴다 */
export const getWeekMap = unstable_cache(
  async () => loadWeekMap(adminOrNull()),
  ['sponsor-week-map'],
  { revalidate: 3600 },
);
