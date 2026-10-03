// ──────────────────────────────────────────────
// 물어보기 — 오늘 남은 질문 수 / 이 질문에 남은 댓글 수
//
// GET /api/ask/quota            → { loggedIn, limit:3, used, left, resetAt }
// GET /api/ask/quota?post=번호   → 위 값 + { commentLimit:20, commentLeft }
//   used = 한국 시간 오늘 0시부터 올린 질문 수(서버의 하루 3개 제한과 같은 기준)
//   resetAt = 다음 한국 자정(UTC ISO) — 화면이 이걸로 "n시간 n분" 카운트다운을 한다.
//   로그인 안 했으면 { loggedIn:false } 만. 표가 없으면 used=0 으로.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';
import { LIMITS } from '@/lib/ask/constants';
import { kstDayStartIso } from '@/lib/ask/format';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const uid = await currentUserId();
  const dayStart = kstDayStartIso();
  const resetAt = new Date(Date.parse(dayStart) + 24 * 3600 * 1000).toISOString();
  if (!uid) return NextResponse.json({ loggedIn: false, limit: LIMITS.postsPerDay, resetAt }, { headers: NO_STORE });

  const sb = adminOrNull();
  let used = 0;
  let commentUsed: number | null = null;
  const postRaw = new URL(req.url).searchParams.get('post');
  const postId = postRaw && /^\d+$/.test(postRaw) ? Number(postRaw) : null;
  if (sb) {
    try {
      const { count } = await sb.from('ask_posts').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', dayStart);
      used = count ?? 0;
      if (postId) {
        const { count: c } = await sb
          .from('ask_comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId)
          .eq('user_id', uid)
          .gte('created_at', dayStart);
        commentUsed = c ?? 0;
      }
    } catch {
      /* 표 없음 등 — 0으로 */
    }
  }
  return NextResponse.json(
    {
      loggedIn: true,
      limit: LIMITS.postsPerDay,
      used,
      left: Math.max(0, LIMITS.postsPerDay - used),
      resetAt,
      ...(postId
        ? { commentLimit: LIMITS.commentsPerDayPerPost, commentLeft: Math.max(0, LIMITS.commentsPerDayPerPost - (commentUsed ?? 0)) }
        : {}),
    },
    { headers: NO_STORE },
  );
}
