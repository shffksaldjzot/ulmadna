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

// ──────────────────────────────────────────────
// 새 화면(즉답 + 정밀 폼) 전용 타입 — 2026년 09월 08일 절충안 재구성
//
// 옛 화면(WallpaperInputForm.tsx, 2026-09-09 삭제됨)이 쓰던 `rooms`(name·widthM·depthM·doors
// 모양)와 새 정밀 폼이 쓰는 방 모양({w,d,h,openings})은 서로 다르다. 같은 필드 이름을 쓰면
// 타입이 충돌하므로 새 정밀 폼 전용 방 배열은 이름을 `preciseRooms`로 따로 둔다.
// (옛 `rooms` 필드는 아주 옛날에 공유된 링크를 여전히 풀 수 있어야 해서 타입만 남겨 둔다 —
//  지금 화면 어디서도 이 필드를 쓰지 않는다)
// ──────────────────────────────────────────────

/** 정밀 폼 — 문·창 하나 (개구부). 폭·높이는 항상 cm로 저장한다 */
export interface WallpaperOpening {
  kind: 'door' | 'window';
  /** 폭 (cm) */
  w: number;
  /** 높이 (cm) */
  h: number;
  /** 같은 규격 개수 */
  count: number;
}

/** 정밀 폼 — 방 하나(실측). 가로·세로·높이는 항상 m로 저장한다(화면 표시 단위와 무관) */
export interface PreciseRoomInput {
  /** 가로 (m) */
  w: number;
  /** 세로 (m) */
  d: number;
  /** 높이 (m). 없으면 폼 공통 높이(heightM)를 쓴다 */
  h?: number;
  openings: WallpaperOpening[];
}

/**
 * 화면에 필요한 벽지 제품 정보만 골라 담은 모양 (page.tsx가 서버 제품 마스터에서 골라 내려준다).
 * 제품 마스터(src/server/calc/data/wallpaper-products.ts) 조사가 아직 진행 중이라 규격·가격이
 * 미확인인 제품이 섞여 있다 — 그런 칸은 null로 내려오니 화면에서 "조사 중"으로 표시하거나 걸러야 한다.
 */
export interface WallpaperProductOption {
  code: string;
  brand: string;
  name: string;
  kind: '합지' | '실크';
  /** 롤 폭 (cm). 미확인이면 null */
  widthCm: number | null;
  /** 롤 길이 (m). 미확인이면 null */
  lengthM: number | null;
  /** 무늬 리피트 (cm). 0=무지 확인됨, null=미확인 */
  repeatCm: number | null;
  /** 원 / 롤. priceMin·priceMax 중간값(웹 조사). 둘 다 미확인이면 null */
  price: number | null;
  /** 화면 표기용 출처 문구 (예: "웹 조사 기준 · 2026.9") */
  sourceLabel: string;
}

/** 도배 계산기 입력 폼이 들고 있는 값의 모양 (서버 계산 입력과 거의 동일) */
export interface WallpaperFormState {
  mode: '평형' | '실측' | '면적';
  // 평형 모드
  pyeong?: number;
  bay?: 2 | 3 | 4;
  // 실측 모드 (옛 화면 전용 모양 — 삭제 전까지 유지)
  rooms?: { name: string; widthM: number; depthM: number; doors?: number }[];
  heightM?: number;
  // 면적 모드
  areas?: { wallSqm?: number; ceilingSqm?: number; perimeterM?: number };
  // 공통
  scope: '전체' | '거실주방' | string[];
  ceiling: boolean;
  paperType?: '합지' | '실크';
  product?: { rollPrice: number; widthCm: number; lengthM: number; repeatCm?: number };
  region?: string;

  // ── 여기부터 새 화면(즉답+정밀 폼) 전용 칸. 없으면 기본값으로 취급한다(하위호환) ──
  /** 정밀 폼 치수 입력 단위 표시(화면 전용, 저장값 자체는 항상 m). 기본 'm' */
  unit?: 'mm' | 'm';
  /** 정밀 폼 입력 방식 — 방별 실측 / 벽 길이 직접입력. 기본 'room' */
  entry?: 'room' | 'length';
  /** 도배 대상 — 벽만 / 천장만 / 둘 다. 기본 'both' */
  target?: 'wall' | 'ceiling' | 'both';
  /** 제품 마스터에서 고른 제품 코드. 없으면 종류 평균가(paperType 기준) */
  productCode?: string;
  /** 정밀 폼 - 방별 실측 (entry === 'room'일 때 사용) */
  preciseRooms?: PreciseRoomInput[];
  /** 정밀 폼 - 벽 둘레 직접 입력 (entry === 'length'일 때 사용, m) */
  wallLength?: number;
  /** 정밀 폼 - 벽 길이 입력 모드에서 천장까지 계산할 때 천장 면적 직접 입력 (㎡) */
  directCeilingSqm?: number;
  /** 구축(재도배) 여부. 엔진 isOld로 그대로 전달한다. 기본 false(신축·빈집) */
  isOld?: boolean;
  /** 정밀 폼 - 벽 길이 모드에서 쓰는 문·창 목록. 훅이 면적으로 환산해 벽 면적에서 뺀다 */
  lengthOpenings?: WallpaperOpening[];
  /**
   * 화면 모드 — "간단하게 계산하기"(simple) / "정확하게 계산하기"(precise). 기본 'simple'.
   * 2026-09-09 화면 재배치(벽지 최우선 A안)로 새로 생겼다. 공유 링크에도 그대로 실려서
   * 결과 페이지가 같은 모드로 계산한다.
   */
  view?: 'simple' | 'precise';
}

/**
 * 새 화면(벽지 최우선 + 즉답/정밀) 초기값.
 * 벽지 종류(paperType)는 일부러 안 넣는다 — 2026-09-09부터 벽지 종류를 안 고르면
 * 계산 자체를 하지 않는 규칙으로 바뀌었다(예전의 "합지~실크 합집합 즉답"은 폐기).
 */
export const DEFAULT_CALC_FORM: WallpaperFormState = {
  mode: '평형',
  pyeong: 34,
  bay: 3,
  scope: '전체',
  ceiling: true,
  unit: 'm',
  entry: 'room',
  target: 'both',
  isOld: false,
  view: 'simple',
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
