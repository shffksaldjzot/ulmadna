// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 화면 폼 상태 + 공유 링크(?d=) 인코딩/복원
//
// 폼 상태 전체를 JSON → base64url로 바꿔 `d` 파라미터 하나에 담는다(다른 계산기와 같은 방식).
// 안 고른 값은 undefined로 둔다 — undefined면 서버가 기본값으로 계산하고 "가정"으로 표시한다.
//
// 2026-10-08 개편: 정확 모드가 "실 카드 여러 장"에서 "공간 하나 + 치수"로 바뀌었다.
//   옛 공유 링크(rooms[])는 sanitizeTileForm이 첫 실을 새 모양으로 옮겨 준다.
//
// 작성일: 2026년 10월 03일
// 개편: 2026년 10월 08일
// ──────────────────────────────────────────────

import type {
  TileGrade,
  TileGroutType,
  TileKind,
  TileMethod,
  TilePattern,
  TileScope,
  TileService,
  TileSetting,
  TileSpace,
} from './tilePresets';

/** 타일 계산기 폼 상태 */
export interface TileFormState {
  /** 간단하게 / 정확하게 */
  view?: 'simple' | 'precise';

  // ── 간단 모드 첫 단계 ──
  scope?: TileScope;

  // ── 정확 모드 첫 두 단계(공간·치수 — 치수는 항상 mm로 저장) ──
  space?: TileSpace;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  /** 문 개수 — undefined면 욕실 벽은 1개 */
  doors?: number;
  /** 창 개수 */
  windows?: number;
  /** 욕조 있음 */
  tub?: boolean;
  /** 치수 입력 단위(화면 표시용) */
  unit?: 'mm' | 'm';

  // ── 두 모드 공통 단계 ──
  /** 타일 종류 */
  tileKind?: TileKind;
  /** 타일 규격 칩(예: '300x600') */
  sizeCode?: string;
  /** 붙임 공법(정확 모드 단계 — 간단 모드는 자동 추천) */
  setting?: TileSetting;

  // ── 결과 위 조정 칩(시공 조건) ──
  service?: TileService;
  method?: TileMethod;
  pyeong?: number;
  pattern?: TilePattern;
  grade?: TileGrade;
  groutType?: TileGroutType;
  groutMm?: number;
  waterproof?: boolean;
  heated?: boolean;
  cornerBead?: boolean;
  silicone?: boolean;
}

/** 처음 상태 — 간단 모드, 아무것도 안 고름 */
export const DEFAULT_TILE_FORM: TileFormState = {
  view: 'simple',
  unit: 'mm',
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
export function decodeTileForm(d: string | null | undefined): Record<string, unknown> | null {
  if (!d) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(d));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
