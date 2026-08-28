// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 입력값을 URL 쿼리로 인코딩/복원
//
// 왜 필요한가:
//   결과 화면을 카카오톡 등으로 "공유"하려면 조건이 URL 하나에 다 담겨야 한다.
//   입력 방식(평형/실측/면적)마다 필요한 칸이 다 달라서 개별 쿼리 파라미터로
//   쪼개면 너무 복잡해지므로, 폼 상태 전체를 JSON으로 만들어 base64url로
//   인코딩한 뒤 `d` 파라미터 하나에 넣는다. (예: /v1/calc/wallpaper/result?d=eyJt...)
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

/** 도배 계산기 입력 폼이 들고 있는 값의 모양 (서버 계산 입력과 거의 동일) */
export interface WallpaperFormState {
  mode: '평형' | '실측' | '면적';
  // 평형 모드
  pyeong?: number;
  bay?: 2 | 3 | 4;
  // 실측 모드
  rooms?: { name: string; widthM: number; depthM: number; doors?: number }[];
  heightM?: number;
  // 면적 모드
  areas?: { wallSqm?: number; ceilingSqm?: number; perimeterM?: number };
  // 공통
  scope: '전체' | '거실주방' | string[];
  ceiling: boolean;
  paperType: '합지' | '실크';
  product?: { rollPrice: number; widthCm: number; lengthM: number; repeatCm?: number };
  region?: string;
}

/** 평형 모드 기본값 — 목업 예시(34평 3베이 실크 천장포함)와 맞춘다 */
export const DEFAULT_WALLPAPER_FORM: WallpaperFormState = {
  mode: '평형',
  pyeong: 34,
  bay: 3,
  scope: '전체',
  ceiling: true,
  paperType: '실크',
};

/** 문자열을 URL에 안전한 base64(base64url)로 바꾼다 */
function toBase64Url(json: string): string {
  const b64 =
    typeof window === 'undefined'
      ? Buffer.from(json, 'utf8').toString('base64')
      : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url을 원래 JSON 문자열로 되돌린다 */
function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return typeof window === 'undefined'
    ? Buffer.from(padded, 'base64').toString('utf8')
    : decodeURIComponent(escape(atob(padded)));
}

/** 폼 상태 → URL 쿼리에 넣을 문자열 */
export function encodeWallpaperForm(state: WallpaperFormState): string {
  return toBase64Url(JSON.stringify(state));
}

/** URL 쿼리 문자열 → 폼 상태. 형식이 깨졌으면 null. */
export function decodeWallpaperForm(d: string | null | undefined): WallpaperFormState | null {
  if (!d) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(d));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as WallpaperFormState;
  } catch {
    return null;
  }
}
