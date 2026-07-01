import type { MetadataRoute } from 'next';
import { getAllPostMeta } from '@/lib/blog';

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
    // 블로그 글 각각 (발행일을 lastModified로)
    ...posts.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.date ? new Date(p.date) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
