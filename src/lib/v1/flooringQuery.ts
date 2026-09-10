// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 입력값을 URL 쿼리로 인코딩/복원
//
// 왜 필요한가:
//   결과 화면을 카카오톡 등으로 "공유"하려면 조건이 URL 하나에 다 담겨야 한다.
//   폼 상태 전체를 JSON으로 만들어 base64url로 인코딩한 뒤 `d` 파라미터 하나에 담는다.
//   (예: /v1/calc/flooring/result?d=eyJt...)
//
//   이 파일은 도배 계산기의 wallpaperQuery.ts를 그대로 본떠 만들었다. 다만
//   도배의 toBase64Url/fromBase64Url은 그 파일 밖으로 export되어 있지 않아
//   그대로 가져다 쓸 수 없어서, 여기서도 똑같은 로직을 다시 적었다(도배 파일은
//   손대지 않는다는 규칙 때문).
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

/** 바닥재 종류 — 세그먼트로 하나만 고른다(합집합 즉답 없음, 도배와 같은 규칙) */
export type FlooringKind = '마루' | '장판' | '데코타일';

/** 도배 범위 칩과 달리 바닥재는 세 값 중 하나만 고르는 배타적 선택이다 */
export type FlooringScope = '전체' | '방만' | '거실주방';

/**
 * 화면에 필요한 바닥재 제품 정보만 골라 담은 모양 (page.tsx가 서버 제품 마스터에서 골라 내려준다).
 * 박스형(마루·데코타일)과 롤형(장판)이 쓰는 칸이 서로 다르므로 전부 optional로 둔다 —
 * 화면(MaterialPicker)이 kind를 보고 필요한 칸만 읽는다.
 */
export interface FlooringProductOption {
  code: string;
  brand: string;
  name: string;
  kind: FlooringKind;
  /** 판매 단위 — 박스형(마루·데코타일)은 '박스', 롤형(장판)은 'm' */
  saleUnit: '박스' | 'm';
  /** 대표 판매가(원). 박스형이면 박스당 가격, 롤형이면 m당 가격 */
  price: number | null;
  /** 박스형 전용 — 박스당 ㎡. 미확인이면 null */
  sqmPerBox: number | null;
  /** 박스형 전용 — 박스당 장 수. 미확인이면 null */
  pcsPerBox: number | null;
  /** 박스형 전용 — 장 폭(mm). 미확인이면 null */
  widthMm: number | null;
  /** 박스형 전용 — 장 길이(mm). 미확인이면 null */
  lengthMm: number | null;
  /** 롤형(장판) 전용 — 롤 폭(m). 미확인이면 null */
  rollWidthM: number | null;
  /** 두께(mm). 화면 표기용, 미확인이면 null */
  thicknessMm: number | null;
  /** 이 제품 전용 초기 로스율(0.05·0.07·0.12 …). 없으면 종류 기본값을 쓴다 */
  lossRate: number | null;
  /**
   * 같은 브랜드+라인(name) 안에서 제품을 구분하는 표시. sku가 있으면 sku 그대로
   * (예: "600×600"·"MTS6112 등"), 없으면 규격에서 만든 문구(예: "600각"·"143×1205").
   * 둘 다 없으면 빈 문자열 — 드롭다운 라벨이 이 값을 붙여서 동명 제품을 구분한다
   * (검사관 1라운드 지적 6번: NOX 오키드3000 2줄·현대 골드타일마스터/클래식 2줄씩이
   * 라벨만 보고 구분이 안 됐다).
   */
  variant: string;
}

/** 직접 입력한 바닥재 — 박스형(마루·데코타일)과 롤형(장판)이 쓰는 칸이 다르다 */
export interface FlooringDirectProduct {
  // 박스형(마루·데코타일)
  pricePerBox?: number;
  sqmPerBox?: number;
  widthMm?: number;
  lengthMm?: number;
  // 롤형(장판)
  pricePerM?: number;
  rollWidthM?: number;
}

/** 정확 모드(실측) — 방 하나의 가로·세로(m). 도배와 달리 높이·문창이 없다(바닥은 벽이 아니라서) */
export interface FlooringPreciseRoom {
  /** 가로 (m) */
  w: number;
  /** 세로 (m) */
  d: number;
}

/** 바닥재 계산기 입력 폼이 들고 있는 값의 모양 */
export interface FlooringFormState {
  /** 화면 모드 — "간단하게 계산하기"(simple) / "정확하게 계산하기"(precise). 기본 'simple' */
  view?: 'simple' | 'precise';
  /** 바닥재 종류. 안 고르면 계산하지 않는다(도배의 벽지 종류와 같은 규칙) */
  kind?: FlooringKind;
  /** 제품 마스터에서 고른 제품 코드. 없으면 종류 평균가 */
  productCode?: string;
  /** 목록에 없는 제품을 직접 입력 */
  product?: FlooringDirectProduct;
  // 간단 모드
  pyeong?: number;
  bay?: 2 | 3 | 4;
  // 공통 — 범위(전체/방만/거실주방). 욕실·현관은 항상 제외(엔진이 처리)
  scope?: FlooringScope;
  /** 정확 모드 치수 입력 단위(화면 표시 전용, 저장값은 항상 m) */
  unit?: 'mm' | 'm';
  /** 정확 모드 — 방별 실측 */
  preciseRooms?: FlooringPreciseRoom[];
  /** 기존 바닥재 철거 포함 여부. 구성 보기의 토글로 켜고 끈다. 기본 true */
  removeOld?: boolean;
  /** 걸레받이 교체 포함 여부. 구성 보기의 토글로 켜고 끈다. 기본 true */
  baseboard?: boolean;
}

/** 새 화면(즉답+정밀 폼) 초기값. kind는 일부러 안 넣는다 — 종류를 안 고르면 계산 자체를 안 하는 규칙 */
export const DEFAULT_FLOORING_FORM: FlooringFormState = {
  view: 'simple',
  pyeong: 34,
  bay: 3,
  scope: '전체',
  unit: 'm',
  removeOld: true,
  baseboard: true,
};

/** 문자열을 URL에 안전한 base64(base64url)로 바꾼다 (wallpaperQuery.ts와 같은 로직) */
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
export function encodeFlooringForm(state: FlooringFormState): string {
  return toBase64Url(JSON.stringify(state));
}

/** URL 쿼리 문자열 → 폼 상태. 형식이 깨졌으면 null. */
export function decodeFlooringForm(d: string | null | undefined): FlooringFormState | null {
  if (!d) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(d));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as FlooringFormState;
  } catch {
    return null;
  }
}
