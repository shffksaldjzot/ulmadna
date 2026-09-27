// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 제품 시트의 뒤로·앞으로 가기 훅
//
// 2026-09-27 검사관 7차 지적(치명) 수리 — "모드 카드에 다녀오면 시트 칸이 죽는다":
//   예전엔 이 push/collapse 로직이 ProductSheet.tsx 안, 시트를 여닫는 sheetOpen state와
//   함께 PaperPicker(제품 고르기 부품) 안에 있었다. 그런데 모드 카드로 돌아가면 단계
//   화면 전체가 사라지며 PaperPicker도 통째로 사라진다(리액트가 언마운트). backLayer.ts
//   에 쌓아 둔 시트 칸의 onForward는 그 순간의 PaperPicker 인스턴스가 만든
//   "onReopen"(그 인스턴스의 useState 설정 함수를 가리키는 클로저)을 그대로 붙들고
//   있는데, 모드를 다시 골라 화면이 되살아나도 그건 완전히 새 PaperPicker 인스턴스라
//   옛 클로저는 죽은 인스턴스를 가리킨 채 불려도 아무 효과가 없었다.
//
//   고침: 시트 열림 상태(sheetOpen)와 이 push/collapse 감시 로직 자체를 절대 사라지지
//   않는 최상위 계산기 부품(WallpaperCalculator)으로 올린다. 이 훅은 그 최상위에서
//   딱 한 번(마운트~언마운트 내내 안정적으로) 불리므로, 안에 담기는 클로저도 항상
//   "지금 살아 있는" onClose/onReopen을 가리킨다 — 모드 카드를 오가도 안 죽는다.
//
//   ProductSheet.tsx는 이제 이 로직을 안 갖는다(순수 표시 전용 — open/onClose만 받아
//   그리기만 한다). 부르는 쪽(계산기)이 sheetOpen state를 만들고, 이 훅에
//   { calcId, open: sheetOpen, onClose: () => setSheetOpen(false), onReopen: () =>
//   setSheetOpen(true) }를 넘기면 된다. 바닥재·미장 등 다른 계산기도 이 훅을 그대로
//   가져다 쓰면 된다(공용 규칙).
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import { pushBackLayer, collapseBackLayer } from './backLayer';

export interface UseSheetBackNavOptions {
  /** 이 시트가 어느 계산기 소속인지(뒤로 가기 스택 정리용, 예: 'wallpaper') */
  calcId: string;
  /** 지금 시트가 열려 있는지 — 이 값을 최상위 부품(계산기)이 갖고 있어야 한다 */
  open: boolean;
  /** 뒤로 가기로 이 시트 칸을 되돌릴 때 부른다 — 보통 setSheetOpen(false) */
  onClose: () => void;
  /** 앞으로 가기로 이 시트 칸에 다시 도착했을 때 부른다 — 보통 setSheetOpen(true) */
  onReopen: () => void;
}

/**
 * 제품 시트의 열림·닫힘을 뒤로·앞으로 가기 스택(backLayer.ts)에 연결하는 훅.
 *
 * **반드시 절대 언마운트되지 않는 부품(계산기 최상위)에서 불러야 한다.** PaperPicker처럼
 * 모드 카드로 돌아가면 사라지는 부품 안에서 부르면, 모드 카드에 다녀온 뒤 시트 칸의
 * 앞으로 가기가 죽은 클로저를 가리키게 되는 이번 수리 대상 버그가 재발한다.
 *
 * 뒤로 가기 = 시트만 닫힘(onClose). 앞으로 가기 = 시트를 다시 엶(onReopen, 뒤로=닫힘과
 * 대칭 — 2026-09-27 검사관 5차 지적으로 확정된 지시).
 */
export function useSheetBackNav({ calcId, open, onClose, onReopen }: UseSheetBackNavOptions): void {
  // 직전 렌더의 open 값 — true→false, false→true 전환 시점만 잡아내려고 쓴다
  const wasOpenRef = useRef(false);
  // "방금 뒤로 가기 자체"가 이미 닫은 거면 collapseBackLayer를 또 부르면 안 된다는 표시
  const closedByBackRef = useRef(false);
  // "이번 open=true는 앞으로 가기가 만든 것"이라 새 칸을 또 쌓으면 안 된다는 표시
  const reopenedByForwardRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      if (reopenedByForwardRef.current) {
        // 앞으로 가기가 다시 연 것 — 이미 이 기록 칸에 서 있으므로 새로 안 쌓는다
        reopenedByForwardRef.current = false;
      } else {
        // 사용자가 직접 연 것(트리거 버튼 등) — 한 칸 쌓는다
        pushBackLayer(
          calcId,
          () => {
            closedByBackRef.current = true;
            onClose();
          },
          () => {
            reopenedByForwardRef.current = true;
            onReopen();
          },
        );
      }
    } else if (!open && wasOpenRef.current) {
      if (closedByBackRef.current) {
        // 뒤로 가기가 이미 스택 정리까지 끝냈다 — 여기서 또 손대지 않는다
        closedByBackRef.current = false;
      } else {
        // 선택·바깥 누름·닫기·Esc 등 다른 방법으로 닫힘 — 쌓아 둔 기록 칸을 실제로 거둔다
        collapseBackLayer(calcId);
      }
    }
    wasOpenRef.current = open;
    // onClose/onReopen은 부르는 쪽(계산기 최상위)이 안정적으로 넘겨준다고 가정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, calcId]);
}
