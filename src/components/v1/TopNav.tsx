// ──────────────────────────────────────────────
// 계산기 하위 화면 제목 줄 — "← 도배 계산기" (모바일 전용)
//
// 2026-09-15 형아 지시(디자인 통일 작업 A): 예전엔 이 컴포넌트가 상단바 전체(로고·메뉴·
// 로그인)까지 다 그렸는데, 그러다 보니 화면마다 상단바가 미묘하게 달라졌다. 이제 상단바
// 본체는 공용 SiteHeader가 calc/layout.tsx에서 한 번만 그리고, 이 컴포넌트는 그 아래
// "← 제목" 한 줄(모바일에서만, 하위 계산기 화면에만)만 담당한다.
//
// 계산기 화면들(WallpaperCalculator.tsx 등, 다른 담당자 작업 영역)은 이 컴포넌트를
// 그대로 <TopNav title="..." backHref="..." as="p" /> 형태로 부르고 있어서 — props
// 시그니처(title/backHref/rightSlot/as)는 그대로 유지해 그 파일들을 고칠 필요가 없게 했다.
// title이 없으면(예: 옛 <TopNav /> 단독 호출) 그릴 게 없으므로 null을 반환한다.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { IconBack } from './icons';

interface TopNavProps {
  /** 뒤로가기 화살표 + 제목 줄(모바일)을 붙이는 하위 페이지용 */
  title?: string;
  backHref?: string;
  /** 제목 줄 오른쪽에 텍스트 버튼(예: "조건 바꾸기")을 붙이고 싶을 때 */
  rightSlot?: React.ReactNode;
  /**
   * 제목 줄의 글자를 어떤 태그로 그릴지 (기본 h1).
   * 계산기 페이지(wallpaper·flooring·mortar)는 서버 컴포넌트에 검색엔진용 진짜 h1을
   * 따로 심어놔서, 한 페이지에 h1이 2개가 되지 않도록 "p"를 넘겨 받는다.
   */
  as?: 'h1' | 'p' | 'div';
}

export default function TopNav({ title, backHref, rightSlot, as = 'h1' }: TopNavProps) {
  // 제목이 없으면(옛 헤더 단독 호출 자리) 더 그릴 게 없다 — 상단바 본체는 SiteHeader 몫
  if (!title) return null;

  const TitleTag = as;

  return (
    <div className="lg:hidden sticky top-14 z-40 bg-surface border-b border-line px-5 h-11 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Link href={backHref ?? '/calc'} aria-label="뒤로가기" className="text-brown flex-none">
          <IconBack />
        </Link>
        <TitleTag className="t-section text-ink truncate">{title}</TitleTag>
      </div>
      {rightSlot}
    </div>
  );
}
