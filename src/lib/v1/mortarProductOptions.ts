// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: 제품 마스터 원본 → 화면용 MortarProductOption[] 변환
//
// 왜 따로 파일을 팠나 (도배·바닥재 productOptions.ts와 같은 이유):
//   제품 마스터 원본(MORTAR_PRODUCTS, src/server/calc/data/mortar-products.ts)을
//   화면이 쓰는 얇은 모양으로 바꾸는 변환이 입력 화면(page.tsx)과 공유 링크 결과 화면
//   (result/page.tsx) 두 곳에서 똑같이 필요하다. 순수 함수 하나로 빼서 두 곳이 나눠 쓴다.
//
//   이 파일 자체는 순수 함수만 있고 부수효과가 없다. 제품 마스터 원본 타입(MortarProduct)은
//   타입으로만 참조한다 — 실제 원본 배열은 항상 호출하는 쪽(서버 컴포넌트)이 넘겨준다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import type { MortarProduct } from '@/server/calc/data/mortar-products';
import type { MortarMode } from './mortarQuery';

/** 화면이 실제로 쓰는 제품 정보만 골라 담은 모양 */
export interface MortarProductOption {
  code: string;
  brand: string;
  name: string;
  mode: MortarMode;
  bagKg: number;
  kgPerMmSqm: number;
  minThicknessMm: number;
  maxThicknessMm: number;
  /** 포당 판매가(원). 미확인이면 null — 이때는 종류 평균가로 계산한다 */
  pricePerBag: number | null;
}

/** 제품 마스터 원본 목록 → 화면이 쓰는 MortarProductOption[] */
export function toMortarProductOptions(products: readonly MortarProduct[]): MortarProductOption[] {
  return products.map((p) => ({
    code: p.id,
    brand: p.brand,
    name: p.line,
    mode: p.mode,
    bagKg: p.bagKg,
    kgPerMmSqm: p.kgPerMmSqm,
    minThicknessMm: p.minThicknessMm,
    maxThicknessMm: p.maxThicknessMm,
    pricePerBag: p.pricePerBag,
  }));
}

// ── 2026-09-14 검사관 지적 — 셀프레벨링 두께 범위 안내 ──────────
//
// 셀프레벨링 제품은 두께 권장 범위가 제품마다 다르다(06_미장.md §5-2). 사용자가 두께를
// 바꿨는데 지금 고른 제품이 그 두께를 못 덮으면 경고만 하지 않고 맞는 제품으로 바로
// 바꿔 준다("추천 제품 자동 전환") — PreciseSection.tsx가 이 함수들을 쓴다.

/** 제품 하나가 이 두께(mm)를 시공 범위로 다루는지 */
export function productCoversThickness(p: MortarProductOption, thicknessMm: number): boolean {
  return thicknessMm >= p.minThicknessMm && thicknessMm <= p.maxThicknessMm;
}

/**
 * 두께(mm)에 맞는 셀프레벨링 제품을 추천한다.
 * 그 두께를 다루는 제품 중 범위가 가장 좁은(그 두께에 가장 특화된) 제품을 고른다.
 * 맞는 제품이 하나도 없으면 undefined(제품 선택 없이 모드 기본 계수로 계산하게 둔다).
 */
export function recommendSelfLevelProduct(
  thicknessMm: number,
  products: MortarProductOption[],
): MortarProductOption | undefined {
  const fits = products.filter((p) => p.mode === '셀프레벨링' && productCoversThickness(p, thicknessMm));
  if (fits.length === 0) return undefined;
  return fits.reduce((best, p) =>
    p.maxThicknessMm - p.minThicknessMm < best.maxThicknessMm - best.minThicknessMm ? p : best,
  );
}

/**
 * 제품 선택 드롭다운에 쓰는 표시 문구를 만든다.
 * 2026-09-15 형아 피드백: "레미탈이 몇 kg짜리 몇 포인지"가 안 보인다는 지적 — 제품을 고르는
 * 자리에도 포장 kg를 반드시 적어서, 고른 제품과 즉답의 "○kg × N포" 줄이 항상 맞게 한다.
 * 예: "삼표 SP몰탈 일반미장용 · 40kg · 10~50mm"
 */
export function formatMortarProductLabel(p: MortarProductOption): string {
  return `${p.brand} ${p.name} · ${p.bagKg}kg · ${p.minThicknessMm}~${p.maxThicknessMm}mm`;
}
