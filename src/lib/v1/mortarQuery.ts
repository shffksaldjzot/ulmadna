// ──────────────────────────────────────────────
// v1 허브 — 미장(레미탈·셀프레벨링) 계산기 입력값을 URL 쿼리로 인코딩/복원
//
// 왜 필요한가 (도배·바닥재 계산기와 같은 이유):
//   결과 화면을 카카오톡 등으로 "공유"하려면 조건이 URL 하나에 다 담겨야 한다.
//   폼 상태 전체를 JSON으로 만들어 base64url로 인코딩한 뒤 `d` 파라미터 하나에 담는다.
//   (예: /calc/mortar/result?d=eyJt...)
//
// 2026-09-14 검사관 지적(이중 관리 제거): 모드·용도·공법 타입은 여기서 새로 만들지 않고
// src/lib/v1/mortarPresets.ts(서버·클라 공유) 것을 그대로 다시 내보낸다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import type { MortarMode, MortarUsage, SelfLevelUsage, MortarMethod } from './mortarPresets';
import { USAGE_PRESET } from './mortarPresets';

export type { MortarMode, MortarUsage, SelfLevelUsage, MortarMethod };

/** 간단 모드 — 면적을 넣는 방식 (평/㎡ 직접 입력 또는 가로×세로) */
export type MortarAreaInputMode = 'area' | 'rect';

/** 직접 입력한 제품(레미탈·셀프레벨링 공통 — 포당 kg·계수·가격) */
export interface MortarDirectProduct {
  kgPerMmSqm?: number;
  bagKg?: number;
  pricePerBag?: number;
}

/** 정밀 모드 — 실별 면적 한 줄 */
export interface MortarPreciseRoom {
  name: string;
  /** 이 방의 면적(㎡) — 저장값은 항상 ㎡ */
  areaSqm: number;
}

/** 미장 계산기 입력 폼이 들고 있는 값의 모양 */
export interface MortarFormState {
  /** 화면 모드 — "간단하게 계산하기"(simple) / "정확하게 계산하기"(precise). 기본 'simple' */
  view?: 'simple' | 'precise';
  /** 계산기 모드 — 레미탈 / 셀프레벨링. 기본 '레미탈' */
  mode?: MortarMode;

  // 간단 모드 — 면적 입력 방식
  areaInputMode?: MortarAreaInputMode;
  /** area 방식일 때 — 평/㎡ 값 자체 */
  area?: number;
  /** area 방식일 때 — 단위(평/㎡) */
  areaUnit?: '평' | '㎡';
  /** rect 방식일 때 — 가로(m) */
  rectWidth?: number;
  /** rect 방식일 때 — 세로(m) */
  rectDepth?: number;

  // 간단 모드 — 용도 칩(두께 기본값·공법 기본값을 함께 채운다)
  usage?: MortarUsage;
  selfLevelUsage?: SelfLevelUsage;

  // 두께 — 칩을 누르면 채워지고, 정밀 모드에서 슬라이더로 직접 바꿀 수 있다
  thicknessMm?: number;

  /**
   * 공법 오버라이드(레미탈 전용) — 정밀 모드 토글로만 바뀐다. 안 주면 usage 기본값을 쓴다
   * (예: 방통 전체 → 장비 타설, 나머지 → 손미장). 2026-09-14 검사관 지적으로 "체적이 크면
   * 장비 타설" 문턱을 버리고 이 필드로 바꿨다.
   */
  method?: MortarMethod;

  // 정밀 모드
  /** 실별 면적 목록. 있으면 면적 입력 대신 이 합계를 쓴다 */
  preciseRooms?: MortarPreciseRoom[];
  /** 배합비 — 레미탈 모드 "현장 배합" 대안에만 쓴다 */
  mixRatio?: '1:2' | '1:3';
  /** 로스율(0~0.2). 기본 5% */
  lossRate?: number;
  /** 와이어메시 옵션 — 레미탈 모드 전용 */
  wireMesh?: boolean;
  /** 프라이머 옵션 */
  primer?: boolean;

  /** 제품 마스터에서 고른 제품 코드 */
  productCode?: string;
  /** 목록에 없는 제품을 직접 입력 */
  product?: MortarDirectProduct;
}

/** 새 화면(즉답+정밀 폼) 초기값 — 레미탈 모드, 방통 전체 용도로 즉시 답이 나오게 한다 */
export const DEFAULT_MORTAR_FORM: MortarFormState = {
  view: 'simple',
  mode: '레미탈',
  areaInputMode: 'area',
  areaUnit: '평',
  area: 10,
  usage: '방통전체',
  // 하드코딩하지 않고 프리셋 표(mortarPresets.ts)에서 그대로 읽는다(2026-09-15 검사관 지적)
  thicknessMm: USAGE_PRESET['방통전체'].defaultMm,
  mixRatio: '1:3',
  wireMesh: false,
  primer: false,
};

/** 문자열을 URL에 안전한 base64(base64url)로 바꾼다 (도배·바닥재 쿼리와 같은 로직) */
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
export function encodeMortarForm(state: MortarFormState): string {
  return toBase64Url(JSON.stringify(state));
}

/** URL 쿼리 문자열 → 폼 상태. 형식이 깨졌으면 null. */
export function decodeMortarForm(d: string | null | undefined): MortarFormState | null {
  if (!d) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(d));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as MortarFormState;
  } catch {
    return null;
  }
}
