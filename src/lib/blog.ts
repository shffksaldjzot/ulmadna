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
import { detectCategories, normalizeKo } from "./blog-categories";

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
  date: string; // YYYY-MM-DD (처음 발행한 날)
  // 시세·단가가 바뀌어 글을 손본 날 (주간 시세 갱신 봇이 프런트매터에 적어줌).
  // 아직 한 번도 안 고친 글은 null — 예전 글에는 아무 영향이 없습니다.
  updated: string | null;
  thumbnail: string | null;
  tags: string[];
  readingTime: number; // 예상 읽기 시간(분)
  // 비공개(초안) 글 여부 — 프런트매터에 `draft: true` 라고 적으면 켜집니다.
  // 켜지면: 블로그 목록·카테고리·검색·사이트맵·RSS 어디에도 안 나오고,
  //        검색엔진에도 수집하지 말라고(noindex) 표시됩니다.
  //        대신 주소(URL)를 직접 아는 사람은 그대로 볼 수 있어요 — 검토용 링크 공유가 목적입니다.
  // 프런트매터에 draft가 없는 기존 글은 전부 false(=평소대로 공개)라 아무 영향이 없습니다.
  draft: boolean;
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

// 파일 하나를 읽어 프런트매터(data)와 본문(content)을 같이 돌려줌
// (메타만 쓸 때도, 소제목까지 뽑을 때도 같은 함수를 쓰려고 분리)
function readRaw(file: string) {
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
  return matter(raw);
}

function readMeta(file: string): PostMeta {
  const slug = file.replace(/\.md$/, "");
  const { data, content } = readRaw(file);
  return {
    postNo: typeof data.postNo === "number" ? data.postNo : null,
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    updated: data.updated ?? null, // 프런트매터에 updated가 없으면 null
    thumbnail: data.thumbnail ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    readingTime: calcReadingTime(content),
    draft: data.draft === true, // 프런트매터에 draft: true 라고 적힌 글만 비공개 처리
  };
}

/**
 * 발행된 모든 글의 메타 (최신순)
 *
 * 비공개(draft: true) 글은 여기서 걸러집니다. 이 함수를 쓰는 곳이
 * 목록·카테고리·사이트맵·RSS라서, 한 군데서 거르면 전부 같이 숨겨집니다.
 * 검토용으로 비공개 글까지 다 봐야 할 때만 { includeDrafts: true } 로 부르세요.
 */
export function getAllPostMeta({ includeDrafts = false } = {}): PostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(readMeta)
    .filter((m) => includeDrafts || !m.draft) // 비공개 글 숨기기
    .sort((a, b) => {
      // 글 번호 큰 게(최신) 위로. 번호 없으면 날짜 최신순.
      if (a.postNo != null && b.postNo != null) return b.postNo - a.postNo;
      if (a.postNo != null) return -1;
      if (b.postNo != null) return 1;
      return a.date < b.date ? 1 : -1;
    });
}

/**
 * 목록 페이지용 "검색 색인" — 메타 + 카테고리 + 검색용 글자 덩어리
 *
 * 본문 전문은 절대 넣지 않습니다(65편 전문이면 수 MB라 페이지가 무거워짐).
 * 대신 제목·설명·태그·H2 소제목만 모아 한 줄로 붙이고, 띄어쓰기를 지운
 * "hay"를 빌드 때 미리 만들어 둡니다. 브라우저는 이걸 훑기만 하면 됩니다.
 */
export interface PostIndexItem extends PostMeta {
  cats: string[]; // 이 글이 속한 카테고리 id 목록
  hay: string; // 검색 대조용 (이미 정규화됨)
}

export function getAllPostIndex(): PostIndexItem[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  const items = files.map((file): PostIndexItem => {
    const meta = readMeta(file);
    const { content } = readRaw(file);
    // 마크다운 본문에서 H2(## 로 시작하는 줄)만 뽑음 = 글의 소제목들
    const headings = Array.from(content.matchAll(/^##\s+(.+)$/gm)).map((m) =>
      m[1].replace(/[*_`#]/g, "").trim()
    );
    const hay = normalizeKo(
      [meta.title, meta.description, meta.tags.join(" "), headings.join(" ")].join(" ")
    );
    return { ...meta, cats: detectCategories(meta.title, meta.tags), hay };
  })
  // 비공개(draft: true) 글은 목록·카테고리·검색 색인에서 제외합니다.
  .filter((item) => !item.draft);

  // 목록과 같은 순서(최신 글이 위)로 정렬
  return items.sort((a, b) => {
    if (a.postNo != null && b.postNo != null) return b.postNo - a.postNo;
    if (a.postNo != null) return -1;
    if (b.postNo != null) return 1;
    return a.date < b.date ? 1 : -1;
  });
}

/**
 * 정적 생성용 slug 목록
 *
 * 여기는 일부러 비공개(draft) 글도 포함합니다.
 * 페이지 자체는 만들어져 있어야 "주소를 아는 사람"이 열어볼 수 있기 때문입니다.
 * (목록에 안 뜨고 검색에도 안 걸릴 뿐, 링크를 받으면 볼 수 있는 상태)
 */
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

  // 스포일러 — <!-- spoiler:start --> ~ <!-- spoiler:end --> 구간을
  // "흐림 + 반짝이는 입자(스레드 느낌) + 탭하면 해제" 구조로 감쌈
  // (JS 없이 체크박스+CSS 토글, SEO 안전: 내용은 항상 DOM에 그대로 존재)
  // 입자는 빌드 타임에 위치·이동경로·속도를 랜덤으로 박아 넣음(스레드처럼 제각각 반짝)
  const rnd = (min: number, max: number) => min + Math.random() * (max - min);
  const buildSparkles = (n = 75) => {
    let out = "";
    for (let i = 0; i < n; i++) {
      const left = rnd(0, 100).toFixed(2); // 가로 위치 %
      const top = rnd(0, 100).toFixed(2); // 세로 위치 %
      const x0 = rnd(-6, 6).toFixed(1), y0 = rnd(-6, 6).toFixed(1); // 드리프트 시작 오프셋
      const x1 = rnd(-18, 18).toFixed(1), y1 = rnd(-18, 18).toFixed(1); // 드리프트 끝 오프셋
      const s = rnd(0.5, 1.5).toFixed(2); // 입자 크기 배율
      const drift = rnd(8, 28).toFixed(1); // 떠다니는 주기(초)
      const tw = rnd(0.6, 1.4).toFixed(2); // 깜빡임 주기(초)
      const dDelay = rnd(-28, 0).toFixed(1); // 음수 지연으로 위상 분산
      const tDelay = rnd(-1.4, 0).toFixed(2);
      out +=
        `<span class="blog-spoiler-spark" style="left:${left}%;top:${top}%;` +
        `--x0:${x0}px;--y0:${y0}px;--x1:${x1}px;--y1:${y1}px;--s:${s};` +
        `animation-duration:${drift}s,${tw}s;animation-delay:${dDelay}s,${tDelay}s;"></span>`;
    }
    return out;
  };

  let spoilerSeq = 0;
  html = html.replace(
    /(?:<p>\s*)?<!--\s*spoiler:start\s*-->(?:\s*<\/p>)?([\s\S]*?)(?:<p>\s*)?<!--\s*spoiler:end\s*-->(?:\s*<\/p>)?/g,
    (_m, inner) => {
      const id = `blog-spoiler-${spoilerSeq++}`;
      return (
        `<div class="blog-spoiler">` +
        `<input type="checkbox" id="${id}" class="blog-spoiler-cb" />` +
        `<div class="blog-spoiler-inner">${inner}</div>` +
        `<label for="${id}" class="blog-spoiler-cover" role="button" tabindex="0" aria-label="단가표 보기">` +
        `<span class="blog-spoiler-sparkles" aria-hidden="true">${buildSparkles()}</span>` +
        `<span class="blog-spoiler-hint">👆 탭하면 단가표가 보여요</span>` +
        `<span class="blog-spoiler-sub">실제 업체 견적 단가표 · 스포일러</span>` +
        `</label></div>`
      );
    }
  );

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
    updated: data.updated ?? null, // 시세 갱신 봇이 적어주는 "마지막 손본 날"
    thumbnail: data.thumbnail ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    draft: data.draft === true, // 비공개(검토용) 글이면 상세 페이지에서 noindex 처리
    html,
    faq,
    headings,
    readingTime,
  };
}
