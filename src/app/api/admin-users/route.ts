import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: Request) {
  // 환경변수 검증 — 미설정 시 인증 자체가 불가능하므로 500.
  // (예전엔 'fallback-token' 폴백 + 쿠키 존재만 체크 → 우회 가능했음 → 수정)
  const sessionToken = process.env.NEXTAUTH_SECRET;
  if (!sessionToken) {
    console.error('[admin-users] NEXTAUTH_SECRET 미설정');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // 어드민 인증 확인 — 쿠키 값이 sessionToken과 정확히 일치해야 통과
  const cookieHeader = req.headers.get('cookie') || '';
  const adminAuthCookie = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('admin-auth='));
  const cookieValue = adminAuthCookie?.slice('admin-auth='.length);

  if (!cookieValue || cookieValue !== sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();

  // 저장된 견적에서 유저별 통계 조회
  const { data: estimates, error } = await supabase
    .from('saved_estimates')
    .select('user_id, title, created_at, output')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 유저별로 그룹핑
  const userMap = new Map<string, {
    userId: string;
    estimateCount: number;
    lastActive: string;
    estimates: { title: string; total: number; createdAt: string }[];
  }>();

  for (const est of estimates || []) {
    const userId = est.user_id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        estimateCount: 0,
        lastActive: est.created_at,
        estimates: [],
      });
    }
    const user = userMap.get(userId)!;
    user.estimateCount++;
    user.estimates.push({
      title: est.title || '제목 없음',
      total: est.output?.total || 0,
      createdAt: est.created_at,
    });
  }

  const users = Array.from(userMap.values())
    .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

  return NextResponse.json({
    totalUsers: users.length,
    totalEstimates: estimates?.length || 0,
    users,
  });
}
