// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 벽지 선택
// 합지/실크 세그먼트 + 제품 검색(제품 마스터 목록) + 직접 입력. 미선택이면 종류 평균가,
// 종류까지 미선택이면(즉답 단계) 합지·실크 범위를 합쳐 보여준다(useWallpaperCalc가 처리).
//
// ※ C 지시서(정밀 폼 화면)가 이 파일 내부를 채운다. 지금은 props 계약만 확정하고
//   최소 렌더(제목 + 받은 값 요약)만 넣어 둔다.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import type { WallpaperProductOption } from '@/lib/v1/wallpaperQuery';

export interface PaperPickerProps {
  /** 벽지 종류. undefined면 아직 안 고른 상태(즉답 단계 기본) */
  paperType: '합지' | '실크' | undefined;
  onPaperTypeChange: (v: '합지' | '실크' | undefined) => void;

  /** 제품 마스터에서 고른 제품 코드. 고르면 그 제품 규격·가격으로 계산한다 */
  productCode: string | undefined;
  onProductCodeChange: (v: string | undefined) => void;

  /** page.tsx가 서버 제품 마스터에서 골라 내려준 목록 (규격·가격 미확인인 제품은 null 칸 포함) */
  products: WallpaperProductOption[];
}

/** C 지시서가 세그먼트·제품 검색·직접 입력으로 채울 자리. 지금은 뼈대만 렌더한다. */
export default function PaperPicker({ paperType, productCode, products }: PaperPickerProps) {
  const picked = products.find((p) => p.code === productCode);
  return (
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">벽지 (C 지시서 예정)</h2>
      <p className="text-[14px] text-v1-text-secondary tabular-nums">
        {paperType ?? '미선택'} · {picked ? `${picked.brand} ${picked.name}` : '제품 미선택'} · 제품 {products.length}건 보유
      </p>
    </Card>
  );
}
