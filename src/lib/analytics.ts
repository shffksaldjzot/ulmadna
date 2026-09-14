// ──────────────────────────────────────────────
// GA4(구글 애널리틱스) 커스텀 이벤트 전송 도우미
//
// 왜 필요한가:
//   layout.tsx에 심어둔 gtag 스크립트는 "페이지를 봤다"는 자동으로 잡아주지만,
//   계산기를 실제로 몇 번 돌렸는지·결과를 봤는지·구성 보기를 펼쳤는지 같은
//   "행동"은 코드에서 따로 보내줘야 GA4 화면에서 확인할 수 있다.
//
// 안전장치:
//   - window.gtag가 아직 없으면(스크립트 로딩 전·광고차단·서버 렌더링 중) 아무 일도
//     하지 않고 조용히 끝낸다. 이 함수 때문에 화면이 죽는 일은 절대 없다.
//   - 개인정보·입력 원문은 절대 보내지 않는다. 숫자도 "평형대(10평 단위)" 같은
//     뭉뚱그린 값만 보낸다(예: 34평 → "30").
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

'use client';

// layout.tsx가 <script>로 심어주는 전역 gtag 함수가 있다고 타입스크립트에 알려준다.
// (아직 스크립트가 안 실행됐을 수도 있으므로 함수 타입에 물음표를 붙여 "있을 수도 없을 수도")
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** GA4 이벤트에 딸려 보내는 값 — 문자열/숫자/불리언만 허용(개인정보·긴 텍스트 방지) */
export type TrackParams = Record<string, string | number | boolean | undefined>;

/**
 * GA4로 커스텀 이벤트 하나를 보낸다.
 * @param event 이벤트 이름 (예: 'calc_run', 'calc_view')
 * @param params 이벤트에 딸린 값 (예: { process: 'wallpaper', mode: 'quick' })
 */
export function track(event: string, params?: TrackParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return; // gtag 없으면 조용히 무시
  try {
    window.gtag('event', event, params);
  } catch {
    // 추적이 실패해도 화면 기능에는 절대 영향을 주면 안 되므로 조용히 무시
  }
}

/**
 * 평(pyeong) 입력값을 10평 단위 버킷 문자열로 바꾼다 (예: 34 → "30", 21 → "20").
 * GA 이벤트 파라미터에 원본 숫자 대신 이 버킷값만 실어 보낸다(개인정보 최소화 원칙).
 * 값이 없으면 'na'.
 */
export function pyeongBucket(pyeong: number | undefined): string {
  if (pyeong === undefined || !Number.isFinite(pyeong)) return 'na';
  return String(Math.max(Math.floor(pyeong / 10) * 10, 0));
}
