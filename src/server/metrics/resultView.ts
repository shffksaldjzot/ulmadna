// ──────────────────────────────────────────────
// 계산기 결과 화면 조회 +1 (공유 링크 유입 집계용, 2026-10-27)
//
// [무슨 기능인가]
//   계산 결과 "공유" 단추가 만든 주소(/calc/<공정>/result?d=…&ref=share&c=<공정>)를 받은 사람이
//   열면, page_views_daily 표에 slug 'calc/<공정>/result', 유입 'share' 로 +1 한다.
//   → 리포트 봇이 "공유 유입 N · 그중 계산 M"을 낼 수 있다(계산 M 은 calc_runs_daily 의 src='share').
//   표식 없이 열린 결과 화면도 같은 칸에 세되, 유입은 세션 쿠키(미들웨어가 심은 첫 유입 경로)를 쓴다.
//
// [안전] 봇 제외, 응답 지연 0(after), 실패해도 화면에 영향 없음. 개인정보 저장 없음.
// ──────────────────────────────────────────────
import 'server-only';
import { cookies, headers } from 'next/headers';
import { bumpPageView } from './metricsStore';
import { deviceFromUA, isBotUA, regionFromHeaders, sourceFromCookie, SRC_COOKIE } from './requestInfo';

/**
 * 결과 화면 서버 컴포넌트에서 한 번 부른다.
 * @param processName 공정 — wallpaper | flooring | mortar | tile
 * @param ref 주소의 ref 쿼리 값(공유 링크면 'share')
 */
export async function recordResultView(
  processName: 'wallpaper' | 'flooring' | 'mortar' | 'tile',
  ref: string | string[] | undefined,
): Promise<void> {
  try {
    const h = await headers();
    const ua = h.get('user-agent');
    if (isBotUA(ua)) return; // 봇·링크 미리보기(카톡 미리보기 등)는 세지 않는다
    // 주소에 공유 표식이 있으면 share, 없으면 세션 쿠키의 첫 유입 경로
    const src = ref === 'share' ? 'share' : sourceFromCookie((await cookies()).get(SRC_COOKIE)?.value);
    bumpPageView(`calc/${processName}/result`, regionFromHeaders(h), deviceFromUA(ua), src);
  } catch {
    // 집계 실패가 결과 화면에 영향을 주면 안 되므로 조용히 무시
  }
}
