// ──────────────────────────────────────────────
// 블로그 글 추천 — "같은 공정 비용 글" 고르기 + 본문 중간 관련 글 1개 끼워 넣기
//
// [왜 만들었나 — 조회수 확대 전략 E (2026년 10월 27일 형아 승인)]
//   한 사람이 글 하나만 읽고 나가는 패턴(세션당 1.7페이지)을 줄이려고,
//   ① 글 끝 "이어서 볼 만한 글"을 "같은 공정의 비용 글 2~3개 + 계산기 1개"로 고정하고
//   ② 본문 중간(가운데 소제목 앞)에 같은 공정 글 중 조회수 1위 글 링크 1개를 자동으로 넣는다.
//   ②는 글 파일(md)을 건드리지 않고 화면을 그릴 때(렌더 시)만 끼워 넣는다.
//
// [같은 공정 판정]
//   카테고리 8종(lib/blog-categories.ts)은 너무 넓어서("비용·견적"에 수십 편) 그것만으로는
//   공정이 같은지 알 수 없다. 그래서 세 가지를 같이 본다.
//     1) 태그가 똑같은 게 있나          × 3점 (가장 확실)
//     2) 제목의 핵심 낱말이 겹치나      × 2점 ("방충망", "수전", "붙박이장" 같은 말)
//     3) 넓은 카테고리 중 공정 카테고리가 겹치나 × 1점 (비용·계약·준비 같은 일반 묶음은 제외)
//   1) 또는 2)가 하나라도 있어야 "같은 공정"으로 본다(3만으로는 너무 넓다).
// ──────────────────────────────────────────────

import { detectCategories } from "./blog-categories";
import { BLOG_VIEWS_28D } from "./blog-popular";
import type { PostMeta } from "./blog";

/** 공정이 아니라 "돈·계약·준비" 같은 일반 묶음이라 같은 공정 판정에서 빼는 카테고리 */
const GENERIC_CATS = new Set(["cost", "contract", "prep"]);

/** 비용 글 판정 — 제목에 돈 이야기가 있으면 비용 글로 본다 */
const COST_TITLE_RE = /비용|가격|단가|견적|시세|일당|얼마/;

/**
 * 제목 낱말 비교에서 빼는 흔한 말 — 어느 글에나 들어가서 "같은 공정" 신호가 못 되는 말들.
 * (설치·교체·시공 같은 동작 말도 뺀다. "방충망 교체"와 "변기 교체"는 공정이 다르다)
 */
const STOP_WORDS = new Set([
  "비용", "가격", "단가", "견적", "시세", "일당", "얼마", "얼마나", "총정리", "정리", "공개", "실제",
  "기준", "방법", "후기", "추천", "비교", "가이드", "종류", "종류별", "차이", "장단점", "고르는",
  "고르는법", "체크리스트", "주의", "주의사항", "실패", "후회", "사례", "포인트", "꿀팁", "한눈에",
  "아파트", "인테리어", "리모델링", "우리집", "공사", "시공", "설치", "교체", "수리", "제작",
  "셀프", "업체", "평형별", "항목별", "등급별", "부분", "전체", "가격표", "단가표", "비용표",
  "까지", "부터", "이유", "진실", "함정", "확인", "할", "것", "전", "후", "vs",
]);

/** 낱말 끝에 붙은 조사를 떼어낸다(3글자 이상 낱말만 — 짧은 말은 조사처럼 보여도 본디 말일 수 있음) */
function stripJosa(w: string): string {
  if (w.length < 3) return w;
  return w.replace(/(으로|에서|까지|부터|은|는|이|가|을|를|의|에|로|와|과|도|만)$/, "");
}

/** 제목을 핵심 낱말 묶음으로 바꾼다(숫자·평형·흔한 말 제외) */
export function titleWords(title: string): Set<string> {
  // 부제(— 뒤, 괄호 안)는 빼고 주제부만 본다 — 부제엔 비교 대상 공정 이름이 섞여 오판이 잦다
  const main = title.split(/\s[—–-]\s|[(\[]/)[0] ?? title;
  const words = main
    .toLowerCase()
    .split(/[\s·・,./!?:;'"“”‘’()[\]{}~—–-]+/)
    .map(stripJosa)
    .filter((w) => w.length >= 2 && !/^\d/.test(w) && !STOP_WORDS.has(w));
  return new Set(words);
}

/** 이 글이 비용 글인가 */
export function isCostPost(p: Pick<PostMeta, "title">): boolean {
  return COST_TITLE_RE.test(p.title);
}

/** 후보 글 하나와 기준 글의 "같은 공정" 점수 정보 */
export interface ProcessMatch {
  p: PostMeta;
  sharedTags: number;
  sharedWords: number;
  sharedProcCats: number;
  /** 같은 공정인가(태그나 제목 낱말이 하나라도 겹침) */
  sameProcess: boolean;
  score: number;
  cats: string[];
}

/**
 * 기준 글(post)과 같은 공정인 글들을 점수 순으로 돌려준다(자기 자신·exclude 제외).
 * 점수가 같으면 최근 글이 먼저.
 */
export function rankSameProcess(post: PostMeta, all: PostMeta[], exclude: Set<string> = new Set()): ProcessMatch[] {
  const myWords = titleWords(post.title);
  const myProcCats = detectCategories(post.title, post.tags).filter((c) => !GENERIC_CATS.has(c));
  return all
    .filter((p) => p.slug !== post.slug && !exclude.has(p.slug))
    .map((p) => {
      // "84타입"·"34평"처럼 숫자로 시작하는 평형 태그는 어느 공정 글에나 붙어서 같은 공정 신호가 못 된다 → 뺀다
      const sharedTags = p.tags.filter((t) => !/^\d/.test(t) && post.tags.includes(t)).length;
      const words = titleWords(p.title);
      let sharedWords = 0;
      // 같은 낱말이거나 한쪽이 다른 쪽을 품고 있으면 겹친 것으로 본다("커튼" ↔ "암막커튼", "도배" ↔ "부분도배")
      for (const w of words) {
        if (myWords.has(w) || [...myWords].some((m) => m.includes(w) || w.includes(m))) sharedWords++;
      }
      const cats = detectCategories(p.title, p.tags);
      const sharedProcCats = cats.filter((c) => !GENERIC_CATS.has(c) && myProcCats.includes(c)).length;
      const sameProcess = sharedTags > 0 || sharedWords > 0;
      return { p, cats, sharedTags, sharedWords, sharedProcCats, sameProcess, score: sharedTags * 3 + sharedWords * 2 + sharedProcCats };
    })
    .filter((m) => m.sameProcess)
    .sort((a, b) => b.score - a.score || (a.p.date < b.p.date ? 1 : -1));
}

/**
 * 글 끝 "이어서 볼 만한 글" 후보 — 같은 공정의 비용 글을 먼저, 모자라면 같은 공정의 다른 글로 채운다.
 * 화면엔 이 중 "이미 본 글"을 뺀 앞 3편만 나온다(ReadMoreAtEnd 가 브라우저에서 거름).
 */
export function pickSameProcessCostPosts(post: PostMeta, all: PostMeta[], exclude: Set<string>, limit = 8): ProcessMatch[] {
  const ranked = rankSameProcess(post, all, exclude);
  const cost = ranked.filter((m) => isCostPost(m.p));
  const rest = ranked.filter((m) => !isCostPost(m.p));
  return [...cost, ...rest].slice(0, limit);
}

/**
 * 본문 중간에 끼워 넣을 관련 글 1편 — 같은 공정 글 중 최근 28일 조회수 1위.
 * 조회수가 없으면(0) 같은 공정 점수 1위. 같은 공정 글이 없으면 null.
 */
export function pickInlineRelated(post: PostMeta, all: PostMeta[], exclude: Set<string>): PostMeta | null {
  const ranked = rankSameProcess(post, all, exclude);
  if (ranked.length === 0) return null;
  // 같은 공정 점수 상위 5편 안에서만 조회수 1위를 고른다 — 겹침이 약한 글(태그 하나만 스친 글 등)이
  // 조회수가 높다는 이유만으로 뽑히면 엉뚱한 공정 글이 본문에 끼어든다(시험 중 전기 글에 커튼 글이 뽑힌 사례)
  const pool = ranked.slice(0, 5);
  const best = [...pool].sort(
    (a, b) => (BLOG_VIEWS_28D[b.p.slug] ?? 0) - (BLOG_VIEWS_28D[a.p.slug] ?? 0) || b.score - a.score
  )[0];
  return best ? best.p : null;
}

/** html 특수문자 막기(제목을 html 안에 직접 넣을 때) */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * 본문 html 의 가운데 소제목(h2) 바로 앞에 관련 글 링크 1개를 넣는다.
 *   - 소제목이 3개 미만인 짧은 글은 넣지 않는다(본문이 짧으면 오히려 흐름을 끊는다).
 *   - 스포일러(탭해야 보이는 단가표) 상자 안에 있는 소제목 앞은 피한다 — 가려져서 안 보이므로.
 *   - 클릭 추적은 data-inline-related 표시를 보고 InlineRelatedTracker 가 처리한다.
 */
export function insertInlineRelated(html: string, headingCount: number, target: PostMeta, category: string): string {
  if (headingCount < 3) return html;
  const mid = Math.floor(headingCount / 2);
  const block =
    `<aside class="blog-inline-related">` +
    `<a href="/blog/${target.slug}" data-inline-related="${escapeHtml(category || "none")}">${escapeHtml(target.title)}</a>` +
    `</aside>`;
  // 가운데 소제목부터 뒤로 가면서 "스포일러 상자 밖"인 첫 소제목을 찾는다
  for (let k = mid; k < headingCount; k++) {
    const marker = `<h2 id="h-${k}">`;
    const pos = html.indexOf(marker);
    if (pos < 0) continue;
    const before = html.slice(0, pos);
    const opened = before.split('<div class="blog-spoiler">').length - 1; // 열린 스포일러 상자 수
    const closed = before.split("</label></div>").length - 1; // 닫힌 스포일러 상자 수(상자 끝 표식)
    if (opened !== closed) continue; // 아직 상자 안 → 다음 소제목으로
    return html.slice(0, pos) + block + html.slice(pos);
  }
  return html;
}
