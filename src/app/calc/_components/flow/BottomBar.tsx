// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 하단 고정 바 (모바일 전용, 56px)
//
// 지시서 3-9절 표 그대로:
//   결과 없음(첫 단계 고르기 전)  — 왼쪽 "1/3 · 단계 제목", 오른쪽 버튼 없음
//   결과 있음(진행 중)            — 왼쪽 "2/3 · 금액범위", 오른쪽 [자세히]
//   전부 완료                     — 왼쪽 "금액범위"(단계 표시 없음), 오른쪽 [자세히]
//   계산 중(옛 값을 보여주는 중)  — 금액을 투명도 50%로, 나머지는 그대로
//   계산 실패                     — "계산하지 못했어요" + [다시]
//
// 안내 문장은 없다(설명글 최소화 원칙) — 진행 표시와 금액만.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import Button from '@/components/v1/Button';

export interface BottomBarProps {
  /** 지금 몇 번째 단계인지(1-based로 이미 계산해 넘겨준다) */
  stepNumber: number;
  stepCount: number;
  /** 현재 단계 제목 — 결과가 아직 없을 때만 쓴다 */
  stepTitle: string;
  /** 화면에 보여줄 금액 범위 문자열(예: "246만~308만원"). 없으면 아직 결과가 없다는 뜻 */
  amountText?: string;
  /**
   * 'area'가 가정일 때만 넘어오는 "34평 가정" 한 마디(assumptionText.ts의
   * describeWallpaperBottomBarAssumption). 그 외 가정(제품 미정·실측 입력 중 등)은 결과
   * 카드에서만 보여주고 하단 바에는 안 띄운다(2026-09-27 검수 지적 1번 — 자리가 좁다).
   * 폭이 모자라면(360px 등) 아예 안 그린다(말줄임 아님) — CSS로 최소폭 기준을 둔다.
   */
  assumedNote?: string;
  /** 전부 완료됐는지 — true면 왼쪽에서 "N/M ·" 접두어를 뗀다 */
  allDone: boolean;
  /** 지금 계산 중이거나 이전 값을 보여주는 중인지 — true면 금액을 옅게 */
  calculating: boolean;
  /** 마지막 계산이 실패했는지 */
  failed: boolean;
  /** [자세히] — 결과 카드로 스크롤 이동 */
  onDetail: () => void;
  /** [다시] — 계산 실패했을 때 다시 시도 (없으면 버튼을 안 그린다) */
  onRetry?: () => void;
}

export default function BottomBar({
  stepNumber,
  stepCount,
  stepTitle,
  amountText,
  assumedNote,
  allDone,
  calculating,
  failed,
  onDetail,
  onRetry,
}: BottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 bg-surface border-t border-line flex items-center justify-between gap-3 px-4 lg:hidden z-40">
      {failed ? (
        <>
          <span className="t-body text-ink">계산하지 못했어요</span>
          <Button variant="primary" className="!h-11 !px-4 !text-[14px] flex-none" onClick={onRetry}>
            다시
          </Button>
        </>
      ) : amountText ? (
        <>
          {/* 결과가 있는 상태 — 계산 중이면(옛 값을 보여주는 중) 금액만 옅게 한다 */}
          <span className={'min-w-0 flex items-baseline gap-1 tabular-nums transition-opacity duration-150 ' + (calculating ? 'opacity-50' : '')}>
            {!allDone && (
              <span className="t-sub text-ink-2 flex-none">
                {stepNumber}/{stepCount} ·
              </span>
            )}
            <span className="t-body font-semibold text-accent truncate">{amountText}</span>
            {/* "34평 가정" 한 마디로 줄인 뒤로는 360·390px 둘 다 자리가 충분해 보통은 보인다.
                아주 좁은 화면(320px 미만, 폴더폰 등)에서만 통째로 숨긴다(말줄임 아님) —
                지시서 "폭이 모자라면 아예 그리지 않는다"를 안전망으로 남겨 둔 것이다. */}
            {assumedNote && <span className="hidden min-[320px]:inline t-sub text-ink-2 flex-none">{assumedNote}</span>}
          </span>
          <Button variant="primary" className="!h-11 !px-4 !text-[14px] flex-none" onClick={onDetail}>
            자세히
          </Button>
        </>
      ) : (
        // 아직 결과가 없다(첫 단계도 안 골랐다) — 진행 표시만, 버튼은 그리지 않는다
        <span className="t-sub text-ink-2">
          {stepNumber}/{stepCount} · {stepTitle}
        </span>
      )}
    </div>
  );
}
