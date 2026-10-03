// ──────────────────────────────────────────────
// 물어보기 — 이어서 물어보기(댓글) 올리기
//
// POST /api/ask/comments  { postId, body }  (로그인 + 닉네임 필요)
//   - 한 사람이 한 질문에 하루 20개까지
//   - 저장 뒤 질문의 댓글 수를 다시 세서 맞추고, 그 질문 화면을 새로 그린다
//   - AI 재답변은 집컴 답변기가 새 댓글을 찾아 is_ai=true 댓글로 단다(여기선 안 함)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull, getNickname } from '@/lib/ask/server';
import { LIMITS } from '@/lib/ask/constants';
import { kstDayStartIso, hasPhoneNumber } from '@/lib/ask/format';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return fail(401, '로그인이 필요해요');
  const sb = adminOrNull();
  if (!sb) return fail(503, '지금은 댓글을 받을 수 없어요');

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const postId = Number(input.postId);
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!Number.isSafeInteger(postId) || postId <= 0) return fail(400, '어느 질문인지 모르겠어요');
  if (body.length < 1 || body.length > LIMITS.commentMax) return fail(400, `댓글은 1~${LIMITS.commentMax}자로 적어 주세요`);
  if (hasPhoneNumber(body)) return fail(400, '전화번호는 적지 말아 주세요');

  const nickname = await getNickname(uid);
  if (!nickname) return fail(409, '먼저 이름을 정해 주세요', { needNickname: true });

  try {
    // 질문이 있는지(숨김 글엔 댓글 금지)
    const { data: post, error: pErr } = await sb.from('ask_posts').select('id,slug,status').eq('id', postId).maybeSingle();
    if (pErr) throw pErr;
    if (!post || post.status === 'hidden') return fail(404, '질문을 찾을 수 없어요');

    // 하루 20개 제한(이 질문에 오늘 단 내 댓글 수)
    const { count, error: cErr } = await sb
      .from('ask_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('user_id', uid)
      .gte('created_at', kstDayStartIso());
    if (cErr) throw cErr;
    if ((count ?? 0) >= LIMITS.commentsPerDayPerPost) return fail(429, `한 질문에 댓글은 하루 ${LIMITS.commentsPerDayPerPost}개까지예요`);

    const { error: iErr } = await sb.from('ask_comments').insert({ post_id: postId, user_id: uid, nickname, is_ai: false, body });
    if (iErr) throw iErr;

    // 댓글 수 다시 세서 맞추기(더하기 대신 다시 세면 숫자가 어긋날 일이 없다)
    const { count: total } = await sb
      .from('ask_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('status', 'visible');
    await sb.from('ask_posts').update({ comment_count: total ?? 0, updated_at: new Date().toISOString() }).eq('id', postId);

    revalidatePath('/ask/[slug]', 'page');
    revalidatePath('/ask');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[ask][comments]', e instanceof Error ? e.message : e);
    return fail(500, '댓글을 올리지 못했어요');
  }
}
