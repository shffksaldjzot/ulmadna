// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 페이지 (서버 컴포넌트, 도배 page.tsx를 그대로 본떠 만듦)
//
// 하는 일: 서버 전용 제품 마스터(FLOORING_PRODUCTS)를 읽어 화면에 필요한 칸만 골라
// 클라이언트 컴포넌트에 props로 내려준다. 이 파일이 "src/server/** import 금지" 규칙의
// 유일한 예외다(제품 판매가는 이미 공개된 소비자가라 단가 유출 규칙과 무관하다).
//
// 실제 폼·결과 화면은 FlooringCalculator(클라이언트)가 그린다.
// useSearchParams(공유 링크 ?d= 복원)를 쓰는 클라이언트 컴포넌트라 Suspense로 감싼다.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import FlooringCalculator from './FlooringCalculator';
import { FLOORING_PRODUCTS } from '@/server/calc/data/flooring-products';
import { toFlooringProductOptions } from '@/lib/v1/flooringProductOptions';

export const metadata = {
  title: '바닥재 계산기 — 마루·장판·데코타일 물량과 비용 | 얼마드나',
  description: '평형 하나만 넣어도 바로 바닥재 물량 계산 결과가 뜨고, 실측을 더하면 더 정확해집니다.',
};

export default function FlooringCalcPage() {
  // 제품 마스터(src/server/calc/data/flooring-products.ts, E 에이전트 작업)에서 화면이
  // 실제로 쓰는 칸만 뽑아 내려준다. usable=false·kind=null인 제품은 toFlooringProductOptions가 거른다.
  const products = toFlooringProductOptions(FLOORING_PRODUCTS);

  return (
    <Suspense fallback={null}>
      <FlooringCalculator products={products} />
    </Suspense>
  );
}
