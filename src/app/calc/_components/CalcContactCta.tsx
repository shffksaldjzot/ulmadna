// ──────────────────────────────────────────────
// 계산기 결과 하단 — "이 공정, 직접 문의" 한 줄 + 전화·카톡 버튼
//
// 도배·바닥재·미장 결과 화면(ResultPanel)이 전부 이 부품 하나를 그대로 쓴다(공유 버튼 아래,
// 고지문 위). 이 세 공정은 서비스 카탈로그(services.ts) 15개 목록엔 없지만, 문의는
// 목록에 없는 공정도 받으므로 service는 'none'으로 기록한다.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

'use client';

import ContactButtons from '@/components/common/ContactButtons';

export default function CalcContactCta() {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="t-sub text-ink-2">이 공정, 직접 문의</span>
      <ContactButtons service="none" place="calc" />
    </div>
  );
}
