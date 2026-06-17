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
}

export interface Post extends PostMeta {
  html: string;
  faq: FaqItem[];
}

function readMeta(file: string): PostMeta {
  const slug = file.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
  const { data } = matter(raw);
  return {
    postNo: typeof data.postNo === "number" ? data.postNo : null,
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    thumbnail: data.thumbnail ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

/** 발행된 모든 글의 메타 (최신순) */
export function getAllPostMeta(): PostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(readMeta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
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

  // 표는 모바일 가로 스크롤을 위해 래퍼로 감싼다
  const html = String(processed)
    .replace(/<table>/g, '<div class="blog-table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");

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
  };
}
