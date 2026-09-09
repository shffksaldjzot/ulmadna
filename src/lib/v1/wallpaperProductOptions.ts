// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 제품 마스터 원본 → 화면용 WallpaperProductOption[] 변환
//
// 왜 따로 파일을 팠나:
//   제품 마스터 원본(WALLPAPER_PRODUCTS, src/server/calc/data/wallpaper-products.ts)을
//   화면이 쓰는 얇은 모양(WallpaperProductOption)으로 바꾸는 변환 로직이
//   입력 화면(page.tsx)과 공유 링크 결과 화면(result/page.tsx) 두 곳에서 똑같이 필요하다.
//   두 파일이 각자 베껴 쓰면 나중에 한쪽만 고치는 실수가 생기니 순수 함수 하나로 뺐다.
//
//   이 파일 자체는 순수 함수만 있고 부수효과가 없다. 제품 마스터 원본 타입(WallpaperProduct)은
//   타입으로만 참조한다(런타임에 그 모듈을 실행하지 않는다) — 실제 원본 배열은 항상
//   호출하는 쪽(서버 컴포넌트)이 넘겨준다.
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import type { WallpaperProduct } from '@/server/calc/data/wallpaper-products';
import type { WallpaperProductOption } from './wallpaperQuery';

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

/**
 * 제품 마스터 원본 목록 → 화면이 쓰는 WallpaperProductOption[].
 * 규격·가격이 미확인(null)인 제품도 그대로 넘긴다 — 계산에 못 쓸 만큼 정보가 없는 제품은
 * 화면(PaperPicker)이 "조사 중"으로 표시하며 거른다.
 */
export function toWallpaperProductOptions(products: readonly WallpaperProduct[]): WallpaperProductOption[] {
  return products.map((p) => ({
    code: p.id,
    brand: p.brand,
    // 소폭(53cm) 합지는 방·원룸용이라 아파트 거실엔 안 맞는다 — 이름에 표시해서 헷갈리지 않게 한다 (2026-09-09 형아 결정)
    name: p.widthCm != null && p.widthCm <= 60 ? `${p.line} · 소폭 ${p.widthCm}cm(방 전용)` : p.line,
    kind: p.paperType,
    widthCm: p.widthCm,
    lengthM: p.lengthM,
    repeatCm: p.repeatCm,
    price: representativePrice(p.priceMin, p.priceMax),
    sourceLabel: `웹 조사 기준 · ${surveyMonthLabel(p.surveyDate)}${p.needsReview ? ' · 확인 필요' : ''}`,
  }));
}
