// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 페이지 (서버 컴포넌트)
//
// 하는 일: 서버 전용 제품 마스터(WALLPAPER_PRODUCTS)를 읽어 화면에 필요한 칸만
// 골라(코드·브랜드·이름·종류·폭·롤길이·리피트·가격·출처 라벨) 클라이언트 컴포넌트에
// props로 내려준다. 이 파일이 "src/server/** import 금지" 규칙의 유일한 예외다
// (제품 판매가는 이미 공개된 소비자가라 단가 유출 규칙과 무관하다 — 단가 산식 자체는
// src/server/pricing/wallpaper.ts에만 있고 여기엔 없다).
//
// 실제 폼·결과 화면은 WallpaperCalculator(클라이언트)가 그린다.
// useSearchParams(공유 링크 ?d= 복원)를 쓰는 클라이언트 컴포넌트라 Suspense로 감싼다.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import WallpaperCalculator from './WallpaperCalculator';
import { WALLPAPER_PRODUCTS } from '@/server/calc/data/wallpaper-products';
import type { WallpaperProductOption } from '@/lib/v1/wallpaperQuery';

export const metadata = {
  title: '도배 계산기 — 얼마드나',
  description: '평형 하나만 넣어도 바로 범위 견적이 뜨고, 실측을 더하면 더 정확해집니다.',
};

/** 조사일("2026-09-08") → 화면 표기("2026.9") */
function surveyMonthLabel(surveyDate: string): string {
  const [y, m] = surveyDate.split('-');
  return `${y}.${Number(m)}`;
}

/** priceMin·priceMax(둘 다 null일 수 있음) → 화면에 쓸 대표 가격 하나 */
function representativePrice(min: number | null, max: number | null): number | null {
  if (min != null && max != null) return Math.round((min + max) / 2);
  return min ?? max ?? null;
}

export default function WallpaperCalcPage() {
  // 제품 마스터(src/server/calc/data/wallpaper-products.ts, 18건 초안·형아 검수 대기 항목 포함)에서
  // 화면이 실제로 쓰는 칸만 뽑아 내려준다. 규격·가격이 미확인(null)인 제품도 그대로 넘기고,
  // 계산에 못 쓸 만큼 정보가 없는 제품은 PaperPicker(화면 C)가 "조사 중"으로 표시하며 거른다.
  const products: WallpaperProductOption[] = WALLPAPER_PRODUCTS.map((p) => ({
    code: p.id,
    brand: p.brand,
    name: p.line,
    kind: p.paperType,
    widthCm: p.widthCm,
    lengthM: p.lengthM,
    repeatCm: p.repeatCm,
    price: representativePrice(p.priceMin, p.priceMax),
    sourceLabel: `웹 조사 기준 · ${surveyMonthLabel(p.surveyDate)}${p.needsReview ? ' · 확인 필요' : ''}`,
  }));

  return (
    <Suspense fallback={null}>
      <WallpaperCalculator products={products} />
    </Suspense>
  );
}
