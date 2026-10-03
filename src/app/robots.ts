import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 물어보기의 쓰기·내 질문·이름 정하기 화면은 검색에 넣을 내용이 없어서 뺀다 (2026년 10월 03일)
      disallow: ['/ask/new', '/ask/my', '/ask/nickname'],
    },
    sitemap: 'https://ulmadna.com/sitemap.xml',
  };
}
