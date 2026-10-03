import type { MetadataRoute } from 'next';
import { getAllPostMeta } from '@/lib/blog';
import { BLOG_CATEGORIES } from '@/lib/blog-categories';
import { answeredForSitemap } from '@/lib/ask/server';
import { askHref } from '@/lib/ask/format';

// 물어보기 질문이 새로 답변되면 사이트맵에도 들어가야 해서 1시간마다 새로 만든다
// (집컴이 /api/ask/revalidate 를 부르면 그때 바로 새로 만든다) — 2026년 10월 03일
export const revalidate = 3600;

const SITE = 'https://ulmadna.com';

// 사이트맵 — 홈 + 블로그 목록 + 모든 블로그 글 + 물어보기(목록·답변 달린 질문) (구글 색인용)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = getAllPostMeta();
  // 답변 달린 질문 전부 — 표가 없거나 연결이 안 되면 빈 목록(사이트맵은 그대로 나감)
  const asks = await answeredForSitemap();

  return [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // 신뢰 페이지 — 소개/문의/약관 (구글 애드센스 색인용)
    { url: `${SITE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    // 직접 제작·시공 서비스 카탈로그 (2026-09-16 신설)
    { url: `${SITE}/service`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    // calc 허브 + 공정별 계산기 (2026-09-10: 바닥재 계산기 U 지시서 — 지금까지 사이트맵에 아예
    // 빠져 있었다. 도배·바닥재 계산기 페이지도 검색에 잡히게 여기서 함께 추가한다)
    { url: `${SITE}/calc`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/calc/wallpaper`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/calc/flooring`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    // 몰탈 계산기 — "몰탈 계산기" 검색 노출 강화 대상이라 한 단계 높임(2026년 10월 03일)
    { url: `${SITE}/calc/mortar`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    // 타일 계산기 — "타일 계산기" 검색 노출 대상(2026년 10월 03일 신설)
    { url: `${SITE}/calc/tile`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    // 물어보기 목록 (2026년 10월 03일)
    { url: `${SITE}/ask`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.8 },
    // 카테고리 허브 8장 — 주제별 모음 페이지 (글 목록 다음으로 중요한 색인 대상)
    ...BLOG_CATEGORIES.map((c) => ({
      url: `${SITE}/blog/category/${c.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // 블로그 글 각각
    // lastModified = 시세를 갱신한 날(updated)이 있으면 그 날, 없으면 처음 발행한 날
    // (구글에 "이 글은 최근에 손봤다"고 알려서 다시 훑어가게 하려는 것)
    ...posts.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.updated ? new Date(p.updated) : p.date ? new Date(p.date) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    // 물어보기 — 답변 달린 질문 각각 (주소의 한글은 인코딩해서 넣는다)
    ...asks.map((a) => ({
      url: `${SITE}${askHref(a.slug)}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
