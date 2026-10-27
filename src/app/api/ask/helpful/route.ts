// ──────────────────────────────────────────────
// 물어보기 - 글쓴이 본인의 답변 평가(도움됐어요 / 아쉬워요)
//
// POST /api/ask/helpful  { answerId, helpful: true | false }  (로그인 필요)
//   답변이 달린 글의 글쓴이 본인만 저장할 수 있다(다른 사람은 403). 다시 누르면 바뀐다.
//   ask_answers.helpful / helpful_at 에 기록(SQL 20261028 실행 필요).
// 작성일: 2026년 10월 28일
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
  if (!Number.isSafeInteger(answerId) || answerId <= 0 || typeof input.helpful !== 'boolean') return fail(400, '잘못된 요청이에요');

  try {
    // 이 답변이 달린 글의 주인이 지금 로그인한 사람인지 확인
    const { data: ans, error: e1 } = await sb.from('ask_answers').select('post_id').eq('id', answerId).maybeSingle();
    if (e1) throw e1;
    if (!ans) return fail(404, '답변을 찾지 못했어요');
    const { data: post, error: e2 } = await sb.from('ask_posts').select('user_id').eq('id', ans.post_id).maybeSingle();
    if (e2) throw e2;
    if (!post || post.user_id !== uid) return fail(403, '글쓴이만 고를 수 있어요');

    const { error } = await sb.from('ask_answers').update({ helpful: input.helpful, helpful_at: new Date().toISOString() }).eq('id', answerId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[ask][helpful]', e instanceof Error ? e.message : e);
    return fail(500, '저장하지 못했어요');
  }
}
