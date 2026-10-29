// ──────────────────────────────────────────────
// 견적서 건수 집계 (홈 통계 칸 + 물어보기 빅데이터 상자 공용, 서버 전용)
//
// [출처] Supabase 표 ask_stats 의 key='global' 행, data.shown
//        (집컴 build-stats.mjs 가 밤마다 넣는 "표시 수". 없으면 real + 1,000 규칙).
//        2026-10-29 확인 시점: real 484 / shown 1,484.
// [캐시] unstable_cache 1시간(3600초) — 방문마다 DB를 치지 않는다.
// [폴백] 표/키가 없거나 연결 실패면 마지막 알려진 값(FALLBACK_COUNT)을 돌려준다.
// ──────────────────────────────────────────────
import 'server-only';
import { unstable_cache } from 'next/cache';
import { adminOrNull } from '@/lib/ask/server';

/** DB 실패 시 쓰는 마지막 알려진 값(2026-10-29 기준) */
export const FALLBACK_COUNT = 1484;

/** 실제 DB 조회(캐시 안쪽). 실패하면 throw 하지 않고 폴백 값을 돌려준다 */
async function fetchCount(): Promise<number> {
  const sb = adminOrNull();
  if (!sb) return FALLBACK_COUNT;
  try {
    const { data, error } = await sb.from('ask_stats').select('data').eq('key', 'global').maybeSingle();
    if (error || !data) return FALLBACK_COUNT;
    const d = (data.data ?? {}) as Record<string, unknown>;
    const real = typeof d.real === 'number' ? d.real : null;
    const shown = typeof d.shown === 'number' ? d.shown : real != null ? real + 1000 : null;
    // 0 이하·비정상 값이면 폴백(화면에 0건이 뜨는 사고 방지)
    return shown != null && shown > 0 ? Math.round(shown) : FALLBACK_COUNT;
  } catch {
    return FALLBACK_COUNT;
  }
}

/** 1시간 캐시된 견적서 건수 */
export const getEstimateCount = unstable_cache(fetchCount, ['estimate-count-v1'], { revalidate: 3600 });
