// ──────────────────────────────────────────────
// 물어보기 — 질문 목록 더 보기(GET) · 질문 올리기(POST)
//
// GET  /api/ask/posts?cursor=번호&kind=estimate|cost&trade=도배&mine=1
//      → { items, next } (next = 다음 쪽 커서, 더 없으면 null)
//      mine=1 이면 로그인한 사람의 질문만(숨김 상태여도 내 글은 보인다).
// POST /api/ask/posts  (로그인 + 닉네임 필요)
//      → 검사 · 하루 제한(전체 10개 선착순 + 회원당 1개) · 주소(slug) 만들기 · status=queued 로 저장 → { slug }
//      저장 뒤엔 집컴 답변기가 5분마다 새 글을 찾아 답을 쓴다(이 API는 답을 안 씀).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull, listPosts, getNickname, countToday } from '@/lib/ask/server';
import { computeQuota, blockedMessage } from '@/lib/ask/quota';
import { LIMITS, TRADES, REGIONS, type AskKind } from '@/lib/ask/constants';
import { makeSlug, kstDayStartIso, hasPhoneNumber } from '@/lib/ask/format';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursorRaw = url.searchParams.get('cursor');
  const cursor = cursorRaw && /^\d+$/.test(cursorRaw) ? Number(cursorRaw) : null;
  const kindRaw = url.searchParams.get('kind');
  const kind: AskKind | null = kindRaw === 'estimate' || kindRaw === 'cost' ? kindRaw : null;
  const tradeRaw = url.searchParams.get('trade');
  const trade = tradeRaw && (TRADES as readonly string[]).includes(tradeRaw) ? tradeRaw : null;

  // 내 질문 보기 — 로그인 필수
  if (url.searchParams.get('mine') === '1') {
    const uid = await currentUserId();
    if (!uid) return fail(401, '로그인이 필요해요');
    const res = await listPosts({ cursor, userId: uid, limit: 50 });
    return NextResponse.json(res, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const res = await listPosts({ cursor, kind, trade });
  // 공개 목록은 짧게(60초) 캐시해도 된다 — 목록 화면도 60초마다 새로 그린다
  return NextResponse.json(res, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
}

/** 들어온 값 하나를 글자로 다듬기(앞뒤 공백 제거, 글자 아니면 빈 글자) */
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return fail(401, '로그인이 필요해요');

  const sb = adminOrNull();
  if (!sb) return fail(503, '지금은 질문을 받을 수 없어요. 잠시 뒤 다시 시도해 주세요');

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }

  // ── 닉네임이 있어야 글을 쓸 수 있다(글에 이름이 박히므로) ──
  const nickname = await getNickname(uid);
  if (!nickname) return fail(409, '먼저 이름을 정해 주세요', { needNickname: true });

  // ── 값 검사 ──
  const kind: AskKind = input.kind === 'estimate' ? 'estimate' : 'cost';
  const title = str(input.title);
  const body = str(input.body);
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) return fail(400, `제목은 ${LIMITS.titleMin}~${LIMITS.titleMax}자로 적어 주세요`);
  if (body.length > LIMITS.bodyMax) return fail(400, `설명은 ${LIMITS.bodyMax.toLocaleString()}자까지예요`);
  if (hasPhoneNumber(title) || hasPhoneNumber(body)) return fail(400, '전화번호는 적지 말아 주세요');

  const trades = Array.isArray(input.trades)
    ? Array.from(new Set((input.trades as unknown[]).filter((t): t is string => typeof t === 'string' && (TRADES as readonly string[]).includes(t))))
    : [];
  if (trades.length === 0) return fail(400, '공정을 하나 이상 골라 주세요');

  const pyeongNum = Number(input.pyeong);
  const pyeong = Number.isInteger(pyeongNum) && pyeongNum >= 5 && pyeongNum <= 200 ? pyeongNum : null;
  const typeCode = /^\d{2,3}[A-Za-z]?$/.test(str(input.type_code)) ? str(input.type_code) : null;
  const region = (REGIONS as readonly string[]).includes(str(input.region)) ? str(input.region) : null;
  const fromSlug = /^[0-9A-Za-z가-힣_-]{1,120}$/.test(str(input.from_slug)) ? str(input.from_slug) : null;

  // 사진 경로 — 반드시 "내 회원 번호/" 로 시작하는 경로만 받는다(남의 사진 경로 끼워 넣기 방지)
  const photoPaths = Array.isArray(input.photos)
    ? (input.photos as unknown[]).filter((p): p is string => typeof p === 'string' && p.startsWith(`${uid}/`) && !p.includes('..')).slice(0, LIMITS.photosMax)
    : [];
  if (kind === 'estimate' && photoPaths.length === 0) return fail(400, '견적서 사진을 한 장 이상 올려 주세요');
  const photos = photoPaths.map((raw) => ({ raw, masked: null }));

  try {
    // ── 하루 제한(한국 날짜 기준 오늘 0시부터): 전체 10개 선착순 + 회원당 1개 ──
    // 계산 규칙은 lib/ask/quota.ts 한 곳(화면 안내 /api/ask/quota 와 같은 기준)
    const q = computeQuota(await countToday(kstDayStartIso(), uid));
    const blockedMsg = blockedMessage(q.blocked);
    if (blockedMsg) return fail(429, blockedMsg, { blocked: q.blocked });

    // ── 저장: 번호를 먼저 받아야 주소를 만들 수 있어서 임시 주소로 넣고 바로 바꾼다 ──
    const tmpSlug = `tmp-${crypto.randomUUID()}`;
    const { data: ins, error: iErr } = await sb
      .from('ask_posts')
      .insert({
        slug: tmpSlug,
        user_id: uid,
        nickname,
        kind,
        title,
        body,
        pyeong,
        type_code: typeCode,
        region,
        trades,
        photos,
        from_slug: fromSlug,
        status: 'queued',
      })
      .select('id')
      .single();
    if (iErr || !ins) throw iErr ?? new Error('insert 실패');

    const slug = makeSlug(Number(ins.id), title);
    const { error: uErr } = await sb.from('ask_posts').update({ slug }).eq('id', ins.id);
    if (uErr) throw uErr;

    // 목록 화면을 바로 새로 그리게(60초 기다리지 않게)
    revalidatePath('/ask');
    return NextResponse.json({ slug, id: ins.id });
  } catch (e) {
    console.error('[ask][posts][POST]', e instanceof Error ? e.message : e);
    return fail(500, '질문을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요');
  }
}
