// ──────────────────────────────────────────────
// 블로그 글 "좋아요" 익명 카운트 + 글 누적 조회수 읽기
//
// [어디에 쌓나 — 2026-10-27 바뀜]
//   예전엔 Upstash Redis 키 likes:{slug}·views:{slug}. 이제 Supabase:
//     좋아요 = post_likes 표(글마다 숫자 1개), 조회수 = page_views_daily 표의 그 글 합계.
//   옛 Redis 숫자는 Upstash 한도 리셋 뒤 scripts/migrate-views-from-upstash.mjs 로 한 번 옮긴다.
//
// [왜 좋아요는 after()를 안 쓰나]
//   토글 버튼을 누른 사람에게 "지금 몇 개인지" 바로 보여줘야 해서 결과를 기다린다.
//   실패하면 null 을 돌려주고, 화면(PostActions)은 낙관적으로 계산한 숫자를 그대로 쓴다.
//
// [글 화면 첫 숫자 — 60초 캐시]
//   글 화면은 미리 만들어 두는(정적) 페이지라, 서버가 그릴 때 숫자를 한 번 읽어 넣고
//   60초 동안은 같은 값을 다시 쓴다(getCachedPostTotals). 그래서 글 위·글 끝 PostActions 2개와
//   조회수 표시가 각각 API 를 부르던 것(글 1회 열람 = 읽기 3번)이 0번이 됐다.
//
// 작성일: 2026년 09월 15일
// 2026년 10월 27일: Upstash → Supabase, 조회수·좋아요 한 번에 읽기(60초 캐시)
// ──────────────────────────────────────────────
import 'server-only';
import { unstable_cache } from 'next/cache';
import { bumpLike, readPostTotals } from './metricsStore';

/** slug 검사 — 영문 소문자/숫자/하이픈만 (DB 함수도 같은 규칙으로 한 번 더 검사) */
export function cleanSlug(slug: string): string {
  return (slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100);
}

/**
 * 글 하나의 누적 조회수·좋아요를 60초 캐시로 읽는다. 실패하면 null(화면에서 숫자 숨김).
 * 글 화면([slug]/page.tsx) 서버 렌더에서 한 번 부른다.
 */
// [비용 — 2026년 11월 09일] 60초 → 3600초(1시간).
//   이 revalidate 가 글 페이지(/blog/[slug]) 전체의 재생성 주기가 된다(Next.js 는 페이지 안 캐시 중
//   가장 짧은 주기를 페이지 주기로 삼음). 60초였을 때 봇이 글 361편을 훑을 때마다 다시 그려서
//   버셀 ISR 쓰기가 하루 7만~11만 회($0.3~0.45/일)였다. 1시간이면 글당 하루 최대 24번.
//   좋아요는 토글 때 그 글만 즉시 다시 그리므로(api/blog/like POST 의 revalidatePath) 늦지 않는다.
export const getCachedPostTotals = unstable_cache(
  async (slug: string) => readPostTotals(cleanSlug(slug)),
  ['metrics-post-totals-v1'],
  { revalidate: 3600 },
);

/** 이 글의 현재 좋아요 수 (옛 GET /api/blog/like 호환용). 실패·없음이면 0 */
export async function getBlogLikeCount(slug: string): Promise<number> {
  const s = cleanSlug(slug);
  if (!s) return 0;
  const t = await getCachedPostTotals(s);
  return t?.likes ?? 0;
}

/**
 * 좋아요를 켜거나(on=true → +1) 끈다(on=false → -1). 바뀐 뒤 최종 숫자를 돌려준다.
 * 실패하면 null — 이때 클라이언트는 자기가 낙관적으로 계산해둔 숫자를 그대로 쓴다.
 */
export async function toggleBlogLike(slug: string, on: boolean): Promise<number | null> {
  const s = cleanSlug(slug);
  if (!s) return null;
  return bumpLike(s, on);
}
