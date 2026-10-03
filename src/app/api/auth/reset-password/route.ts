// ──────────────────────────────────────────────
// 비밀번호 재설정 — POST /api/auth/reset-password { token, password, password2 }
//
// 메일 링크의 열쇠를 sha256 으로 바꿔 찾고, 30분 안·한 번도 안 쓴 열쇠일 때만
// 새 비밀번호(암호화 값)로 바꾼다. 쓴 열쇠는 used_at 을 찍어 다시 못 쓰게 한다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { fail } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';
import { hashPassword, sha256 } from '@/lib/account/users';
import { passwordProblem } from '@/lib/account/validate';
import { clientIp, hit } from '@/lib/account/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const token = typeof raw.token === 'string' ? raw.token : '';
  const password = typeof raw.password === 'string' ? raw.password : '';
  const password2 = typeof raw.password2 === 'string' ? raw.password2 : '';
  if (!token) return fail(400, '링크가 올바르지 않아요');
  const p = passwordProblem(password);
  if (p) return fail(400, p);
  if (password !== password2) return fail(400, '비밀번호가 서로 달라요');
  if ((await hit(`reset:${clientIp(req)}`, 10 * 60)) > 10) return fail(429, '잠시 뒤 다시 시도해 주세요');

  const sb = adminOrNull();
  if (!sb) return fail(503, '잠시 뒤 다시 시도해 주세요');
  const { data: row } = await sb
    .from('ask_password_resets')
    .select('id,user_id,expires_at,used_at')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) return fail(400, '링크가 만료됐어요. 다시 요청해 주세요');

  // 먼저 열쇠를 "사용함"으로 찍는다(동시에 두 번 눌러도 한 번만 바뀌게)
  const { data: used } = await sb
    .from('ask_password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('used_at', null)
    .select('id');
  if (!used || used.length === 0) return fail(400, '이미 쓴 링크예요');

  const { error } = await sb.from('ask_users').update({ password_hash: await hashPassword(password) }).eq('id', row.user_id);
  if (error) return fail(500, '바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요');
  return NextResponse.json({ ok: true });
}
