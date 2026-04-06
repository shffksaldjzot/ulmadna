import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

const MAX_ESTIMATES = 10;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await getSupabase()
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

  const body = await req.json();
  const userId = session.user.id;

  // 10건 초과 체크 → 가장 오래된 것 삭제
  const { count } = await getSupabase()
    .from('saved_estimates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count !== null && count >= MAX_ESTIMATES) {
    const { data: oldest } = await getSupabase()
      .from('saved_estimates')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (oldest) {
      await getSupabase().from('saved_estimates').delete().eq('id', oldest.id);
    }
  }

  const { data, error } = await getSupabase()
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

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('saved_estimates')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
