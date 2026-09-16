// ──────────────────────────────────────────────
// 문의 연락처 공용 상수 + 클릭 추적
//
// [왜 한 곳에 모았나]
// 전화·카톡 버튼이 헤더 알약 → 문의 시트, 서비스 카드, 블로그 글 하단 카드,
// 계산기 결과 화면까지 여러 곳에 흩어져 있다. 번호나 주소가 바뀔 때 한 곳만 고치면
// 전부 같이 바뀌도록 상수와 클릭 기록 함수를 여기 모아둔다.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

import { track } from "./analytics";

/** 대표 전화번호 — tel: 링크용(하이픈 없이 붙여 써야 통화 앱이 바로 건다) */
export const CONTACT_PHONE_TEL = "tel:15339829";
/** 대표 전화번호 — 화면에 글자로 보여줄 때 */
export const CONTACT_PHONE_DISPLAY = "1533-9829";
/** 카카오 오픈채팅 주소 — 항상 새 탭으로 연다 */
export const CONTACT_KAKAO_URL = "https://open.kakao.com/o/saXRBS3g";

/** 문의 버튼 종류 — 전화 또는 카톡 */
export type ContactChannel = "phone" | "kakao";
/** 이 버튼이 화면 어디에 있었는지 — GA 이벤트·서버 집계 둘 다 구분 없이 이 값을 쓴다 */
export type ContactPlace = "header" | "tab" | "service" | "post" | "calc";

/**
 * 문의 버튼(전화/카톡)을 눌렀을 때 1건을 기록한다.
 *  1) GA4 커스텀 이벤트(contact_click) — 화면에서 바로 잡히는 값
 *  2) 서버 카운트(/api/contact-click) — 광고 차단기를 쓰는 사람도 잡히는 값
 *     (계산기 실행 횟수를 세는 calcCounter.ts와 같은 방식)
 * 두 기록 중 무엇이 실패해도 절대 화면 동작(전화 걸기·카톡 열기)을 막으면 안 되므로
 * 전부 실패를 조용히 삼킨다.
 *
 * @param channel 'phone' | 'kakao'
 * @param service 이 버튼이 어떤 서비스에 달려 있는지(services.ts의 slug). 서비스와
 *   무관한 곳(계산기 결과, 헤더 문의 시트 등)이면 'none'
 * @param place 버튼이 있던 위치 — header(상단바 알약) | tab(하단 탭 시트) |
 *   service(서비스 카탈로그 카드) | post(블로그 글 하단 카드) | calc(계산기 결과)
 */
export function trackContactClick(channel: ContactChannel, service: string, place: ContactPlace): void {
  // GA4 이벤트 — window.gtag가 없으면 track()이 알아서 조용히 무시한다
  track("contact_click", { channel, service, place });

  // 서버 집계 — keepalive를 켜야 tel:/카톡 링크로 즉시 페이지를 벗어나도 요청이 살아남는다
  try {
    fetch("/api/contact-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, service, place }),
      keepalive: true,
    }).catch(() => {
      /* 집계 실패가 문의 기능에 영향을 주면 안 되므로 조용히 무시 */
    });
  } catch {
    // fetch 자체를 못 쓰는 아주 오래된 환경이어도 조용히 무시
  }
}
