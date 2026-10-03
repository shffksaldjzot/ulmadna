// ──────────────────────────────────────────────
// 물어보기 게시판 — 화면·서버가 같이 쓰는 고정값과 자료 모양
//
// 브라우저(질문하기 화면)와 서버(API·목록 화면) 양쪽에서 불러 쓰므로
// 비밀 열쇠나 서버 전용 코드는 절대 여기 넣지 않는다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

/** 질문 종류 — DB 값과 화면 이름 */
export type AskKind = 'estimate' | 'cost';
export const KIND_LABEL: Record<AskKind, string> = {
  estimate: '견적서 봐주세요',
  cost: '비용 질문',
};

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

/** 제한값 — 서버 검사와 화면 안내가 같은 숫자를 쓰게 한 곳에 둔다 */
export const LIMITS = {
  titleMax: 60,
  titleMin: 5,
  bodyMax: 3000,
  photosMax: 5,
  photoBytes: 10 * 1024 * 1024, // 10MB
  postsPerDay: 3,
  commentsPerDayPerPost: 20,
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
  title: string;
  trades: string[];
  status: 'queued' | 'answered' | 'hidden';
  comment_count: number;
  view_count: number;
  created_at: string;
  photoCount: number;
  summary: string | null; // AI 답변 한 줄(답변 전이면 null)
}

/** "오늘 기준 빅데이터 견적서" 숫자 묶음 */
export interface AskStats {
  display: number; // 화면에 보이는 수(실제 + 1,000)
  delta: number | null; // 어제 대비 증감
  date: string | null; // 갱신일 "2026-10-03"
}

/** 근거 묶음(ask_answers.basis) 중 화면이 읽는 칸 */
export interface AskBasis {
  n?: number;
  period?: string;
  region?: string;
  calcs?: { label: string; href: string }[];
  posts?: { title: string; slug: string }[];
}
