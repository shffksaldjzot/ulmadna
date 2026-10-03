// ──────────────────────────────────────────────
// 물어보기 — 닉네임 읽기·중복 확인·정하기
//
// GET /api/ask/profile              → { loggedIn, nickname }  (내 닉네임, 없으면 null)
// GET /api/ask/profile?check=이름    → { available, problem }  (쓸 수 있는 이름인지)
// PUT /api/ask/profile  { nickname } → 내 닉네임 정하기/바꾸기 (로그인 필요)
//   이미 올린 글의 이름은 그대로(글엔 쓸 때 이름이 박혀 있다).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull, getNickname } from '@/lib/ask/server';
import { nicknameProblem } from '@/lib/ask/format';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const check = url.searchParams.get('check');
  const uid = await currentUserId();

  // 중복 확인
  if (check !== null) {
    const name = check.trim();
    const problem = nicknameProblem(name);
    if (problem) return NextResponse.json({ available: false, problem }, { headers: NO_STORE });
    const sb = adminOrNull();
    if (!sb) return NextResponse.json({ available: false, problem: '잠시 뒤 다시 확인해 주세요' }, { headers: NO_STORE });
    const { data, error } = await sb.from('ask_profiles').select('user_id').eq('nickname', name).maybeSingle();
    if (error) return NextResponse.json({ available: false, problem: '잠시 뒤 다시 확인해 주세요' }, { headers: NO_STORE });
    // 이미 내 이름이면 "쓸 수 있음"으로
    const available = !data || data.user_id === uid;
    return NextResponse.json({ available, problem: available ? null : '이미 누가 쓰고 있어요' }, { headers: NO_STORE });
  }

  if (!uid) return NextResponse.json({ loggedIn: false, nickname: null }, { headers: NO_STORE });
  const nickname = await getNickname(uid);
  return NextResponse.json({ loggedIn: true, nickname }, { headers: NO_STORE });
}

export async function PUT(req: Request) {
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
  const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
  const problem = nicknameProblem(nickname);
  if (problem) return fail(400, problem);

  const { error } = await sb.from('ask_profiles').upsert({ user_id: uid, nickname }, { onConflict: 'user_id' });
  if (error) {
    // 23505 = 같은 닉네임이 이미 있음(unique 걸림)
    if ((error as { code?: string }).code === '23505') return fail(409, '이미 누가 쓰고 있어요');
    console.error('[ask][profile][PUT]', error.message);
    return fail(500, '저장하지 못했어요');
  }
  return NextResponse.json({ ok: true, nickname });
}
