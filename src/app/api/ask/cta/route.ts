// ──────────────────────────────────────────────
// 물어보기 — 블로그 글 끝 카드에 넣을 숫자·질문
//
// GET /api/ask/cta?from=블로그글주소
//   → { stats, posts }  stats=빅데이터 숫자(없으면 null), posts=이 글에서 나온 질문 2개
//
// [왜 블로그 화면이 직접 안 읽고 이 주소를 부르나]
//   블로그 글은 빌드 때 미리 만들어 두는 정적 화면(230편+)이다. 거기서 Supabase를
//   읽으면 빌드가 무거워지고 숫자가 빌드 순간에 굳는다. 그래서 카드는 화면에서
//   이 주소를 불러 숫자만 채운다(60초 캐시).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { getStats, postsFromBlog } from '@/lib/ask/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get('from') ?? '';
  const safeFrom = /^[0-9A-Za-z가-힣_-]{1,120}$/.test(from) ? from : '';
  const [stats, posts] = await Promise.all([getStats(), safeFrom ? postsFromBlog(safeFrom, 2) : Promise.resolve([])]);
  return NextResponse.json(
    { stats, posts: posts.map((p) => ({ slug: p.slug, title: p.title })) },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
