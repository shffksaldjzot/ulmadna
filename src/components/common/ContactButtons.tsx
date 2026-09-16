// ──────────────────────────────────────────────
// 전화·카톡 문의 버튼 — 서비스 카드·블로그 글 하단 카드·계산기 결과·문의 시트가 전부 이걸 쓴다.
//
// 크기는 새로 만들지 않고 v1/Chip.tsx가 이미 쓰던 두 크기(md: h-9/px-14/14, sm: h-8/px-10/13)를
// 그대로 가져다 쓴다(형아 지시 — 칩 크기 그대로).
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

"use client";

import { CONTACT_PHONE_TEL, CONTACT_PHONE_DISPLAY, CONTACT_KAKAO_URL, trackContactClick, type ContactPlace } from "@/lib/contact";

export interface ContactButtonsProps {
  /** 이 버튼이 어떤 서비스에 달려 있는지(services.ts slug). 서비스와 무관하면 'none' */
  service: string;
  /** 버튼이 있는 위치 — 추적 파라미터 place=에 그대로 실린다 */
  place: ContactPlace;
  /** true면 전화 버튼만 보여준다(유선 상담 전용 항목 — 인테리어 컨설팅 등) */
  phoneOnly?: boolean;
  /** 버튼 크기. 'sm'(기본, Chip 'sm'과 동일 h-8) — 카드 안 작은 버튼 / 'md'(Chip 'md'와 동일 h-9) */
  size?: "sm" | "md";
  className?: string;
}

export default function ContactButtons({
  service,
  place,
  phoneOnly = false,
  size = "sm",
  className = "",
}: ContactButtonsProps) {
  // Chip.tsx의 sm/md 크기 클래스를 그대로 가져옴 — 새 크기를 만들지 않는다
  const sizeClass = size === "md" ? "h-9 px-[14px] text-[14px]" : "h-8 px-[10px] text-[13px]";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 전화 — 항상 있음. tel: 링크는 탭하는 순간 바로 전화 앱으로 넘어가므로
          클릭 핸들러에서 추적만 하고 preventDefault는 하지 않는다 */}
      <a
        href={CONTACT_PHONE_TEL}
        onClick={() => trackContactClick("phone", service, place)}
        className={`inline-flex items-center justify-center ${sizeClass} rounded-chip bg-accent text-white font-semibold whitespace-nowrap hover:opacity-90 transition-opacity`}
        aria-label={`전화 문의 ${CONTACT_PHONE_DISPLAY}`}
      >
        전화
      </a>
      {/* 카톡 — 유선 상담 전용 항목(인테리어 컨설팅)에는 안 보여준다 */}
      {!phoneOnly && (
        <a
          href={CONTACT_KAKAO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackContactClick("kakao", service, place)}
          className={`inline-flex items-center justify-center ${sizeClass} rounded-chip border border-line text-ink font-semibold whitespace-nowrap hover:border-accent hover:text-accent transition-colors`}
          aria-label="카카오톡 오픈채팅으로 문의"
        >
          카톡
        </a>
      )}
    </div>
  );
}
