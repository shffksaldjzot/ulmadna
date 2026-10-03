// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 화면 폼 상태 + 공유 링크(?d=) 인코딩/복원
//
// 폼 상태 전체를 JSON → base64url로 바꿔 `d` 파라미터 하나에 담는다(다른 계산기와 같은 방식).
// 안 고른 값은 undefined로 둔다 — undefined면 서버가 기본값으로 계산하고 "가정"으로 표시한다.
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import type {
  TileGrade,
  TileMethod,
  TilePattern,
  TileRoomKind,
  TileScope,
  TileService,
  TileSetting,
} from './tilePresets';

/** 정확 모드 실 카드 한 장(치수는 항상 mm로 저장) */
export interface TileRoomForm {
  kind: TileRoomKind;
  name: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  /** 문 개수 — undefined면 1개(욕실 기본) */
  doors?: number;
  /** 창 개수 */
  windows?: number;
  /** 욕조 있음 */
  tub?: boolean;
}

/** 타일 계산기 폼 상태 */
export interface TileFormState {
  /** 간단하게 / 정확하게 */
  view?: 'simple' | 'precise';

  // ── 간단 모드 단계 ──
  scope?: TileScope;
  method?: TileMethod;
  /** 간단 모드 규격 칩(예: '300x600') */
  sizeCode?: string;

  // ── 결과 위 조정 칩 ──
  service?: TileService;
  pyeong?: number;
  pattern?: TilePattern;
  grade?: TileGrade;

  // ── 정확 모드 ──
  rooms?: TileRoomForm[];
  /** 치수 입력 단위(화면 표시용) */
  unit?: 'mm' | 'm';
  wallSizeCode?: string;
  wallPieces?: number;
  floorSizeCode?: string;
  floorPieces?: number;
  groutMm?: number;
  setting?: TileSetting;
}

/** 처음 상태 — 간단 모드, 아무것도 안 고름. 정확 모드는 욕실 카드 1장으로 시작 */
export const DEFAULT_TILE_FORM: TileFormState = {
  view: 'simple',
  unit: 'mm',
  rooms: [{ kind: 'bath', name: '욕실1' }],
};

/** 문자열 → base64url */
function toBase64Url(json: string): string {
  const b64 = typeof window === 'undefined' ? Buffer.from(json, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → 문자열 */
function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return typeof window === 'undefined' ? Buffer.from(padded, 'base64').toString('utf8') : decodeURIComponent(escape(atob(padded)));
}

/** 폼 상태 → URL 쿼리 문자열 */
export function encodeTileForm(state: TileFormState): string {
  return toBase64Url(JSON.stringify(state));
}

/** URL 쿼리 문자열 → 폼 상태(깨졌으면 null). 모양 검사는 sanitizeTileForm이 한다 */
export function decodeTileForm(d: string | null | undefined): TileFormState | null {
  if (!d) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(d));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as TileFormState;
  } catch {
    return null;
  }
}
