import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/adminAuth';

export async function GET(req: Request) {
  // 어드민 인증 확인 — 공용 함수(쿠키 %-인코딩 해제 + 시간 안전 비교).
  // 2026-10-29: 예전엔 여기서 쿠키 원문을 그대로 비교해서, 비밀값에 특수문자가 있으면
  // 브라우저가 %-인코딩한 값과 달라 늘 401("권한이 없습니다")이 났다 → 공용 함수로 교체
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // service_role 클라이언트 — 환경변수 없으면 깔끔한 500 JSON으로 응답
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[admin-users] Supabase 초기화 실패:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'DB 연결 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)' }, { status: 500 });
  }

  // 저장된 견적에서 유저별 통계 조회 (관리자 화면이라 전체 유저 대상 — RLS 우회 필요해서 admin 클라이언트 사용)
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
