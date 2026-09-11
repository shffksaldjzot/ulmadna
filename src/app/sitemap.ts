import type { MetadataRoute } from 'next';
import { getAllPostMeta } from '@/lib/blog';
import { BLOG_CATEGORIES } from '@/lib/blog-categories';

const SITE = 'https://ulmadna.com';

// 사이트맵 — 홈 + 블로그 목록 + 모든 블로그 글 (구글 색인용)
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPostMeta();

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
    { url: `${SITE}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    // calc 허브 + 공정별 계산기 (2026-09-10: 바닥재 계산기 U 지시서 — 지금까지 사이트맵에 아예
    // 빠져 있었다. 도배·바닥재 계산기 페이지도 검색에 잡히게 여기서 함께 추가한다)
    { url: `${SITE}/calc`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/calc/wallpaper`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/calc/flooring`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
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
  ];
}
