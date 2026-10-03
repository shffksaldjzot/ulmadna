// ──────────────────────────────────────────────
// 비밀번호 찾기 2단계 — POST /api/auth/reset-request { username }
//
// 이메일이 등록된 아이디면 1회용 열쇠(30분)를 만들어 ask_password_resets 에 sha256 값만 저장하고
// 재설정 링크(/reset-password?token=…)를 메일로 보낸다.
// 메일 키(RESEND_API_KEY·RESEND_FROM)가 없으면 열쇠를 만들지 않고 { mailEnabled:false } (안내 모드).
// 아이디당 10분 5회 제한(1단계와 같은 칸을 센다).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { fail } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';
import { findUserByLogin, newResetToken } from '@/lib/account/users';
import { hit } from '@/lib/account/rateLimit';
import { mailEnabled, sendResetMail } from '@/lib/account/mail';
import { normalizeUsername, usernameProblem } from '@/lib/account/validate';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://ulmadna.com';

export async function POST(req: Request) {
  if (!mailEnabled()) return NextResponse.json({ ok: false, mailEnabled: false });
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const username = typeof raw.username === 'string' ? normalizeUsername(raw.username) : '';
  if (usernameProblem(username)) return fail(400, '아이디를 확인해 주세요');
  if ((await hit(`hint:${username}`, 10 * 60)) > 5) return fail(429, '잠시 뒤 다시 시도해 주세요(10분에 5번까지)');

  const sb = adminOrNull();
  const user = await findUserByLogin(username);
  if (!sb || !user || user.status !== 'active' || !user.email) return fail(400, '이메일이 등록되지 않은 아이디예요');

  const { token, hash } = newResetToken();
  const { error } = await sb.from('ask_password_resets').insert({
    token_hash: hash,
    user_id: user.id,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error('[auth][reset-request] 저장 실패');
    return fail(500, '잠시 뒤 다시 시도해 주세요');
  }
  const sent = await sendResetMail(user.email, user.username, `${SITE}/reset-password?token=${encodeURIComponent(token)}`);
  if (!sent) return fail(502, '메일을 보내지 못했어요. 문의로 도와드릴게요');
  return NextResponse.json({ ok: true, mailEnabled: true });
}
