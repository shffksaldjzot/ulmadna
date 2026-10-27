// ──────────────────────────────────────────────
// 계산기 실행 횟수 서버 집계 (calcCounter)
//
// 왜 필요한가:
//   GA4(구글 애널리틱스)는 브라우저에서 스크립트가 실행돼야 잡히는데, 광고 차단기를
//   쓰는 사람은 그 스크립트가 아예 안 돈다. 그래서 "실제로 서버가 계산을 성공시킨"
//   순간에 숫자를 올려두면, 광고 차단 여부와 무관하게 진짜 사용량을 알 수 있다.
//
// 어디에 쌓나 (2026-10-27 바뀜):
//   예전엔 Upstash Redis 에 키 3개(총·모드·평형대)를 6명령으로 쌓고 40일 뒤 지웠다.
//   이제 Supabase 표 calc_runs_daily 한 칸(날짜 × 공정 × 모드 × 평형대 × 지역 × 기기 × 유입)에
//   더하기 함수 1회 호출로 +1 하고, 영구 보관한다. 개인정보(IP·브라우저 정보 원문)는 안 남는다.
//
// 안전장치:
//   - 봇(검색 수집기 등)이 계산 API 를 두드린 건 세지 않는다.
//   - 응답을 늦추지 않는다(after()로 응답 뒤 실행 — metricsStore.ts).
//   - 실패해도 절대 예외를 밖으로 던지지 않는다.
//
// 작성일: 2026년 09월 14일
// 2026년 09월 15일: 미장(레미탈·셀프레벨링) 계산기(mortar) 추가
// 2026년 10월 27일: Upstash → Supabase(calc_runs_daily), 지역·기기·유입 칸 추가, 봇 제외
// ──────────────────────────────────────────────

import { bumpCalcRun } from './metricsStore';
import {
  deviceFromUA,
  isBotUA,
  regionFromHeaders,
  sourceFromCookieHeader,
} from './requestInfo';

/** 평(pyeong)을 10평 단위 버킷 문자열로 바꾼다 (예: 34 → "30"). 없거나 이상하면 "na", 200평 넘으면 "200" */
export function pyeongBucket(pyeong: number | undefined): string {
  if (pyeong === undefined || !Number.isFinite(pyeong)) return 'na';
  return String(Math.min(Math.max(Math.floor(pyeong / 10) * 10, 0), 200));
}

/**
 * 계산 성공 1건을 기록한다. API 라우트에서 계산이 성공했을 때 딱 한 번 호출한다.
 * 응답을 늦추지 않도록 항상 백그라운드로 실행되고, 절대 예외를 던지지 않는다.
 *
 * @param processName 공정 이름 — 'wallpaper'(도배) | 'flooring'(바닥재) | 'mortar'(미장) | 'tile'(타일)
 * @param mode '평형' 입력 모드면 '즉답'에 해당하는 'quick', 그 외(실측·면적)는 'precise'
 * @param pyeong 평형 입력값 — 평형 모드가 아니면 undefined(버킷은 'na'로 기록됨).
 *   미장(mortar)은 면적(㎡) 입력이라 항상 'na'.
 * @param headers 요청 머리글 — 지역(Vercel 지역 머리글)·기기(user-agent)·유입(쿠키) 판정용.
 *   없으면(스크립트 등) 전부 'unknown'/'direct' 로 센다.
 */
export function recordCalcRun(
  processName: 'wallpaper' | 'flooring' | 'mortar' | 'tile',
  mode: 'quick' | 'precise',
  pyeong?: number,
  headers?: Headers,
): void {
  try {
    const ua = headers?.get('user-agent') ?? '';
    // 봇은 세지 않는다 (머리글이 아예 없는 내부 호출은 예외 — 사람 요청으로 본다)
    if (headers && isBotUA(ua)) return;
    bumpCalcRun({
      process: processName,
      mode,
      pyeongBucket: pyeongBucket(pyeong),
      region: regionFromHeaders(headers),
      device: deviceFromUA(ua),
      src: sourceFromCookieHeader(headers?.get('cookie')),
    });
  } catch {
    // 집계 실패가 계산 기능에 영향을 주면 안 되므로 조용히 무시
  }
}
