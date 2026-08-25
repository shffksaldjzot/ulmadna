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
    // 카테고리 허브 8장 — 주제별 모음 페이지 (글 목록 다음으로 중요한 색인 대상)
    ...BLOG_CATEGORIES.map((c) => ({
      url: `${SITE}/blog/category/${c.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // 블로그 글 각각 (발행일을 lastModified로)
    ...posts.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.date ? new Date(p.date) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
