// ──────────────────────────────────────────────
// 블로그 글 하단 — "직접 제작·시공" 서비스 카드 1장
//
// CalculatorCta.tsx(variant="card")와 같은 자리(본문 끝)에 나온다. 계산기 카드가 있으면
// 그 아래에 이 카드가 하나 더 붙는다(둘 다 있으면 둘 다 — 기획 §3). 서비스가 없는 글은
// post.cta가 null이라 blog/[slug]/page.tsx가 아예 이 컴포넌트를 렌더하지 않는다.
//
// 계산기 카드와 달리 이 카드에는 링크 하나(버튼 열기)가 아니라 전화·카톡 버튼이 바로 있다 —
// 이 15개 서비스는 계산기가 아직 없어서 "눌러서 계산기로 이동"이 아니라 "바로 문의"가 목적.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

import ContactButtons from "@/components/common/ContactButtons";
import type { ServiceInfo } from "@/lib/services";

export default function ServiceCta({ service }: { service: ServiceInfo }) {
  return (
    <aside className="blog-calc-card">
      <div className="blog-calc-card-txt">
        <span className="blog-calc-card-badge">직접 문의</span>
        <strong>{service.name}</strong>
        <span>{service.oneLiner}</span>
      </div>
      <ContactButtons service={service.slug} place="post" phoneOnly={service.phoneOnly} size="md" />
    </aside>
  );
}
