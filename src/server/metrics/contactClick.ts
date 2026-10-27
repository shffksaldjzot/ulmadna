// ──────────────────────────────────────────────
// 문의(전화·카톡) 클릭 횟수 서버 집계 — calcCounter.ts와 같은 방식
//
// 왜 필요한가:
//   GA4는 광고 차단기를 쓰는 사람에게는 아예 안 잡힌다. "문의 버튼을 실제로 눌렀는지"는
//   서버가 직접 세는 게 안전하다.
//
// 어디에 쌓나 (2026-10-27 바뀜):
//   예전엔 Upstash Redis 키 contact:click:{채널}:{날짜} (40일 뒤 삭제).
//   이제 Supabase 표 contact_clicks_daily 한 칸(날짜 × 종류 × 누른 화면 × 지역)에 +1, 영구 보관.
//   "누른 화면"은 요청의 Referer(직전 주소)에서 경로만 뽑는다(쿼리의 견적 조건 등은 버림).
//
// 안전장치: 봇 제외, 응답 지연 0(after), 실패해도 예외 없음.
//
// 작성일: 2026년 09월 16일
// 2026년 10월 27일: Upstash → Supabase(contact_clicks_daily), 화면·지역 칸 추가, 봇 제외
// ──────────────────────────────────────────────

import { bumpContactClick } from './metricsStore';
import { isBotUA, pageFromReferer, regionFromHeaders } from './requestInfo';

/**
 * 문의 버튼 클릭 1건을 기록한다. API 라우트(/api/contact-click)가 요청을 받을 때마다 부른다.
 * 응답을 늦추지 않도록 항상 백그라운드로 실행되고, 절대 예외를 던지지 않는다.
 *
 * @param channel 'phone'(전화) | 'kakao'(카톡)
 * @param headers 요청 머리글 — 지역·누른 화면(Referer)·봇 판정용
 */
export function recordContactClick(channel: 'phone' | 'kakao', headers?: Headers): void {
  try {
    if (headers && isBotUA(headers.get('user-agent'))) return; // 봇은 세지 않음
    const page = pageFromReferer(headers?.get('referer'), headers?.get('host'));
    bumpContactClick(channel, page, regionFromHeaders(headers));
  } catch {
    // 집계 실패가 문의 기능에 영향을 주면 안 되므로 조용히 무시
  }
}
