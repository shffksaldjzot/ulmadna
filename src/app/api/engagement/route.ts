// ──────────────────────────────────────────────
// 블로그 글 조회수 +1 / 읽기 API — Supabase 자체 집계 (2026-10-27 Upstash에서 옮김)
//   POST ?slug=X        → 조회수 +1 (글 볼 때 1회). 응답은 {ok:true} 뿐 — 숫자는 글 화면이
//                          서버에서 미리 넣어 두므로(60초 캐시) 여기서 다시 읽지 않는다.
//                          → 글 1회 열람 = DB 호출 1번.
//   GET  ?slug=X        → {views, likes} (60초 캐시 값 읽기만, 관리·확인용)
//   GET  ?slug=X&hit=1  → 옛 화면 호환: 조회수 +1 후 캐시 값 {views, likes}
//
// 세지 않는 경우: 봇(검색 수집기 등), 실제로 없는 글 slug(아무 이름으로 칸을 늘리는 장난 방지).
// 같이 세는 것: 지역(시도)·기기(휴대폰/태블릿/PC)·유입 경로(직접/검색/공유/그 밖).
// 개인정보(IP·브라우저 정보 원문)는 저장하지 않는다.
//
// 2026-09-15부터 좋아요는 /api/blog/like 가 맡는다. 아래 옛 POST 좋아요(?like=1)는 남아 있는
//   외부 호출 호환용으로만 둔다.
// ──────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { getAllSlugs } from '@/lib/blog';
import { bumpPageView } from '@/server/metrics/metricsStore';
import { cleanSlug, getCachedPostTotals, toggleBlogLike } from '@/server/metrics/blogLike';
import { deviceFromUA, isBotUA, regionFromHeaders, sourceFromCookie, SRC_COOKIE } from '@/server/metrics/requestInfo';

/** 매번 새로 처리 (캐시 금지) */
export const dynamic = 'force-dynamic';

/** 실제 존재하는 글 slug 인지 (content/blog/*.md) */
function realSlug(raw: string | null): string {
  const s = cleanSlug(raw ?? '');
  return s && getAllSlugs().includes(s) ? s : '';
}

/** 조회수 +1 을 응답 뒤로 예약한다 (봇이면 아무것도 안 함) */
function countView(req: NextRequest, slug: string): void {
  const ua = req.headers.get('user-agent');
  if (isBotUA(ua)) return; // 봇은 세지 않는다
  bumpPageView(
    slug,
    regionFromHeaders(req.headers),
    deviceFromUA(ua),
    sourceFromCookie(req.cookies.get(SRC_COOKIE)?.value),
  );
}

/** 새 화면이 부르는 조회수 +1. ?like=1 이면 옛 좋아요 +1(호환) */
export async function POST(req: NextRequest) {
  const slug = realSlug(req.nextUrl.searchParams.get('slug'));
  if (!slug) return NextResponse.json({ ok: false }, { status: 404 });
  if (req.nextUrl.searchParams.get('like') === '1') {
    const likes = await toggleBlogLike(slug, true);
    return NextResponse.json({ likes });
  }
  countView(req, slug);
  return NextResponse.json({ ok: true });
}

/** 읽기(캐시 값) — hit=1 이면 옛 화면 호환으로 +1 도 같이 */
export async function GET(req: NextRequest) {
  const slug = realSlug(req.nextUrl.searchParams.get('slug'));
  if (!slug) return NextResponse.json({ views: null, likes: null });
  if (req.nextUrl.searchParams.get('hit') === '1') countView(req, slug);
  const t = await getCachedPostTotals(slug);
  return NextResponse.json({ views: t?.views ?? null, likes: t?.likes ?? null });
}
