// ──────────────────────────────────────────────
// 사업자 정보 표기 — 푸터·약관류 하단에서 공용으로 쓴다 (2026-10-28, PG 심사 대비)
// 값은 전부 src/lib/business.ts 에서 읽는다. 작은 글씨 2~3줄로 모바일에서도 짧게.
// 2026-10-29: 푸터처럼 눈에 덜 띄게 둘 곳은 collapsed 로 — 평소엔 "상호 · 사업자정보 ▾" 한 줄,
//   누르면 전체가 펼쳐진다(법이 요구하는 표시는 유지, 쿠팡·오늘의집 푸터와 같은 방식).
//   약관·소개 페이지는 기본값(펼침) 그대로.
// ──────────────────────────────────────────────

import { BUSINESS as B } from '@/lib/business';

/** 사업자 정보 본문 3줄 */
function Lines() {
  return (
    <>
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
    </>
  );
}

export default function BusinessInfo({
  className = '',
  collapsed = false,
}: {
  className?: string;
  /** true 면 접힌 한 줄로 시작(푸터용). 누르면 펼쳐진다 */
  collapsed?: boolean;
}) {
  const base = `not-italic t-sub text-ink-2/80 leading-relaxed ${className}`;
  if (!collapsed) {
    return (
      <address className={base}>
        <Lines />
      </address>
    );
  }
  return (
    <details className={base}>
      {/* 접힌 상태 한 줄 — 기본 화살표는 숨기고 글자 끝에 ▾ 로만 표시 */}
      <summary className="cursor-pointer list-none select-none text-ink-2/60 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
        {B.name} · 사업자정보 ▾
      </summary>
      <address className="not-italic mt-2">
        <Lines />
      </address>
    </details>
  );
}
