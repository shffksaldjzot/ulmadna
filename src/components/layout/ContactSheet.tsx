// ──────────────────────────────────────────────
// 공용 문의 시트 — 헤더 "문의" 알약, 하단 탭 "문의"가 여는 하단 시트.
// 전화 / 카톡 / 서비스 보기 세 줄 + 닫기. app/layout.tsx에 딱 한 번만 마운트한다
// (열림 상태는 lib/contactSheet.ts의 작은 전역 저장소가 관리 — 그 파일 주석 참고).
//
// 접근성: ESC로 닫힘, 배경을 탭해도 닫힘, role="dialog" + aria-modal.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { closeContactSheet, useContactSheetState } from "@/lib/contactSheet";
import { CONTACT_PHONE_TEL, CONTACT_PHONE_DISPLAY, CONTACT_KAKAO_URL, trackContactClick } from "@/lib/contact";
import { IconClose } from "@/components/v1/icons";

export default function ContactSheet() {
  const { open, place } = useContactSheetState();

  // ESC 키로 닫기 — 시트가 열려 있을 때만 리스너를 붙인다
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContactSheet();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="문의하기">
      {/* 배경 — 탭하면 닫힘 */}
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/40"
        onClick={closeContactSheet}
      />
      <div
        className="relative w-full max-w-[480px] bg-surface rounded-t-[20px] border-t border-line px-5 pt-3 flex flex-col"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* 잡는 손잡이 표시 — 시각적 힌트, 기능 없음 */}
        <div className="mx-auto w-10 h-1 rounded-full bg-line mt-1 mb-2" aria-hidden="true" />

        <div className="flex items-center justify-between mb-1">
          <span className="t-section text-ink">문의하기</span>
          <button
            type="button"
            onClick={closeContactSheet}
            aria-label="닫기"
            className="text-ink-2 hover:text-ink p-2 -m-2"
          >
            <IconClose />
          </button>
        </div>

        <a
          href={CONTACT_PHONE_TEL}
          onClick={() => trackContactClick("phone", "none", place)}
          className="flex items-center justify-between t-body font-semibold text-ink py-4 border-b border-line"
        >
          전화 문의
          <span className="t-sub text-ink-2 font-normal">{CONTACT_PHONE_DISPLAY}</span>
        </a>
        <a
          href={CONTACT_KAKAO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackContactClick("kakao", "none", place)}
          className="flex items-center justify-between t-body font-semibold text-ink py-4 border-b border-line"
        >
          카톡 문의
          <span className="t-sub text-ink-2 font-normal">바로 채팅</span>
        </a>
        <Link
          href="/service"
          onClick={closeContactSheet}
          className="flex items-center justify-between t-body font-semibold text-ink py-4"
        >
          서비스 보기
          <span className="text-ink-2" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
