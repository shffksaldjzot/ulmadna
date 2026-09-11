// ──────────────────────────────────────────────
// 공용 상단바 — 홈(/)·v1 허브·계산기·결과·로그인 화면이 전부 이 하나를 쓴다
//
// 2026-09-09 형아 지시: "v1도, 계산기 페이지도 상단바가 랜딩 페이지와 통일이 안 돼 있다.
// 기능하고 디자인 통일해라. 얼마드나 로고 누르면 메인 페이지(https://ulmadna.com/)로."
//   → 예전 v1 전용 내비(로고→/v1, 메뉴, 검색창, 내 정보)를 버리고 홈 헤더 디자인을 그대로 쓴다.
//   로고 → "/" · 무료 배지 · [블로그] · 로그인/내 견적서/로그아웃(세션 있으면).
//
// 하위 페이지(계산기·가입 등)는 title/backHref 를 주면 모바일에서 헤더 아래에
// "← 제목" 한 줄이 더 붙는다(PC는 헤더만). rightSlot 은 그 줄 오른쪽 버튼 자리.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { IconBack } from './icons';

interface TopNavProps {
  /** 뒤로가기 화살표 + 제목 줄(모바일)을 붙이는 하위 페이지용 */
  title?: string;
  backHref?: string;
  /** 제목 줄 오른쪽에 텍스트 버튼(예: "조건 바꾸기")을 붙이고 싶을 때 */
  rightSlot?: React.ReactNode;
}

export default function TopNav({ title, backHref, rightSlot }: TopNavProps) {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      {/* ── 홈 헤더와 같은 한 줄 (로고 · 무료 배지 · 블로그 · 로그인) ── */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 로고는 항상 메인 페이지로 */}
          <Link href="/" aria-label="얼마드나 메인으로">
            <Image src="/ulmadna_logo.png" alt="얼마드나" width={130} height={44} priority className="cursor-pointer" />
          </Link>
          <span className="hidden md:inline-block text-[10px] text-gray-400 border border-gray-200 rounded-full px-3 py-1">
            {/* 2026-09-09 형아 지시: "회원가입 없음" 대신 "개인정보 없음" */}
            완전 무료 · 개인정보 없음 · 전화번호 없음
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/blog"
            className="text-xs font-semibold text-gray-600 hover:text-brown border border-gray-200 px-4 py-2 rounded-full transition-colors"
          >
            블로그
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/my-estimates"
                className="text-xs text-gray-500 hover:text-brown border border-gray-200 px-4 py-2 rounded-full transition-colors"
              >
                내 견적서
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-xs text-gray-400 hover:text-brown transition-colors"
              >
                로그아웃
              </button>
              <span className="text-xs text-brown font-medium">{session.user.name}님</span>
            </>
          ) : (
            <>
              <span className="hidden sm:block text-xs text-gray-400">완전 무료 · 개인정보 없음</span>
              <Link
                href="/login"
                className="text-xs text-gray-500 hover:text-brown border border-gray-200 px-4 py-2 rounded-full transition-colors"
              >
                로그인
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── 하위 페이지 제목 줄 (모바일만) ── */}
      {title && (
        <div className="lg:hidden border-t border-gray-100 px-4 h-11 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={backHref ?? '/calc'} aria-label="뒤로가기" className="text-brown flex-none">
              <IconBack />
            </Link>
            <h1 className="text-[18px] font-bold text-foreground truncate">{title}</h1>
          </div>
          {rightSlot}
        </div>
      )}
    </header>
  );
}
