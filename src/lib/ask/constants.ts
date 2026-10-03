// ──────────────────────────────────────────────
// 물어보기 게시판 — 화면·서버가 같이 쓰는 고정값과 자료 모양
//
// 브라우저(질문하기 화면)와 서버(API·목록 화면) 양쪽에서 불러 쓰므로
// 비밀 열쇠나 서버 전용 코드는 절대 여기 넣지 않는다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

/**
 * 말머리(카테고리) — 네이버 카페식 [말머리] 제목 (형아 지시 2026년 10월 03일)
 * 여기 한 줄만 더하면 글쓰기 칩·목록 필터·제목 표시·API 검사가 전부 따라온다.
 * key는 DB(ask_posts.category)에 저장되는 값이라 한 번 정하면 바꾸지 않는다(라벨은 바꿔도 됨).
 */
export const ASK_CATEGORIES = [
  { key: 'estimate', label: '견적서 봐주세요' },
  { key: 'cost', label: '비용 질문' },
  { key: 'howto', label: '시공 질문' },
  { key: 'material', label: '자재·제품' },
  { key: 'defect', label: '하자·AS' },
  { key: 'etc', label: '기타' },
] as const;
export type AskCategory = (typeof ASK_CATEGORIES)[number]['key'];

/** 들어온 값이 말머리 key면 그대로, 아니면 null */
export function normalizeCategory(v: unknown): AskCategory | null {
  return ASK_CATEGORIES.some((c) => c.key === v) ? (v as AskCategory) : null;
}

/** 말머리 key → 화면 이름(모르는 값이면 "기타") */
export function categoryLabel(key: string | null | undefined): string {
  return ASK_CATEGORIES.find((c) => c.key === key)?.label ?? '기타';
}

/** "[말머리] 제목" 표기 — 목록 카드·상세·<title>·OG 공용 */
export function titleWithCategory(category: string | null | undefined, title: string): string {
  return `[${categoryLabel(category)}] ${title}`;
}

/**
 * 옛 종류 칸(kind) — DB check 제약이 estimate|cost 둘뿐이라 호환용으로만 같이 저장한다.
 * 집컴 답변기·씨앗 스크립트가 아직 kind를 읽으므로 없애지 않는다.
 */
export type AskKind = 'estimate' | 'cost';
export const KIND_LABEL: Record<AskKind, string> = {
  estimate: '견적서 봐주세요',
  cost: '비용 질문',
};
/** 말머리 → 옛 kind(견적서 봐주세요면 estimate, 나머지는 cost) */
export function kindFromCategory(c: AskCategory): AskKind {
  return c === 'estimate' ? 'estimate' : 'cost';
}

/** 질문하기 화면의 공정 칩 9개 (시안 new.html 그대로) */
export const TRADES = ['도배', '바닥', '욕실', '주방', '샷시', '전기 · 조명', '목공 · 문', '미장 · 방수', '전체 올수리'] as const;

/** 목록 화면 칩에 보여 줄 공정 8개 (전체·종류 2개 다음에 붙는다) */
export const LIST_TRADES = ['도배', '바닥', '욕실', '주방', '샷시', '미장 · 방수', '전기 · 조명', '전체 올수리'] as const;

/** 평형 고르기 — 평수와 타입(전용면적) 짝. "직접 입력"은 화면에서 따로 처리 */
export const PYEONG_OPTIONS: { pyeong: number; type: string }[] = [
  { pyeong: 18, type: '49' },
  { pyeong: 24, type: '59' },
  { pyeong: 30, type: '74' },
  { pyeong: 34, type: '84' },
  { pyeong: 43, type: '114' },
];

/** 지역 고르기 */
export const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충청', '전라', '경상', '제주', '그 외'] as const;

/** 공정 → 관련 계산기 주소 (지금 열려 있는 계산기 3개만) */
export const TRADE_CALC: Record<string, { label: string; href: string }> = {
  도배: { label: '도배 견적서', href: '/calc/wallpaper' },
  바닥: { label: '바닥재 견적서', href: '/calc/flooring' },
  '미장 · 방수': { label: '미장 견적서', href: '/calc/mortar' },
};

/**
 * 하루 질문·댓글 제한 (형아 결정 2026년 10월 03일, 한국 시간 자정 기준)
 *   ASK_DAILY_GLOBAL            = 사이트 전체 하루 질문 10개 선착순
 *   ASK_DAILY_PER_USER          = 회원 한 명당 하루 질문(원글) 1개
 *   ASK_DAILY_COMMENTS_PER_USER = 회원 한 명당 하루 댓글 3개(글당이 아니라 하루 합계)
 * 숫자를 바꾸려면 여기만 고치면 서버 검사·화면 안내가 같이 바뀐다.
 */
export const ASK_DAILY_GLOBAL = 10;
export const ASK_DAILY_PER_USER = 1;
export const ASK_DAILY_COMMENTS_PER_USER = 3;

/** 제한값 — 서버 검사와 화면 안내가 같은 숫자를 쓰게 한 곳에 둔다 */
export const LIMITS = {
  titleMax: 60,
  titleMin: 5,
  bodyMax: 3000,
  photosMax: 5,
  photoBytes: 10 * 1024 * 1024, // 10MB
  postsPerDay: 1, // = ASK_DAILY_PER_USER (옛 이름 호환)
  commentMax: 1000,
  nickMin: 2,
  nickMax: 12,
  pageSize: 20,
};

/** 사진 올리기에 허용하는 형식 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

/** 사진 한 장의 저장 모양 — raw=비공개 원본 경로, masked=가린 공개 사본 경로(아직이면 null) */
export interface AskPhoto {
  raw: string;
  masked: string | null;
}

/** 목록 카드 한 장에 필요한 값 */
export interface AskListItem {
  id: number;
  slug: string;
  nickname: string;
  kind: AskKind;
  category: AskCategory; // 말머리(정본). 표 칸이 아직 없으면 kind로 채운다
  title: string;
  trades: string[];
  status: 'queued' | 'answered' | 'hidden';
  comment_count: number;
  view_count: number;
  created_at: string;
  photoCount: number;
  summary: string | null; // AI 답변 한 줄(답변 전이면 null)
}

/**
 * "오늘 기준 빅데이터 견적서" 숫자 묶음 — ask_stats(key='global').data 와 칸 이름이 똑같다.
 * 집컴 build-stats.mjs 가 밤마다 넣는 모양: {"real": 470, "shown": 1470, "delta": 24, "updated": "2026.10.03"}
 *   real    = 실제 견적서 수(화면에 안 보임)
 *   shown   = 화면에 보이는 수(실제 + 1,000, 사장님 확정 규칙)
 *   delta   = 어제 대비 증감
 *   updated = 갱신일("2026.10.03" 점 표기)
 */
export interface AskStats {
  shown: number; // 화면에 보이는 수(실제 + 1,000)
  delta: number | null; // 어제 대비 증감
  updated: string | null; // 갱신일 "2026.10.03"
}

/** 근거 묶음(ask_answers.basis) 중 화면이 읽는 칸 */
export interface AskBasis {
  n?: number;
  period?: string;
  region?: string;
  calcs?: { label: string; href: string }[];
  posts?: { title: string; slug: string }[];
}
