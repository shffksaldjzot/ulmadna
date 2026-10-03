// ──────────────────────────────────────────────
// 물어보기 — "저장한 질문" 목록 (이 브라우저에만 보관)
//
// 로그인 없이도 저장할 수 있게 브라우저 저장소(localStorage)에 둔다.
// 사생활 보호 창 등에서 저장소가 막혀 있어도 화면이 깨지지 않게 전부 try/catch.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

const KEY = 'ulm_ask_saved';

export interface SavedAsk {
  slug: string;
  title: string;
  at: number; // 저장한 시각(밀리초)
}

/** 저장 목록 읽기(최근 저장한 것이 앞) */
export function readSaved(): SavedAsk[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as SavedAsk[]) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x.slug === 'string') : [];
  } catch {
    return [];
  }
}

/** 저장돼 있는지 */
export function isSaved(slug: string): boolean {
  return readSaved().some((x) => x.slug === slug);
}

/** 저장 켜기/끄기 — 바뀐 뒤 상태(true=저장됨)를 돌려준다 */
export function toggleSaved(slug: string, title: string): boolean {
  const list = readSaved();
  const has = list.some((x) => x.slug === slug);
  const nextList = has ? list.filter((x) => x.slug !== slug) : [{ slug, title, at: Date.now() }, ...list].slice(0, 200);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(nextList));
  } catch {
    /* 저장소가 막혀 있으면 조용히 넘어감 */
  }
  return !has;
}
