// ──────────────────────────────────────────────
// 물어보기 — 신고
//
// POST /api/ask/report  { postId, reason? }
//   신고 표(ask_reports)에 한 줄 남기기만 한다. 글 상태는 그대로(사장님이 보고 숨김 결정).
//   로그인 없이도 신고할 수 있다(회원이면 회원 번호를 같이 남김).
//   텔레그램 알림은 1단계에선 생략.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sb = adminOrNull();
  if (!sb) return fail(503, '잠시 뒤 다시 시도해 주세요');
  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const postId = Number(input.postId);
  if (!Number.isSafeInteger(postId) || postId <= 0) return fail(400, '잘못된 요청이에요');
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 300) : null;
  const uid = await currentUserId();

  const { error } = await sb.from('ask_reports').insert({ post_id: postId, user_id: uid, reason });
  if (error) {
    console.error('[ask][report]', error.message);
    return fail(500, '신고를 받지 못했어요');
  }
  return NextResponse.json({ ok: true });
}
