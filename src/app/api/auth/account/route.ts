// ──────────────────────────────────────────────
// 회원 탈퇴 — DELETE /api/auth/account (로그인 필요)
//
// - 아이디 회원: ask_users 줄 삭제(재설정 열쇠도 함께 지워짐) + ask_profiles(닉네임) 삭제
// - 카카오 회원: ask_profiles(닉네임) 삭제
// 올린 질문·댓글은 지우지 않는다(쓸 때의 닉네임이 글에 박혀 있어 그대로 남음).
// 탈퇴 뒤 로그아웃은 화면이 이어서 한다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';
import { uuidOf } from '@/lib/account/users';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  const sid = await currentUserId();
  if (!sid) return fail(401, '로그인이 필요해요');
  const sb = adminOrNull();
  if (!sb) return fail(503, '잠시 뒤 다시 시도해 주세요');
  try {
    const uuid = uuidOf(sid);
    if (uuid) {
      const { error } = await sb.from('ask_users').delete().eq('id', uuid);
      if (error) throw error;
    }
    const { error: pErr } = await sb.from('ask_profiles').delete().eq('user_id', sid);
    if (pErr) throw pErr;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[auth][account][DELETE]', e instanceof Error ? e.message : 'error');
    return fail(500, '탈퇴하지 못했어요. 문의로 도와드릴게요');
  }
}
