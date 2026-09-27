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
// 뒤로 가기(4-3절: "제품 시트가 열려 있을 때 뒤로 가기 = 시트만 닫힘")는 backLayer.ts의
// 쌓임 스택을 그대로 쓴다 — 시트가 열릴 때 한 칸 쌓아 두고, 사용자가 브라우저 뒤로 가기를
// 누르면 그 칸이 꺼지면서 onClose만 불린다(단계 흐름 쪽 스택은 안 건드린다).
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { IconCheck } from '@/components/v1/icons';
import { pushBackLayer, dropBackLayer } from './backLayer';
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
}

export default function ProductSheet({ open, onClose, title, items, selectedCode, onSelect, customForm }: ProductSheetProps) {
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
  // (버튼 클릭 등으로 화면이 스스로 닫은 경우) 쌓아 둔 칸을 조용히 비운다.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      pushBackLayer(onClose);
    } else if (!open && wasOpenRef.current) {
      dropBackLayer();
    }
    wasOpenRef.current = open;
    // onClose는 상위에서 안정적으로 넘겨준다고 가정(useState setter 등)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    // items-end: 모바일은 화면 아래에 붙는다. md 이상은 items-center로 가운데 창이 된다(3-11절)
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* 어두운 배경 — 누르면 닫힌다(시트만, 뒤로 가기 스택은 dropBackLayer로 정리) */}
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />

      <div
        className={
          'relative w-full bg-surface flex flex-col gap-1 overflow-y-auto flow-sheet-in ' +
          // 모바일: 아래에서 올라오는 시트, 최대 화면 80%. md 이상: 가운데 창, 폭 480px 고정
          'max-h-[80vh] rounded-t-[16px] px-4 pt-5 pb-6 ' +
          'md:max-w-[480px] md:max-h-[80vh] md:rounded-[16px]'
        }
      >
        {/* 손잡이(모바일 전용 — 아래에서 올라오는 시트라는 느낌) */}
        <span className="w-10 h-1 rounded-full bg-line self-center md:hidden" />
        <h3 className="t-section text-ink px-1 pt-2 pb-1">{title}</h3>

        {/* 맨 위 줄 — "아직 안 정했어요": 골라도 단계는 완료된다(3-11절) */}
        <SheetRow
          selected={selectedCode === PRODUCT_SHEET_UNDECIDED}
          onClick={() => onSelect(PRODUCT_SHEET_UNDECIDED)}
          title="아직 안 정했어요"
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
        {selectedCode === PRODUCT_SHEET_CUSTOM && customForm && (
          <div className="px-1 pt-2 flex flex-col gap-2">{customForm}</div>
        )}
      </div>
    </div>
  );
}

/** 시트 안 한 줄 — 최소 높이 56px, 굵은 이름 + 보조 줄 + 오른쪽 가격 */
function SheetRow({
  selected,
  onClick,
  title,
  subtitle,
  priceLabel,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  priceLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[56px] flex items-center gap-3 px-1 py-2 text-left rounded-[8px] active:bg-bg"
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
  );
}
