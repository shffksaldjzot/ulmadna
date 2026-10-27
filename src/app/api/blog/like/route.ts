// ──────────────────────────────────────────────
// 블로그 글 좋아요 API
//   GET  ?slug=X → { count }        (읽기만 — 2026-10-27부터 화면은 안 부름. 글 화면이 서버에서
//                                    숫자를 넣어 줌. 남은 외부 호출 호환용, 60초 캐시 값)
//   POST { slug, on } → { count }   (토글 — on=true면 +1, false면 -1)
//
// 로그인 없이 브라우저마다 "눌렀다/안 눌렀다"는 클라이언트(localStorage, blog-my.ts)가
// 스스로 관리하고, 여기서는 그 결과에 맞춰 서버 숫자(Supabase post_likes, 2026-10-27 Upstash에서 옮김)만 +1/-1 한다.
// 같은 브라우저가 같은 글을 두 번 연속 좋아요 누르는 일은 클라이언트가 이미
// "눌린 상태"로 막아주므로, 이 라우트는 넘어온 on 값을 그대로 믿고 처리한다.
//
// [초기값 — 2026-10-27 바뀜]
// 예전엔 글 페이지가 정적 생성이 깨질까 봐 브라우저가 이 GET 을 불렀다. 이제는 글 화면이
// unstable_cache(60초) 로 Supabase 를 읽어 props 로 넘긴다 — 정적 페이지는 그대로 두고
// 60초마다 뒤에서 다시 만들어지는(ISR) 방식이라 느려지지 않는다.
//
// [슬러그 검증 — 검사관 지적(2026-09-15) 반영]
// 아무 문자열이나 slug로 보내도 좋아요가 쌓이면, 존재하지 않는 글 이름으로 DB 줄이
// 무한정 늘어날 수 있다(악의적 요청 방어). 그래서 실제로 있는 글(content/blog/*.md)인지
// getAllSlugs()로 확인하고, 없으면 404로 거절한다.
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getBlogLikeCount, toggleBlogLike } from "@/server/metrics/blogLike";
import { getAllSlugs } from "@/lib/blog";

/** 실제 존재하는 글 slug인지 확인 (getAllSlugs는 비공개(draft) 글도 포함 — 검토 링크로 좋아요 눌러도 되게) */
function isRealSlug(slug: string): boolean {
  return getAllSlugs().includes(slug);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!slug || !isRealSlug(slug)) {
    return NextResponse.json({ count: null }, { status: 404 });
  }
  const count = await getBlogLikeCount(slug);
  return NextResponse.json({ count });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = typeof body?.slug === "string" ? body.slug : "";
    const on = body?.on === true;
    if (!slug || !isRealSlug(slug)) {
      return NextResponse.json({ count: null }, { status: 404 });
    }
    const count = await toggleBlogLike(slug, on);
    return NextResponse.json({ count });
  } catch {
    // 요청 형식이 이상하거나 처리 중 오류가 나도 화면이 죽지 않도록 항상 200으로 조용히 응답
    return NextResponse.json({ count: null });
  }
}
