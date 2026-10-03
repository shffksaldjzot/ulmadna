// ──────────────────────────────────────────────
// 물어보기 ↔ 블로그 연결 도우미 (서버 전용)
//
// - 블로그 글 주소 → 제목 (질문하기 화면 "이 글을 보다가 왔어요" 칩, 질문 상세 "기다리는 동안")
// - 공정 이름 → 관련 블로그 글 몇 편 (답변 준비 중 화면에서 읽을거리)
// 블로그 글 파일을 읽는 lib/blog.ts 를 그대로 쓴다. 실패하면 조용히 빈 값.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import 'server-only';
import { getAllPostMeta, type PostMeta } from '@/lib/blog';

/** 블로그 글 목록(실패하면 빈 목록) */
function allMeta(): PostMeta[] {
  try {
    return getAllPostMeta();
  } catch {
    return [];
  }
}

/** 블로그 글 주소 → 제목·읽는 시간, 없으면 null */
export function blogPostRef(slug: string | null): { slug: string; title: string; readingTime: number } | null {
  if (!slug) return null;
  const m = allMeta().find((p) => p.slug === slug);
  return m ? { slug: m.slug, title: m.title, readingTime: m.readingTime } : null;
}

/**
 * 공정 이름들 → 제목·태그에 그 낱말이 든 블로그 글(최신순) 몇 편.
 * "미장 · 방수" 처럼 묶인 이름은 낱말로 쪼개서 찾는다. "전체 올수리"는 "올수리"로.
 */
export function blogPostsForTrades(trades: string[], limit = 2, excludeSlug?: string | null): { slug: string; title: string; readingTime: number }[] {
  const words = trades
    .flatMap((t) => t.split('·').map((w) => w.trim()))
    .map((w) => (w === '전체 올수리' ? '올수리' : w))
    .filter((w) => w.length >= 2);
  if (words.length === 0) return [];
  return allMeta()
    .filter((p) => p.slug !== excludeSlug && words.some((w) => p.title.includes(w) || p.tags.some((t) => t.includes(w))))
    .slice(0, limit)
    .map((p) => ({ slug: p.slug, title: p.title, readingTime: p.readingTime }));
}
