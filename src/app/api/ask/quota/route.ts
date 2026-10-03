// ──────────────────────────────────────────────
// 물어보기 — 오늘 남은 질문·댓글 수
//
// GET /api/ask/quota
//   → { loggedIn, globalLimit, globalLeft, limit, left, commentLimit, commentLeft, canAsk, blocked, resetAt }
//   전체 하루 10개 선착순(globalLeft)은 로그인 전에도 준다. 개인 몫(left·commentLeft)은 로그인 뒤에만.
//   resetAt = 다음 한국 자정(UTC ISO) — 화면이 "n시간 n분" 카운트다운에 쓴다.
//   계산 규칙은 lib/ask/quota.ts(computeQuota) 한 곳 — 질문 올리기 API와 같은 기준.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/ask/session';
import { countToday } from '@/lib/ask/server';
import { computeQuota } from '@/lib/ask/quota';
import { kstDayStartIso } from '@/lib/ask/format';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUserId();
  const dayStart = kstDayStartIso();
  const resetAt = new Date(Date.parse(dayStart) + 24 * 3600 * 1000).toISOString();
  const used = await countToday(dayStart, uid);
  return NextResponse.json({ loggedIn: !!uid, ...computeQuota(used), resetAt }, { headers: { 'Cache-Control': 'private, no-store' } });
}
