// ──────────────────────────────────────────────
// 아이디 회원가입 — POST /api/auth/signup
//
// 받는 값: { username, password, password2, hint, email(선택), nickname, agree }
// 순서: 같은 IP 하루 5회 제한 → 칸 검사 → 아이디·이메일·닉네임 중복 확인 →
//       비밀번호 암호화 → ask_users 저장 → ask_profiles(닉네임) 저장 → { ok }
// 가입 뒤 로그인은 화면이 NextAuth signIn('credentials') 로 바로 이어서 한다.
// 비밀번호 원문은 저장하지도, 로그에 남기지도 않는다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { adminOrNull } from '@/lib/ask/server';
import { fail } from '@/lib/ask/session';
import { hashPassword, sessionIdOf } from '@/lib/account/users';
import { clientIp, hit } from '@/lib/account/rateLimit';
import { normalizeEmail, normalizeUsername, signupProblem } from '@/lib/account/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // bcryptjs 는 Node 런타임에서만

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export async function POST(req: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const input = {
    username: str(raw.username),
    password: str(raw.password),
    password2: str(raw.password2),
    hint: str(raw.hint),
    email: str(raw.email),
    nickname: str(raw.nickname).trim(),
    agree: raw.agree === true,
  };
  const p = signupProblem(input);
  if (p) return fail(400, p.message, { field: p.field });

  const sb = adminOrNull();
  if (!sb) return fail(503, '지금은 가입을 받을 수 없어요. 잠시 뒤 다시 시도해 주세요');

  // 같은 IP 하루 5회(성공·실패 모두 셈 — 검사를 통과한 시도만)
  if ((await hit(`signup:${clientIp(req)}`, 24 * 3600)) > 5) return fail(429, '오늘은 가입을 더 할 수 없어요. 내일 다시 시도해 주세요');

  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email) || null;

  try {
    // 중복 확인(아이디 · 이메일 · 닉네임)
    const { data: u1 } = await sb.from('ask_users').select('id').eq('username', username).maybeSingle();
    if (u1) return fail(409, '이미 있는 아이디예요', { field: 'username' });
    if (email) {
      const { data: u2 } = await sb.from('ask_users').select('id').eq('email', email).maybeSingle();
      if (u2) return fail(409, '이미 가입한 이메일이에요', { field: 'email' });
    }
    const { data: n1 } = await sb.from('ask_profiles').select('user_id').eq('nickname', input.nickname).maybeSingle();
    if (n1) return fail(409, '이미 누가 쓰고 있는 닉네임이에요', { field: 'nickname' });

    const password_hash = await hashPassword(input.password);
    const { data: user, error: uErr } = await sb
      .from('ask_users')
      .insert({ username, password_hash, hint: input.hint.trim(), email, nickname: input.nickname })
      .select('id')
      .single();
    if (uErr || !user) {
      if ((uErr as { code?: string } | null)?.code === '23505') return fail(409, '이미 있는 아이디 또는 이메일이에요');
      throw uErr ?? new Error('insert 실패');
    }

    // 물어보기 닉네임 표에도 같은 이름으로(세션 회원 번호 = user:<uuid>)
    const { error: pErr } = await sb.from('ask_profiles').upsert({ user_id: sessionIdOf(user.id), nickname: input.nickname }, { onConflict: 'user_id' });
    if (pErr) {
      // 닉네임이 그 사이 먼저 쓰였으면 회원 줄을 되돌리고 알린다
      await sb.from('ask_users').delete().eq('id', user.id);
      if ((pErr as { code?: string }).code === '23505') return fail(409, '이미 누가 쓰고 있는 닉네임이에요', { field: 'nickname' });
      throw pErr;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[auth][signup]', e instanceof Error ? e.message : 'error');
    return fail(500, '가입하지 못했어요. 잠시 뒤 다시 시도해 주세요');
  }
}
