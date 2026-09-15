import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const MAX_ESTIMATES = 10;

// service_role 클라이언트를 안전하게 가져온다 — 환경변수(SUPABASE_SERVICE_ROLE_KEY)가
// 없으면 여기서 에러를 던지는데, 그걸 각 핸들러가 잡아서 "DB 불가"를 깔끔한 500 JSON으로 응답한다.
// (안 잡으면 Next.js가 영어 스택트레이스 500 페이지를 그대로 노출함)
function getAdminClientOrThrow() {
  return getSupabaseAdmin();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getAdminClientOrThrow();
  } catch (e) {
    console.error('[estimates][GET] Supabase 초기화 실패:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'DB 연결 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)' }, { status: 500 });
  }

  // ★ user_id 필터는 서버가 강제 — 클라이언트가 뭘 보내든 본인 견적만 조회됨
  const { data, error } = await supabase
    .from('saved_estimates')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_ESTIMATES);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getAdminClientOrThrow();
  } catch (e) {
    console.error('[estimates][POST] Supabase 초기화 실패:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'DB 연결 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)' }, { status: 500 });
  }

  const body = await req.json();
  const userId = session.user.id;

  // 10건 초과 체크 → 가장 오래된 것 삭제 (본인 것만, user_id 필터 필수)
  const { count } = await supabase
    .from('saved_estimates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count !== null && count >= MAX_ESTIMATES) {
    const { data: oldest } = await supabase
      .from('saved_estimates')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (oldest) {
      // 삭제할 때도 user_id를 한 번 더 걸어서 이중 방어(설계상 이미 본인 것만 조회됐지만 안전하게)
      await supabase.from('saved_estimates').delete().eq('id', oldest.id).eq('user_id', userId);
    }
  }

  const { data, error } = await supabase
    .from('saved_estimates')
    .insert({
      user_id: userId,
      title: body.title || '내 견적',
      input: body.input,
      output: {
        total: body.output.total,
        perPyeong: body.output.perPyeong,
        subtotal: body.output.subtotal,
        rationality: body.output.rationality,
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getAdminClientOrThrow();
  } catch (e) {
    console.error('[estimates][DELETE] Supabase 초기화 실패:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'DB 연결 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)' }, { status: 500 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // ★ id + user_id 둘 다 일치해야 삭제됨 — 다른 사람 id를 넣어도 못 지움
  const { error } = await supabase
    .from('saved_estimates')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
