// ──────────────────────────────────────────────
// v1 허브 — 계산기 공용: "면적을 아직 안 골랐어요" 자리 카드
//
// 2026년 10월 29일 형아 지시 — 면적(또는 그에 해당하는 첫 핵심 입력: 실측·구역·치수)을
// 사용자가 손으로 정하기 전에는 견적 금액을 어디에도 보이지 않는다. 계산 자체는 기본값
// (34평 가정 등)으로 미리 돌려 두지만, 그 결과 카드 자리에는 금액 대신 이 한 줄만 보여 준다.
// 면적을 고르는 즉시 원래 결과 카드로 바뀐다(토스식 즉답 유지).
//
// 설명글 최소화 원칙 — 캡션 한 줄만.
//
// 작성일: 2026년 10월 29일
// ──────────────────────────────────────────────

import Card from '@/components/v1/Card';

export interface AreaPendingCardProps {
  /** 카드에 보여 줄 한 줄(예: "면적을 고르면 바로 나와요") */
  text: string;
}

/** 금액 대신 보여 주는 한 줄 카드 — 결과 카드와 같은 자리·같은 틀을 쓴다 */
export default function AreaPendingCard({ text }: AreaPendingCardProps) {
  return (
    <Card data-area-pending="">
      <p className="t-body text-ink-2">{text}</p>
    </Card>
  );
}
