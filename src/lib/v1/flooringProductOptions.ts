// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 제품 마스터 원본 → 화면용 FlooringProductOption[] 변환
//
// 왜 따로 파일을 팠나 (도배 wallpaperProductOptions.ts와 같은 이유):
//   제품 마스터 원본(FLOORING_PRODUCTS, src/server/calc/data/flooring-products.ts)을
//   화면이 쓰는 얇은 모양(FlooringProductOption)으로 바꾸는 변환 로직이 입력 화면
//   (page.tsx)과 공유 링크 결과 화면(result/page.tsx) 두 곳에서 똑같이 필요하다.
//   두 파일이 각자 베껴 쓰면 나중에 한쪽만 고치는 실수가 생기니 순수 함수 하나로 뺐다.
//
//   이 파일 자체는 순수 함수만 있고 부수효과가 없다. 제품 마스터 원본 타입(FlooringProduct)은
//   타입으로만 참조한다(런타임에 그 모듈을 실행하지 않는다) — 실제 원본 배열은 항상
//   호출하는 쪽(서버 컴포넌트)이 넘겨준다.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import type { FlooringProduct } from '@/server/calc/data/flooring-products';
import type { FlooringProductOption } from './flooringQuery';

/**
 * 같은 브랜드+라인 안에서 제품을 구분하는 표시를 만든다.
 * sku가 있으면 그대로 쓰고("600×600"·"MTS6112 등"), 없으면 규격에서 만든다
 * (가로세로가 같으면 "600각", 다르면 "143×1205"). 규격도 없으면 빈 문자열.
 * 검사관 1라운드 지적 6번 — 드롭다운에서 동명 제품(NOX 오키드3000 등)이 안 구분되던 문제.
 */
function variantLabel(p: FlooringProduct): string {
  if (p.sku) return p.sku;
  if (p.widthMm != null && p.lengthMm != null) {
    return p.widthMm === p.lengthMm ? `${p.widthMm}각` : `${p.widthMm}×${p.lengthMm}`;
  }
  return '';
}

/**
 * 제품 마스터 원본 목록 → 화면이 쓰는 FlooringProductOption[].
 *   - kind가 null인 것(카펫타일·롤카펫 — 엔진 계산 규칙이 달라 화면에서 안 다룬다)은 뺀다.
 *   - usable이 false인 것(가격·규격이 없어 계산에 못 쓰는 제품)도 뺀다.
 *   - saleUnit이 '기타'인 것(파는 단위 자체가 확인 안 된 것)도 뺀다.
 *   - 롤형(장판)의 "롤 폭"은 원본에 rollWidthM 칸이 따로 없고 widthMm(mm)가 그 값을 겸한다
 *     (원본 주석: "장 폭(mm) — 장판은 롤 폭(보통 1830)"). 여기서 m로 환산해 담는다.
 */
export function toFlooringProductOptions(products: readonly FlooringProduct[]): FlooringProductOption[] {
  return products
    .filter((p) => p.kind !== null && p.usable && p.saleUnit !== '기타')
    .map((p) => {
      const isBox = p.saleUnit === 'BOX';
      return {
        code: p.id,
        brand: p.brand,
        name: p.line,
        kind: p.kind as FlooringProductOption['kind'],
        saleUnit: isBox ? ('박스' as const) : ('m' as const),
        price: p.price,
        sqmPerBox: isBox ? p.sqmPerBox : null,
        pcsPerBox: isBox ? p.pcsPerBox : null,
        widthMm: isBox ? p.widthMm : null,
        lengthMm: isBox ? p.lengthMm : null,
        rollWidthM: isBox ? null : p.widthMm != null ? p.widthMm / 1000 : null,
        thicknessMm: p.thicknessMm,
        lossRate: p.lossRate,
        variant: variantLabel(p),
      };
    });
}
