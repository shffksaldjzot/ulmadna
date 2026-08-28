// ──────────────────────────────────────────────
// v1 허브 — 바텀시트 부품 (지역 선택 등 선택형 입력에 공용)
// 화면 하단에서 올라오는 시트. 손잡이 + 제목 + 내용 + 닫기.
// ──────────────────────────────────────────────

'use client';

import { useEffect, type ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  // 시트가 열려 있는 동안 뒤 배경 스크롤을 막는다
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 어두운 배경 — 누르면 닫힘 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 transition-opacity duration-250 motion-reduce:transition-none"
      />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-[4px] shadow-lg px-4 pt-5 pb-6 flex flex-col gap-3 max-h-[70vh] overflow-y-auto animate-[v1-sheet-up_250ms_ease-out] motion-reduce:animate-none"
      >
        <span className="w-10 h-1 rounded-full bg-v1-line self-center" />
        <h3 className="text-[20px] font-bold text-foreground">{title}</h3>
        {children}
      </div>
      <style>{`
        @keyframes v1-sheet-up {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
