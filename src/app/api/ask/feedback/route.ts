// ──────────────────────────────────────────────
// 물어보기 — 답변 평가(도움 됐어요 / 틀렸어요)
//
// POST /api/ask/feedback  { answerId, kind: 'helpful' | 'wrong' }  (로그인 필요)
//   한 사람이 답변 하나에 한 번 — 다시 누르면 마지막 선택으로 바뀐다(upsert).
//   "틀렸어요"가 쌓이면 집컴이 밤에 2차 검토한다(여기선 저장만).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return fail(401, '로그인이 필요해요');
  const sb = adminOrNull();
  if (!sb) return fail(503, '잠시 뒤 다시 시도해 주세요');

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const answerId = Number(input.answerId);
  const kind = input.kind === 'helpful' || input.kind === 'wrong' ? input.kind : null;
  if (!Number.isSafeInteger(answerId) || answerId <= 0 || !kind) return fail(400, '잘못된 요청이에요');

  try {
    const { error } = await sb
      .from('ask_feedback')
      .upsert({ answer_id: answerId, user_id: uid, kind, created_at: new Date().toISOString() }, { onConflict: 'answer_id,user_id' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[ask][feedback]', e instanceof Error ? e.message : e);
    return fail(500, '저장하지 못했어요');
  }
}
