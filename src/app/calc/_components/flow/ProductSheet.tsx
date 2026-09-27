// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 제품 목록 시트
//
// 지시서 3-11절: 기본 드롭다운을 버리고 목록 시트로 바꾼다.
//   - 모바일은 아래에서 올라오는 시트(최대 화면 80%, 안에서 세로 스크롤).
//   - 데스크톱은 같은 내용의 가운데 창(폭 480px).
//   - 목록 한 줄(최소 56px): 이름(굵게) / 아랫줄 브랜드·규격 / 오른쪽 가격대.
//   - 맨 위 줄: "아직 안 정했어요" — 골라도 이 단계는 완료된다.
//   - 맨 아래 줄: "직접 입력" — 누르면 그 아래 입력 폼이 펼쳐진다.
//   - 시트 밖을 누르거나 뒤로 가기를 누르면 닫힌다. 열려 있는 동안 뒤는 스크롤 안 됨.
//   - 고르면 시트가 닫히고 단계가 완료된다(실제 완료 처리는 부르는 쪽이 한다).
//
// 2026-09-27 배포 전 검사관 지적 1번(치명) 수리 — createPortal로 문서 몸통 끝에 그린다:
//   예전엔 이 컴포넌트가 단계 카드(StepRow) 내용물 안에서 그려졌다. 도배 제품 "직접
//   입력"으로 세 칸을 다 채우면 그 순간 2단계가 "완료" 처리돼 접히고(그 안의 모든 걸
//   0높이+inert로 숨기는 StepRow 규칙), 그 안에 있던 이 시트까지 같이 숨겨지는 치명적
//   버그였다. createPortal로 항상 document.body 바로 밑에 그리면, 이 시트를 부른
//   단계가 접히든 말든 시트 자신은 전혀 영향을 안 받는다.
//
// 뒤로 가기(4-3절: "제품 시트가 열려 있을 때 뒤로 가기 = 시트만 닫힘")는 backLayer.ts의
// 쌓임 스택을 쓴다. 2026-09-27 검사관 지적 2번 수리 — 뒤로 가기가 아닌 방법(선택·바깥
// 누름·닫기·Esc)으로 닫힐 때는 collapseBackLayer()로 쌓아 둔 기록 칸까지 실제로 거둔다
// (예전엔 메모리에서만 뺐어서, 다음 뒤로 가기가 엉뚱한 칸을 건너뛰는 사고가 있었다).
//
// 2026-09-27 검사관 지적 8번(접근성) 수리:
//   - role="dialog" aria-modal="true" aria-labelledby(제목).
//   - 열릴 때 시트 안 첫 항목으로 초점, 닫힐 때 시트를 열었던 버튼으로 되돌린다.
//   - Tab 키가 시트 밖으로 안 나가게 가둔다(포커스 트랩). Esc로 닫힌다.
//
// 작성일: 2026년 09월 27일
// 포털·접근성·뒤로 가기 재설계: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck } from '@/components/v1/icons';
import { pushBackLayer, collapseBackLayer } from './backLayer';
import type { PickerItem } from './types';

/** "직접 입력" 줄을 고르면 selectedCode 자리에 이 값이 온다(다른 코드와 안 겹치게) */
export const PRODUCT_SHEET_CUSTOM = '__custom__';
/** "아직 안 정했어요" 줄을 고르면 selectedCode 자리에 이 값이 온다 */
export const PRODUCT_SHEET_UNDECIDED = '__undecided__';

export interface ProductSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: PickerItem[];
  /** 지금 골라져 있는 코드 — 목록 코드 / PRODUCT_SHEET_CUSTOM / PRODUCT_SHEET_UNDECIDED 중 하나 */
  selectedCode?: string;
  /** "아직 안 정했어요" · 목록 줄 · "직접 입력" 줄을 눌렀을 때 전부 이 하나로 온다 */
  onSelect: (code: string) => void;
  /** "직접 입력"을 골랐을 때만 그 아래에 펼쳐 보여줄 입력 폼 */
  customForm?: ReactNode;
  /**
   * "아직 안 정했어요" 줄 오른쪽에 다른 줄과 같은 모양으로 붙일 가격대(예: "0.4만~2.6만/롤").
   * 2026-09-27 검수 지적 11번 — 없으면(계산 못 했거나 목록이 비었으면) 그 자리를 비워 둔다.
   */
  undecidedPriceLabel?: string;
  /** 이 시트가 어느 계산기 소속인지(뒤로 가기 스택 정리용, 예: 'wallpaper') */
  calcId: string;
}

export default function ProductSheet({
  open,
  onClose,
  title,
  items,
  selectedCode,
  onSelect,
  customForm,
  undecidedPriceLabel,
  calcId,
}: ProductSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // 시트를 열기 직전에 초점이 있던 요소 — 닫힐 때 여기로 되돌린다(검사관 지적 8번)
  const openerRef = useRef<Element | null>(null);

  // 시트가 열려 있는 동안 뒤 배경 스크롤 막기
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // 뒤로 가기 = 시트만 닫힘(4-3절). open이 true로 바뀔 때 한 칸 쌓고, false로 바뀌면
  // (버튼 클릭 등으로 화면이 스스로 닫은 경우) collapseBackLayer로 그 칸을 실제로 거둔다.
  // closedByBackRef: 방금 "뒤로 가기 자체"가 닫은 거면 스택이 이미 알아서 정리했으니
  // collapseBackLayer를 또 부르면 안 된다 — 이 표시로 구분한다.
  const wasOpenRef = useRef(false);
  const closedByBackRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // 열리는 순간 — 지금 초점이 있던 요소(트리거 버튼)를 기억해 둔다
      openerRef.current = document.activeElement;
      pushBackLayer(calcId, () => {
        closedByBackRef.current = true;
        onClose();
      });
    } else if (!open && wasOpenRef.current) {
      if (closedByBackRef.current) {
        // 뒤로 가기가 이미 스택 정리까지 끝냈다 — 여기서 또 손대지 않는다
        closedByBackRef.current = false;
      } else {
        // 선택·바깥 누름·닫기·Esc 등 다른 방법으로 닫힘 — 쌓아 둔 기록 칸을 거둔다(제품
        // 선택처럼 같은 순간 다음 단계가 완료돼 새 칸이 쌓이면 backLayer.ts가 알아서
        // "교체"로 처리해 history를 두 번 안 건드린다 — 위 backLayer.ts 3번 설명 참고)
        collapseBackLayer(calcId);
      }
      // 초점을 시트를 열었던 곳으로 되돌린다(검사관 지적 8번)
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus({ preventScroll: true });
      }
    }
    wasOpenRef.current = open;
    // onClose는 상위에서 안정적으로 넘겨준다고 가정(useState setter 등)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, calcId]);

  // 열리면 시트 안 첫 항목(첫 버튼)으로 초점을 옮긴다(검사관 지적 8번, 3-6절과 같은 원칙 —
  // 숫자 입력칸이 아니라 버튼으로 먼저 보낸다)
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('button');
    // 포털이 이번 렌더에 막 붙었을 수 있어 다음 틱에 안전하게 포커스한다
    const t = setTimeout(() => first?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [open]);

  /** Esc로 닫기 + Tab 키를 시트 안에 가두기(포커스 트랩, 검사관 지적 8번) */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;
  // SSR·아직 document가 없는 극초반 렌더에서는 포털을 만들 수 없다(안전망)
  if (typeof document === 'undefined') return null;

  return createPortal(
    // items-end: 모바일은 화면 아래에 붙는다. md 이상은 items-center로 가운데 창이 된다(3-11절)
    // flowFocusScope: document.body에 바로 붙는 포털이라 조상 클래스를 못 물려받으므로,
    // 여기 직접 붙여 시트 줄·적용 버튼도 같은 초점 테두리 규칙을 쓰게 한다(2026-09-27 지적 5번)
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center flowFocusScope"
      onKeyDown={handleKeyDown}
    >
      {/* 어두운 배경 — 누르면 닫힌다(시트만, 뒤로 가기 스택은 collapseBackLayer로 정리) */}
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          'relative w-full bg-surface flex flex-col gap-1 overflow-y-auto flow-sheet-in ' +
          // 모바일: 아래에서 올라오는 시트, 최대 화면 80%. md 이상: 가운데 창, 폭 480px 고정
          'max-h-[80vh] rounded-t-[16px] px-4 pt-5 pb-6 ' +
          'md:max-w-[480px] md:max-h-[80vh] md:rounded-[16px]'
        }
      >
        {/* 손잡이(모바일 전용 — 아래에서 올라오는 시트라는 느낌) */}
        <span className="w-10 h-1 rounded-full bg-line self-center md:hidden" />
        <h3 id={titleId} className="t-section text-ink px-1 pt-2 pb-1">
          {title}
        </h3>

        {/* 줄 사이에 1px --line 구분선 — 2026-09-27 검수 지적 10번.
            처음엔 Tailwind의 divide-y를 썼는데 버튼 기본 스타일(테두리 0 리셋)에 눌려
            선이 실제로는 안 그려지는 걸 실측(getComputedStyle)으로 발견해, 각 줄에
            직접 border-t를 주는 방식으로 바꿨다(맨 첫 줄만 위 선을 안 그린다). */}
        <div className="flex flex-col">
          {/* 맨 위 줄 — "아직 안 정했어요": 골라도 단계는 완료된다(3-11절). 오른쪽에 그 종류
              전체 가격대를 다른 줄과 같은 모양으로 붙인다(검수 지적 11번) */}
          <SheetRow
            selected={selectedCode === PRODUCT_SHEET_UNDECIDED}
            onClick={() => onSelect(PRODUCT_SHEET_UNDECIDED)}
            title="아직 안 정했어요"
            priceLabel={undecidedPriceLabel}
            topDivider={false}
          />

          {items.map((item) => (
            <SheetRow
              key={item.code}
              selected={selectedCode === item.code}
              onClick={() => onSelect(item.code)}
              title={item.title}
              subtitle={item.subtitle}
              priceLabel={item.priceLabel}
            />
          ))}

          {/* 맨 아래 줄 — 직접 입력. 고르면 그 아래 입력 폼(customForm)이 펼쳐진다 */}
          <SheetRow
            selected={selectedCode === PRODUCT_SHEET_CUSTOM}
            onClick={() => onSelect(PRODUCT_SHEET_CUSTOM)}
            title="직접 입력"
          />
        </div>
        {selectedCode === PRODUCT_SHEET_CUSTOM && customForm && (
          <div className="px-1 pt-2 flex flex-col gap-2">{customForm}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * 시트 안 한 줄 — 최소 높이 56px, 굵은 이름 + 보조 줄 + 오른쪽 가격.
 *
 * 2026-09-27 지휘관 3차 검수 지적 2번: 구분선이 양 끝에서 아래로 휘어 보였다 — 원인은
 * border-top과 rounded-[8px]를 같은 <button>에 같이 줘서, 모서리가 둥글어지는 자리에서
 * 위 테두리 선이 둥근 모서리를 따라 휘어졌기 때문이다. 구분선(테두리)과 눌림 배경(둥근
 * 모서리)을 서로 다른 요소로 나눴다 — 바깥 div가 곧은 1px 구분선만 담당하고(모서리 둥글기
 * 0), 안쪽 button은 예전처럼 rounded-[8px] + active:bg-bg만 담당한다. 구분선의 좌우는
 * mx-1로 줄 안쪽 여백(글자가 시작·끝나는 자리)에 맞춘다.
 */
function SheetRow({
  selected,
  onClick,
  title,
  subtitle,
  priceLabel,
  topDivider = true,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  priceLabel?: string;
  /** 위쪽에 1px --line 구분선을 그릴지 — 맨 첫 줄만 false로 넘긴다 */
  topDivider?: boolean;
}) {
  return (
    // 2026-09-27 지휘관 4차 검수 지적 1번 수리: mx-1은 구분선 유무와 상관없이 항상 주고,
    // border-t만 topDivider로 켜고 끈다 — 그래야 모든 줄의 좌우 위치가 똑같아진다.
    <div className={'mx-1' + (topDivider ? ' border-t border-line' : '')}>
      <button
        type="button"
        onClick={onClick}
        className="w-full min-h-[56px] flex items-center gap-3 py-2 text-left rounded-[8px] active:bg-bg"
      >
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="t-body font-semibold text-ink truncate">{title}</span>
          {subtitle && <span className="t-sub text-ink-2 truncate">{subtitle}</span>}
        </span>
        {priceLabel && <span className="t-sub text-ink-2 flex-none">{priceLabel}</span>}
        {selected && (
          <span className="flex-none w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
            <IconCheck />
          </span>
        )}
      </button>
    </div>
  );
}
