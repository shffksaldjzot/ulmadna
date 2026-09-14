// ⚠️ 미사용 — 지금 GA4 로딩은 src/app/layout.tsx가 순수 <script> 태그로 직접 처리한다
//    (next/script의 afterInteractive가 인라인 스크립트를 제때 안 돌려서 이 방식으로 교체됨).
//    이 파일은 어디서도 import하지 않는다. 2026-09-14 RouteChangeTracker 추가하며 확인.
'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function Analytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
