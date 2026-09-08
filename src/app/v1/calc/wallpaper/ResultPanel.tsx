// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 결과 패널
// 물량 먼저, 비용 다음(설계 정본 0절). PC에서는 입력 오른쪽에 sticky로 붙는다.
//
// ※ B 지시서(즉답·결과 화면)가 이 파일 내부를 채운다. 지금은 props 계약만 확정하고
//   최소 렌더(제목 + 받은 값 요약)만 넣어 둔다.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import type { WallpaperCalcResultDTO, WallpaperRange } from '@/lib/v1/useWallpaperCalc';

export interface ResultPanelProps {
  /** 마지막 성공 결과 (물량·부자재·비용 구성 전부 포함) */
  result: WallpaperCalcResultDTO | null;
  /** 결과 화면 큰 숫자에 쓰는 금액 범위 */
  range: WallpaperRange | null;
  loading: boolean;
  error: string | null;
  /** true면 지금 보이는 값이 최신 입력 이전 값이라는 뜻(깜빡임 방지용 표시) */
  stale: boolean;
}

/** B 지시서가 카드1(물량)·카드2(부자재)·카드3(비용)으로 채울 자리. 지금은 뼈대만 렌더한다. */
export default function ResultPanel({ result, range, loading, error, stale }: ResultPanelProps) {
  return (
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">결과 (B 지시서 예정)</h2>
      <p className="text-[14px] text-v1-text-secondary tabular-nums">
        {error
          ? error
          : !result
            ? loading
              ? '계산 중'
              : '평형을 입력하면 결과가 뜹니다'
            : `${result.quantity.rolls}롤 · ${range ? `${range.min.toLocaleString('ko-KR')}~${range.max.toLocaleString('ko-KR')}원` : ''}${stale ? ' (이전 값)' : ''}`}
      </p>
    </Card>
  );
}
