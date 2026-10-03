// ──────────────────────────────────────────────
// 계산기 페이지 공용 — 폼 아래에 붙는 SEO 본문 섹션 (서버 컴포넌트)
//
// [왜 만들었나]
// /calc/wallpaper, /calc/flooring 같은 계산기 페이지는 실제 폼·결과가
// searchParams를 쓰는 클라이언트 컴포넌트(Suspense fallback=null) 안에 있어서,
// 검색엔진이 맨 처음 받는 HTML에는 글자가 거의 없었다(진단: 본문 13자, H1 0개).
// 이 컴포넌트는 서버에서 항상 그대로 그려지는 자리에 "이 계산기는 이렇게 계산해요"
// 설명 + 자주 묻는 질문 + 관련 글 링크를 심어서, 크롤러도 사람도 읽을 내용이 있게 한다.
//
// [화면 원칙]
// 형아 디자인 원칙(설명글 최소화)에 맞춰 기본은 접힌 상태(<details>)로 둔다.
// 네이티브 details/summary는 접혀 있어도 DOM에는 항상 들어있어서 구글이 그대로 읽는다
// (JS로 아예 안 그리는 방식과 다름 — 이건 "숨김"이 아니라 "접힘"이다).
//
// [소제목] 접힘 칸 제목은 <h2>로 감싼다(글자 모양은 그대로, inline). 검색엔진이 이 페이지의
// 소제목 구조를 읽을 수 있게 — 2026년 10월 03일 검색 노출 작업
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import Link from "next/link";
import type { ReactNode } from "react";

export interface CalcFaqItem {
  q: string;
  a: string;
}

export interface CalcRelatedLink {
  href: string;
  label: string;
}

/**
 * 계산 근거와 자주 묻는 질문 사이에 끼우는 추가 접힘 칸 하나(선택).
 * 예: 미장 계산기의 "몰탈 계산기 쓰는 법"·"두께별 포 수 표" (2026-10-03 검색 노출 작업)
 */
export interface CalcSeoExtraSection {
  /** 접힘 칸 제목 (검색엔진이 소제목으로 읽는다) */
  title: string;
  /** 펼쳤을 때 보이는 내용 — 문단·표 등 */
  content: ReactNode;
}

interface CalcSeoSectionProps {
  /** "이 계산기는 이렇게 계산해요" 본문 (200~300자) */
  intro: string;
  /** 계산 근거 칸 제목을 바꾸고 싶을 때(선택). 안 주면 "이 계산기는 이렇게 계산해요" */
  introTitle?: string;
  /** 계산 근거 아래 추가 접힘 칸들(선택). 안 주면 예전과 똑같이 그린다 */
  sections?: CalcSeoExtraSection[];
  faqs: CalcFaqItem[];
  related: CalcRelatedLink[];
}

export default function CalcSeoSection({ intro, introTitle, sections, faqs, related }: CalcSeoSectionProps) {
  return (
    // pb-24: 모바일 하단 고정 요약 바(h-14, WallpaperCalculator·FlooringCalculator 쪽)에
    // 마지막 관련 글 링크가 가려지지 않게 여유를 둔다. PC는 그 바가 없어서 pb-12로 충분.
    // px-5: 위 계산기 본문과 좌우 여백을 맞춘다(공용 Container 규칙과 동일)
    <section className="max-w-[1120px] mx-auto px-5 lg:px-8 pb-24 lg:pb-12 flex flex-col gap-3">
      {/* 계산 근거 — 기본 접힘 */}
      <details className="border-t border-v1-line-2 pt-4 group">
        <summary className="text-[15px] font-semibold text-v1-text-secondary cursor-pointer select-none list-none marker:content-none">
          <h2 className="inline">{introTitle ?? "이 계산기는 이렇게 계산해요"}</h2> <span className="text-v1-text-disabled group-open:hidden">▾</span>
          <span className="text-v1-text-disabled hidden group-open:inline">▴</span>
        </summary>
        <p className="text-[14px] leading-[1.7] text-v1-text-secondary mt-3">{intro}</p>
      </details>

      {/* 추가 접힘 칸들(선택) — 계산 근거와 같은 모양, 기본 접힘 */}
      {sections?.map((sec) => (
        <details key={sec.title} className="border-t border-v1-line-2 pt-4 group">
          <summary className="text-[15px] font-semibold text-v1-text-secondary cursor-pointer select-none list-none marker:content-none">
            <h2 className="inline">{sec.title}</h2> <span className="text-v1-text-disabled group-open:hidden">▾</span>
            <span className="text-v1-text-disabled hidden group-open:inline">▴</span>
          </summary>
          <div className="text-[14px] leading-[1.7] text-v1-text-secondary mt-3">{sec.content}</div>
        </details>
      ))}

      {/* 자주 묻는 질문 — 기본 접힘 */}
      {faqs.length > 0 && (
        <details className="border-t border-v1-line-2 pt-4 group">
          <summary className="text-[15px] font-semibold text-v1-text-secondary cursor-pointer select-none list-none marker:content-none">
            <h2 className="inline">자주 묻는 질문</h2> <span className="text-v1-text-disabled group-open:hidden">▾</span>
            <span className="text-v1-text-disabled hidden group-open:inline">▴</span>
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {faqs.map((f) => (
              <div key={f.q}>
                <p className="text-[14px] font-semibold text-foreground">{f.q}</p>
                <p className="text-[14px] leading-[1.7] text-v1-text-secondary mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 관련 글 — 항상 보임(링크 3개, 캡션 1줄) */}
      {related.length > 0 && (
        <div className="border-t border-v1-line-2 pt-4 flex flex-col gap-2">
          <p className="text-[13px] text-v1-text-disabled">관련 글</p>
          <div className="flex flex-col gap-1">
            {related.map((r) => (
              <Link key={r.href} href={r.href} className="text-[14px] text-v1-text-secondary hover:text-brown underline underline-offset-2">
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
