// ─────────────────────────────────────────────────────────────
// 계산기 화면용 광고 자리 — 2026년 10월 29일
//
// [무슨 기능인가]
//   공정 계산기(도배·바닥재·타일·미장·타일 물량)에 광고 자리(AdSlot)를 놓을 때 쓰는 얇은 감싸개.
//   - show=false(면적을 고르기 전 등 결과가 아직 안 보일 때)면 자리도 그리지 않는다.
//   - 단, 자리 전체 표시 모드(?ad_preview=all + 관리자)에서는 결과 전에도 점선 표시판을 보여 준다
//     (관리자가 자리 위치를 확인하는 용도).
//   - 공정 스폰서(AD-P)는 계산기 한 화면에 1개뿐이라 노출 순서를 0으로 고정한다.
//   - 광고 전역 스위치(ADS_ENABLED)가 꺼져 있으면 AdSlot 이 접혀서 일반 방문자에겐 아무것도 안 보인다.
// ─────────────────────────────────────────────────────────────
'use client';

import AdSlot from './AdSlot';
import { useAdMapMode } from '@/lib/ads/useServedAd';
import type { AdSlotId } from '@/lib/ads/types';

interface CalcAdSlotProps {
  id: AdSlotId;
  /** AD-P 전용 — 공정 이름(CALC_AD_PROCESS 값, 홈 공정 목록과 같은 글자) */
  processGroup?: string;
  /** 결과가 보이는 중인지(면적 전 금액 숨김 상태와 맞물림) */
  show: boolean;
  /** PC(lg 이상)에서만 보이는 자리(계산기 AD-H) */
  desktopOnly?: boolean;
}

export default function CalcAdSlot({ id, processGroup, show, desktopOnly = false }: CalcAdSlotProps) {
  // 표시 모드면 결과 전에도 자리를 보여 준다(관리자 확인용)
  const mapMode = useAdMapMode();
  if (!show && !mapMode) return null;
  return (
    <AdSlot
      id={id}
      processGroup={processGroup}
      adPPageIndex={id === 'AD-P' ? 0 : undefined}
      desktopOnly={desktopOnly}
    />
  );
}
