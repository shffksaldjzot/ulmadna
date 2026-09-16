// ──────────────────────────────────────────────
// 서비스 카탈로그(/service) — 계산기와 별개로 "직접 제작·시공"을 문의할 수 있는 항목 15개.
//
// 데이터는 전부 lib/services.ts(SERVICES 배열) 하나를 그대로 그린다 — 서비스가 늘거나
// 문구가 바뀌면 그 파일만 고치면 이 화면도 같이 바뀐다.
//
// 카드 구성(설명글 최소화 원칙 — 카드당 한 줄만): 이름 + 한 줄 설명 + 계산기가 있으면
// "바로 계산" 링크(없으면 "상담 후 견적") + 작은 버튼 2개(전화·카톡, 인테리어 컨설팅만 전화만).
//
// 공용 틀(SiteHeader·Container·SiteFooter) 그대로 사용, 디자인 토큰(t-page/t-section 등)만 씀.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import Container from "@/components/layout/Container";
import ContactButtons from "@/components/common/ContactButtons";
import { SERVICES } from "@/lib/services";
import { JsonLd, serviceListLd, breadcrumbLd, SITE_URL } from "@/lib/seo/jsonld";

const PAGE_URL = `${SITE_URL}/service`;

export const metadata: Metadata = {
  title: "직접 제작·시공 — 얼마드나",
  description: "냉장고장·붙박이장부터 줄눈·탄성코트·커튼까지, 전화나 카톡으로 바로 문의하세요.",
  alternates: { canonical: PAGE_URL },
};

export default function ServicePage() {
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <div className="py-8 flex flex-col gap-5">
          {/* 길잡이(작게) — 계산기 허브 페이지와 같은 모양 */}
          <nav aria-label="현재 위치" className="text-[12px] text-ink-2 flex items-center gap-1">
            <Link href="/" className="hover:text-accent">얼마드나</Link>
            <span aria-hidden="true">›</span>
            <span>직접 제작·시공</span>
          </nav>

          {/* 제목만 — 설명글 없음(UI가 카드로 말하게) */}
          <h1 className="t-page text-ink">직접 제작·시공</h1>

          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="서비스 목록">
            {SERVICES.map((s) => (
              <li key={s.slug} id={s.slug} className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="t-body font-bold text-ink">{s.name}</span>
                  {/* 계산기가 있으면 바로 계산 링크, 없으면 "상담 후 견적" 한 줄만 */}
                  {s.calcHref ? (
                    <Link href={s.calcHref} className="t-sub font-semibold text-accent whitespace-nowrap">
                      바로 계산 →
                    </Link>
                  ) : (
                    <span className="t-sub text-ink-2 whitespace-nowrap">상담 후 견적</span>
                  )}
                </div>
                <p className="t-sub text-ink-2">{s.oneLiner}</p>
                <ContactButtons service={s.slug} place="service" phoneOnly={s.phoneOnly} />
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <SiteFooter />

      {/* 검색엔진용 구조화 데이터 — 이 페이지가 다루는 서비스 15개 + 길잡이 */}
      <JsonLd
        data={serviceListLd(
          SERVICES.map((s) => ({
            name: s.name,
            description: s.oneLiner,
            url: `${PAGE_URL}#${s.slug}`,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "얼마드나", href: "/" },
          { name: "직접 제작·시공" },
        ])}
      />
    </>
  );
}
