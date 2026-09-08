// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 즉답 블록
// 평형 하나만 넣으면 그 자리에서 바로 범위 견적이 뜨는 첫 화면 (설계 정본 0-C절 제1 차별점).
//
// ※ B 지시서(즉답·결과 화면)가 이 파일 내부를 채운다. 지금은 props 계약만 확정하고
//   최소 렌더(제목 + 받은 값 요약)만 넣어 둔다.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import type { WallpaperRange } from '@/lib/v1/useWallpaperCalc';

export interface QuickAnswerProps {
  /** 평형 입력값. 칩(18·24·25·30·34·40·45) + 직접 입력 겸용 */
  pyeong: number | '';
  onPyeongChange: (v: number | '') => void;
  /** 베이 수(2·3·4). 기본 3 */
  bay: 2 | 3 | 4;
  onBayChange: (v: 2 | 3 | 4) => void;
  /** 즉답 금액 범위. 벽지 종류를 아직 안 고르면 합지~실크 폭까지 넓게 잡힌 값이 들어온다 */
  range: WallpaperRange | null;
  loading: boolean;
}

/** B 지시서가 칩·큰 숫자·"더 정확하게 →" 링크로 채울 자리. 지금은 뼈대만 렌더한다. */
export default function QuickAnswer({ pyeong, bay, range, loading }: QuickAnswerProps) {
  return (
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">즉답 (B 지시서 예정)</h2>
      <p className="text-[14px] text-v1-text-secondary tabular-nums">
        평형 {pyeong || '미입력'} · {bay}베이 ·{' '}
        {loading ? '계산 중' : range ? `${range.min.toLocaleString('ko-KR')}~${range.max.toLocaleString('ko-KR')}원` : '결과 없음'}
      </p>
    </Card>
  );
}
