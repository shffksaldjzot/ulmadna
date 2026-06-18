// ──────────────────────────────────────────────
// 블로그 — 마크다운(.md) 파일 로더 + 렌더러
// content/blog/*.md 를 읽어 프런트매터 + HTML로 변환
// 발행 워크플로: content/blog/ 에 .md 추가 → 자동 노출
// ──────────────────────────────────────────────

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface FaqItem {
  q: string;
  a: string;
}

export interface PostMeta {
  postNo: number | null; // 글 번호 (텔레그램에서 "N번 글" 지칭용)
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  thumbnail: string | null;
  tags: string[];
  readingTime: number; // 예상 읽기 시간(분)
}

export interface Heading {
  id: string;
  text: string;
}

export interface Post extends PostMeta {
  html: string;
  faq: FaqItem[];
  headings: Heading[]; // 목차(H2)
}

// 읽기 시간(분) — 공백 제외 글자수 / 450자
const calcReadingTime = (content: string) =>
  Math.max(1, Math.round(content.replace(/\s+/g, "").length / 450));

function readMeta(file: string): PostMeta {
  const slug = file.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
  const { data, content } = matter(raw);
  return {
    postNo: typeof data.postNo === "number" ? data.postNo : null,
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    thumbnail: data.thumbnail ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    readingTime: calcReadingTime(content),
  };
}

/** 발행된 모든 글의 메타 (최신순) */
export function getAllPostMeta(): PostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(readMeta)
    .sort((a, b) => {
      // 글 번호 큰 게(최신) 위로. 번호 없으면 날짜 최신순.
      if (a.postNo != null && b.postNo != null) return b.postNo - a.postNo;
      if (a.postNo != null) return -1;
      if (b.postNo != null) return 1;
      return a.date < b.date ? 1 : -1;
    });
}

/** 정적 생성용 slug 목록 */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

/** 글 하나 — 본문 HTML 포함 */
export async function getPost(slug: string): Promise<Post | null> {
  const fp = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(fp)) return null;
  const raw = fs.readFileSync(fp, "utf8");
  const { data, content } = matter(raw);

  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(content);

  // H2에 id 부여 + 목차 수집 (앵커용, 인덱스 기반 안정 id)
  const headings: Heading[] = [];
  let html = String(processed).replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, "").trim();
    const id = `h-${headings.length}`;
    headings.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });

  // 표는 모바일 가로 스크롤 래퍼 + 외부 링크는 새 탭(이탈 방지)
  html = html
    .replace(/<table>/g, '<div class="blog-table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>")
    .replace(/<a href="(https?:\/\/[^"]*)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

  const readingTime = calcReadingTime(content);

  const faq: FaqItem[] = Array.isArray(data.faq)
    ? data.faq
        .filter((f: unknown): f is FaqItem => !!f && typeof (f as FaqItem).q === "string")
        .map((f: FaqItem) => ({ q: f.q, a: f.a }))
    : [];

  return {
    postNo: typeof data.postNo === "number" ? data.postNo : null,
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    thumbnail: data.thumbnail ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    html,
    faq,
    headings,
    readingTime,
  };
}
