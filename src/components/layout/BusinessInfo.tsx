// ──────────────────────────────────────────────
// 사업자 정보 표기 — 푸터·약관류 하단에서 공용으로 쓴다 (2026-10-28, PG 심사 대비)
// 값은 전부 src/lib/business.ts 에서 읽는다. 작은 글씨 2~3줄로 모바일에서도 짧게.
// ──────────────────────────────────────────────

import { BUSINESS as B } from '@/lib/business';

export default function BusinessInfo({ className = '' }: { className?: string }) {
  return (
    <address className={`not-italic t-sub text-ink-2/80 leading-relaxed ${className}`}>
      <p>
        상호 {B.name} · 서비스명 {B.serviceName} · 대표 {B.ceo}
      </p>
      <p>
        사업자등록번호 {B.bizNo}{' '}
        <a
          href={B.bizCheckUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-accent"
        >
          [사업자정보확인]
        </a>{' '}
        · 통신판매업 {B.mailOrderNo}
      </p>
      <p>
        {B.address} · 전화 {B.phone} · {B.email}
      </p>
    </address>
  );
}
