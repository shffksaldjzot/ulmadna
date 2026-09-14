// ──────────────────────────────────────────────
// "내 글" 저장소 — 로그인 없이 이 브라우저(localStorage)에만 남는 개인 기록
//
// [무엇을 저장하나] 3가지 목록을 각각 다른 키로 저장한다.
//   ulmadna:viewed → 최근 본 글 (최대 30개, 최신이 배열 맨 앞)
//   ulmadna:saved  → 저장(북마크)한 글 (개수 제한 없음)
//   ulmadna:liked  → 좋아요 누른 글 (개수 제한 없음, "내가 눌렀다"는 표시만.
//                     실제 좋아요 숫자는 서버(Upstash)가 따로 센다 — src/server/metrics/blogLike.ts)
//
// [안전장치] 시크릿모드·쿠키 차단 등으로 localStorage를 아예 못 쓰는 브라우저도 있어서
// 모든 함수가 try/catch로 감싸져 있고, 실패해도 화면이 죽지 않고 그냥 "기록 없음"으로 보인다.
//
// [같은 페이지 안에서 즉시 갱신] 글 위·글 끝에 똑같은 저장/좋아요 버튼이 두 번 나오는데,
// 하나를 누르면 다른 하나도 바로 바뀌어야 한다. localStorage는 "바뀌었다"는 신호를 자동으로
// 안 주기 때문에, 값을 바꿀 때마다 커스텀 이벤트(ulmadna:blog-my-change)를 직접 쏴 준다.
// 같은 탭 안의 다른 컴포넌트들은 subscribeMyChange로 이 신호를 듣고 자기 상태를 다시 읽는다.
//
// [다른 기기로 옮기기] exportToLink/importFromLink — 저장·좋아요 목록의 slug만 뽑아
// base64url로 짧게 인코딩해 "/blog/my?d=..." 링크를 만든다. 그 링크를 다른 기기에서 열면
// 그 기기의 기존 기록에 "합쳐진다"(덮어쓰지 않음, 이미 있는 건 건너뜀).
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

/** 목록 항목 하나 — 어떤 글(slug)을 언제(at, 밀리초) 기록했는지 */
export interface MyItem {
  slug: string;
  at: number;
}

const KEY_VIEWED = "ulmadna:viewed";
const KEY_SAVED = "ulmadna:saved";
const KEY_LIKED = "ulmadna:liked";

// 다른 컴포넌트에 "목록이 바뀌었다"고 알리는 브라우저 커스텀 이벤트 이름
const CHANGE_EVENT = "ulmadna:blog-my-change";

// "최근 본 글"은 무한정 쌓이면 localStorage가 지저분해지므로 30개까지만 남긴다
const MAX_VIEWED = 30;

/** localStorage에서 목록 하나를 안전하게 읽는다 — 실패하면 빈 배열 */
function safeGet(key: string): MyItem[] {
  if (typeof window === "undefined") return []; // 서버 렌더링 중에는 localStorage 자체가 없음
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 저장된 형태가 망가져 있을 수도 있으니(수동 편집 등) 모양이 맞는 항목만 통과시킨다
    return parsed.filter(
      (x): x is MyItem => !!x && typeof x.slug === "string" && typeof x.at === "number"
    );
  } catch {
    return []; // localStorage 접근 자체가 막힌 환경(시크릿모드 등)이면 조용히 빈 목록
  }
}

/** localStorage에 목록 하나를 안전하게 쓰고, "바뀌었다" 이벤트를 쏜다 */
function safeSet(key: string, items: MyItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  } catch {
    // 용량 초과·쓰기 차단 등으로 실패해도 화면 기능에는 영향 없게 조용히 무시
  }
}

// ── 읽기 ──────────────────────────────────────
export function getViewed(): MyItem[] {
  return safeGet(KEY_VIEWED);
}
export function getSaved(): MyItem[] {
  return safeGet(KEY_SAVED);
}
export function getLiked(): MyItem[] {
  return safeGet(KEY_LIKED);
}

export function isSaved(slug: string): boolean {
  return getSaved().some((i) => i.slug === slug);
}
export function isLiked(slug: string): boolean {
  return getLiked().some((i) => i.slug === slug);
}

// ── 쓰기 ──────────────────────────────────────

/** 글을 하나 읽었다고 기록한다. 이미 있던 글이면 맨 앞(최신)으로 옮긴다 */
export function addViewed(slug: string): void {
  if (typeof window === "undefined" || !slug) return;
  const cur = getViewed().filter((i) => i.slug !== slug); // 중복 제거(있으면 빼고 새로 맨 앞에)
  cur.unshift({ slug, at: Date.now() });
  safeSet(KEY_VIEWED, cur.slice(0, MAX_VIEWED)); // 30개까지만 유지
}

/** 저장(북마크) 켜고/끄고 토글. 바뀐 뒤 상태(true=저장됨)를 돌려준다 */
export function toggleSaved(slug: string): boolean {
  if (typeof window === "undefined" || !slug) return false;
  const cur = getSaved();
  const exists = cur.some((i) => i.slug === slug);
  if (exists) {
    safeSet(KEY_SAVED, cur.filter((i) => i.slug !== slug));
    return false;
  }
  safeSet(KEY_SAVED, [{ slug, at: Date.now() }, ...cur]);
  return true;
}

/** 좋아요(내가 눌렀다는 로컬 표시) 켜고/끄고 토글. 바뀐 뒤 상태를 돌려준다 */
export function toggleLiked(slug: string): boolean {
  if (typeof window === "undefined" || !slug) return false;
  const cur = getLiked();
  const exists = cur.some((i) => i.slug === slug);
  if (exists) {
    safeSet(KEY_LIKED, cur.filter((i) => i.slug !== slug));
    return false;
  }
  safeSet(KEY_LIKED, [{ slug, at: Date.now() }, ...cur]);
  return true;
}

/** 목록에서 항목 하나를 지운다 (내 글 페이지의 "x" 버튼용) */
export function removeViewed(slug: string): void {
  safeSet(KEY_VIEWED, getViewed().filter((i) => i.slug !== slug));
}
export function removeSaved(slug: string): void {
  safeSet(KEY_SAVED, getSaved().filter((i) => i.slug !== slug));
}
export function removeLiked(slug: string): void {
  safeSet(KEY_LIKED, getLiked().filter((i) => i.slug !== slug));
}

/** 이 탭에서 내 글 목록이 바뀔 때마다 cb를 부른다. 구독 해제 함수를 돌려준다 */
export function subscribeMyChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

// ── 링크로 내보내기/가져오기 ───────────────────

/** 일반 문자열 → URL에 넣어도 안전한 base64(base64url) */
function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** base64url → 원래 문자열 */
function fromBase64Url(s: string): string {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "="; // 잘려나간 padding(=) 복구
  return atob(b);
}

/**
 * 저장·좋아요 목록을 짧은 링크로 만든다 ("/blog/my?d=..." 형태).
 * 이 링크를 다른 기기(브라우저)에서 열면 importFromLink가 그 기기 기록에 합쳐준다.
 * 제목·날짜 등은 안 넣고 slug만 담아 링크 길이를 최대한 짧게 유지한다.
 */
export function exportToLink(): string {
  if (typeof window === "undefined") return "";
  const s = getSaved().map((i) => i.slug);
  const l = getLiked().map((i) => i.slug);
  const encoded = toBase64Url(JSON.stringify({ s, l }));
  return `${window.location.origin}/blog/my?d=${encoded}`;
}

// 링크(?d=)로 들어오는 값은 남이 만들어서 보낸 것일 수도 있으므로(다른 기기·주소 조작 등)
// 안전선을 둔다 — 검사관 지적(2026-09-15) 반영.
const MAX_IMPORT_LINK_LEN = 8 * 1024; // d 값 자체가 8KB를 넘으면 통째로 거절(디코딩도 안 함)
const MAX_IMPORT_ITEMS = 200; // 저장·좋아요 각각 최대 200개까지만 받아들임

/**
 * exportToLink로 만든 "d" 값을 읽어 이 브라우저의 저장·좋아요 목록에 합친다.
 * 이미 있는 slug는 건너뛰고(중복 방지), 새로 들어온 것만 맨 앞에 추가한다.
 * @returns 새로 추가된 개수. 링크가 망가졌거나 비정상적으로 크면 null
 */
export function importFromLink(d: string): { savedAdded: number; likedAdded: number } | null {
  if (typeof window === "undefined" || !d) return null;
  if (d.length > MAX_IMPORT_LINK_LEN) return null; // 지나치게 긴 값은 디코딩 전에 바로 거절
  try {
    const parsed = JSON.parse(fromBase64Url(d));
    const incomingSaved: string[] = Array.isArray(parsed?.s)
      ? parsed.s.filter((x: unknown): x is string => typeof x === "string").slice(0, MAX_IMPORT_ITEMS)
      : [];
    const incomingLiked: string[] = Array.isArray(parsed?.l)
      ? parsed.l.filter((x: unknown): x is string => typeof x === "string").slice(0, MAX_IMPORT_ITEMS)
      : [];

    const now = Date.now();

    const curSaved = getSaved();
    const savedSlugs = new Set(curSaved.map((i) => i.slug));
    const newSaved = [...curSaved];
    let savedAdded = 0;
    for (const slug of incomingSaved) {
      if (!savedSlugs.has(slug)) {
        newSaved.unshift({ slug, at: now });
        savedSlugs.add(slug);
        savedAdded++;
      }
    }

    const curLiked = getLiked();
    const likedSlugs = new Set(curLiked.map((i) => i.slug));
    const newLiked = [...curLiked];
    let likedAdded = 0;
    for (const slug of incomingLiked) {
      if (!likedSlugs.has(slug)) {
        newLiked.unshift({ slug, at: now });
        likedSlugs.add(slug);
        likedAdded++;
      }
    }

    if (savedAdded > 0) safeSet(KEY_SAVED, newSaved);
    if (likedAdded > 0) safeSet(KEY_LIKED, newLiked);

    return { savedAdded, likedAdded };
  } catch {
    return null; // 링크가 손상됐거나 형식이 다르면 조용히 실패
  }
}
