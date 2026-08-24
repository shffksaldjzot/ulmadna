// ──────────────────────────────────────────────
// RSS 피드 — https://ulmadna.com/feed.xml
//
// RSS는 "새 글 알림 구독" 표준 형식입니다. 구독 앱(피들리 등)이나
// 검색엔진·AI 크롤러가 이 주소만 보면 새 글이 올라왔는지 바로 압니다.
// 최신 30편만 담습니다(전체를 담으면 파일이 커지고 구독기도 안 좋아함).
// ──────────────────────────────────────────────

import { getAllPostMeta } from "@/lib/blog";

const SITE = "https://ulmadna.com";
const MAX_ITEMS = 30; // 피드에 담을 최신 글 수

// 빌드 때 한 번 만들어 정적 파일처럼 서빙 (사이트맵과 같은 방식)
export const dynamic = "force-static";

/**
 * XML에서 문제를 일으키는 글자(< > & " ')를 안전한 형태로 바꿈.
 * 제목에 &나 <가 들어가면 피드 전체가 깨지기 때문에 반드시 필요합니다.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 2026-08-23 → RSS가 요구하는 날짜 형식(Tue, 23 Aug 2026 09:00:00 +0900) */
function toRfc822(date: string): string {
  // 날짜만 있고 시각이 없어서, 한국 시간 오전 9시로 맞춰 넣음
  const d = date ? new Date(`${date}T09:00:00+09:00`) : new Date();
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export function GET() {
  const posts = getAllPostMeta().slice(0, MAX_ITEMS);

  const items = posts
    .map((p) => {
      const url = `${SITE}/blog/${p.slug}`;
      // 태그는 <category>로 하나씩 — 구독기에서 주제 분류로 쓰임
      const categories = p.tags
        .slice(0, 8)
        .map((t) => `      <category>${esc(t)}</category>`)
        .join("\n");
      return [
        "    <item>",
        `      <title>${esc(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <description>${esc(p.description)}</description>`,
        `      <pubDate>${toRfc822(p.date)}</pubDate>`,
        categories,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>얼마드나 — 인테리어 정보 블로그</title>
    <link>${SITE}/blog</link>
    <description>업체 말고, 소비자 편에서 정리한 인테리어 비용·견적·자재 이야기</description>
    <language>ko</language>
    <lastBuildDate>${posts[0] ? toRfc822(posts[0].date) : new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // 1시간 캐시 — 자동 발행 봇이 글을 올려도 곧 반영됨
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
