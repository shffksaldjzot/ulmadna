// ──────────────────────────────────────────────
// 관리자 첫 화면(숫자판)용 읽기 모음 — 2026-10-28
//
// [무슨 기능인가]
//   /admin 첫 화면이 보여줄 숫자(조회수·계산기 실행·문의 클릭·인기 글·물어보기)를
//   Supabase 에서 서비스 롤 열쇠로 읽어 한 묶음으로 돌려준다. 서버에서만 호출한다.
//   (회원 숫자는 기존 getMemberStats 를 그대로 쓴다.)
//
// [안전장치]
//   - 새 표·SQL 없음. 있는 표(page_views_daily·calc_runs_daily·contact_clicks_daily·
//     ask_posts·ask_answers)만 읽는다.
//   - 표가 없거나 연결이 안 돼도 예외를 던지지 않는다 — 그 칸만 null 로 두고 화면은 "-" 표시.
//   - 날짜는 한국 날짜 기준(DB 의 metrics_kst_today 와 같게).
// ──────────────────────────────────────────────
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminOrNull } from '@/lib/ask/server';

/** 한국 날짜(YYYY-MM-DD). offset 일 전 */
export function kstDay(now: Date, daysAgo = 0): string {
  const t = new Date(now.getTime() + 9 * 3600 * 1000 - daysAgo * 86400 * 1000);
  return t.toISOString().slice(0, 10);
}

/** 이름별 합계 묶음 — 인기 글 상위 N 뽑기용 순수 함수 */
export function topN(rows: { key: string; n: number }[], limit: number): { key: string; n: number }[] {
  const sum = new Map<string, number>();
  for (const r of rows) sum.set(r.key, (sum.get(r.key) ?? 0) + (Number(r.n) || 0));
  return [...sum.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export interface TrafficDash {
  viewsToday: number;
  views7: number;
  /** 공정별 실행 수(7일). 0 도 항상 4개 다 채워 돌려줌 */
  calc7: Record<'wallpaper' | 'flooring' | 'mortar' | 'tile', number>;
  /** 문의 단추 클릭(7일) */
  contact7: { phone: number; kakao: number };
  /** 인기 글 7일 상위 10 (계산기 결과 화면 calc/... 은 제외, 글만) */
  topPosts: { slug: string; views: number }[];
}

export interface AskDash {
  /** 실제 글 수(seed 예시 글·숨김 제외) */
  posts: number;
  /** 답변이 달린 글 수 */
  answered: number;
  /** 글쓴이가 답변을 읽은 수 */
  read: number;
  helpful: number;
  sorry: number;
}

/** 표 한 곳을 1000줄씩 나눠 끝까지 읽는다(실패하면 throw) */
export async function readAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** 조회수·계산기·문의 클릭. 실패하면 null */
export async function getTrafficDash(now: Date = new Date(), sbIn?: SupabaseClient | null): Promise<TrafficDash | null> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb) return null;
  try {
    const today = kstDay(now);
    const from7 = kstDay(now, 6); // 오늘 포함 7일
    const [views, calcs, clicks] = await Promise.all([
      readAll<{ day: string; slug: string; views: number }>((a, b) =>
        sb.from('page_views_daily').select('day,slug,views').gte('day', from7).lte('day', today).range(a, b)),
      readAll<{ process: string; runs: number }>((a, b) =>
        sb.from('calc_runs_daily').select('process,runs').gte('day', from7).lte('day', today).range(a, b)),
      readAll<{ kind: string; runs: number }>((a, b) =>
        sb.from('contact_clicks_daily').select('kind,runs').gte('day', from7).lte('day', today).range(a, b)),
    ]);
    const num = (v: unknown) => Number(v) || 0;
    const calc7 = { wallpaper: 0, flooring: 0, mortar: 0, tile: 0 };
    for (const r of calcs) if (r.process in calc7) calc7[r.process as keyof typeof calc7] += num(r.runs);
    const contact7 = { phone: 0, kakao: 0 };
    for (const r of clicks) if (r.kind === 'phone' || r.kind === 'kakao') contact7[r.kind] += num(r.runs);
    const posts = views.filter((r) => !r.slug.startsWith('calc/'));
    return {
      viewsToday: views.filter((r) => r.day === today).reduce((s, r) => s + num(r.views), 0),
      views7: views.reduce((s, r) => s + num(r.views), 0),
      calc7,
      contact7,
      topPosts: topN(posts.map((r) => ({ key: r.slug, n: num(r.views) })), 10).map((r) => ({ slug: r.key, views: r.n })),
    };
  } catch (e) {
    console.warn('[admin-dash][traffic]', e instanceof Error ? e.message : e);
    return null;
  }
}

/** 물어보기 숫자. 실패하면 null */
export async function getAskDash(sbIn?: SupabaseClient | null): Promise<AskDash | null> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb) return null;
  try {
    // 예시 글(user_id 가 seed: 로 시작)·숨김 글은 뺀다
    const posts = await readAll<{ id: number }>((a, b) =>
      sb.from('ask_posts').select('id').not('user_id', 'like', 'seed:%').neq('status', 'hidden').order('id').range(a, b));
    const ids = new Set(posts.map((p) => Number(p.id)));
    const answers = await readAll<{ post_id: number; author_read_at: string | null; helpful: boolean | null }>((a, b) =>
      sb.from('ask_answers').select('post_id,author_read_at,helpful').order('id').range(a, b));
    // 실제 글에 달린 답변만 센다. 글 하나에 답변이 여러 버전이면 "글 수"는 한 번만
    const mine = answers.filter((x) => ids.has(Number(x.post_id)));
    return {
      posts: posts.length,
      answered: new Set(mine.map((x) => Number(x.post_id))).size,
      read: mine.filter((x) => x.author_read_at).length,
      helpful: mine.filter((x) => x.helpful === true).length,
      sorry: mine.filter((x) => x.helpful === false).length,
    };
  } catch (e) {
    console.warn('[admin-dash][ask]', e instanceof Error ? e.message : e);
    return null;
  }
}
