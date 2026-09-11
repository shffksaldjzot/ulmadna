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
// 제품 마스터 원본 → 화면용 목록 변환은 result/page.tsx와 같이 쓰는 순수 함수
// (toWallpaperProductOptions, src/lib/v1/wallpaperProductOptions.ts)로 뺐다.
//
// 작성일: 2026년 09월 08일
// 2026년 09월 09일: 제품 변환 로직을 wallpaperProductOptions.ts로 공유
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import WallpaperCalculator from './WallpaperCalculator';
import { WALLPAPER_PRODUCTS } from '@/server/calc/data/wallpaper-products';
import { toWallpaperProductOptions } from '@/lib/v1/wallpaperProductOptions';

export const metadata = {
  title: '도배 계산기 — 얼마드나',
  description: '평형 하나만 넣어도 바로 범위 견적이 뜨고, 실측을 더하면 더 정확해집니다.',
};

export default function WallpaperCalcPage() {
  // 제품 마스터(src/server/calc/data/wallpaper-products.ts, 18건 초안·형아 검수 대기 항목 포함)에서
  // 화면이 실제로 쓰는 칸만 뽑아 내려준다. 규격·가격이 미확인(null)인 제품도 그대로 넘기고,
  // 계산에 못 쓸 만큼 정보가 없는 제품은 PaperPicker가 "조사 중"으로 표시하며 거른다.
  const products = toWallpaperProductOptions(WALLPAPER_PRODUCTS);

  return (
    <Suspense fallback={null}>
      <WallpaperCalculator products={products} />
    </Suspense>
  );
}
