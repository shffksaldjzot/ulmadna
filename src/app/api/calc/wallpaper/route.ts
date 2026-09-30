// ──────────────────────────────────────────────
// 도배 계산기 API — POST /api/calc/wallpaper
//
// 단가와 산식은 전부 서버에서만 돌고, 응답에는 물량·소비자가 범위·근거 문장만 나간다.
// (클라이언트 번들에 단가가 실리는 일이 없도록 계산은 여기서만 한다)
//
// 요청 예시:
//   { "mode": "평형", "pyeong": 34, "bay": 3, "scope": "전체",
//     "ceiling": true, "paperType": "실크", "region": "서울" }
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { calcWallpaper } from '@/server/calc/wallpaper';
import type { WallpaperCalcInput } from '@/server/calc/wallpaper';
// 2026-09-30 지휘관 긴급 전달(중요 1 남은 부분) — 입력 검증을 공용 파일로 옮겼다(내용은
// 그대로, 자리만 옮김). 결과 공유 화면(result/page.tsx)도 같은 함수를 불러 써서
// "같은 입력엔 같은 판정"이 보장된다(옮기기 전/후 API 응답을 바이트 단위로 비교 확인함).
import { parseInput, ValidationError } from '@/server/calc/validate/wallpaper';
// 계산 성공 횟수를 Upstash Redis에 조용히 기록(광고차단과 무관한 서버측 사용량 집계)
import { recordCalcRun } from '@/server/metrics/calcCounter';

/** 이 라우트는 매번 새로 계산한다 (캐시 금지) */
export const dynamic = 'force-dynamic';

// ── 라우트 핸들러 ──────────────────────────────

/** POST — 도배 계산 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 형식이 아닙니다' }, { status: 400 });
  }

  let input: WallpaperCalcInput;
  try {
    input = parseInput(body);
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : '입력을 확인해 주세요';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = calcWallpaper(input);
    // 계산이 실제로 성공했을 때만 1건 기록한다. 응답을 늦추지 않는다(fire-and-forget).
    recordCalcRun('wallpaper', input.mode === '평형' ? 'quick' : 'precise', input.pyeong);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    // 계산 중 문제는 서버 문제로 본다. 내부 메시지는 그대로 흘리지 않는다.
    console.error('[calc/wallpaper] 계산 실패', e);
    return NextResponse.json({ error: '계산 중 문제가 생겼습니다' }, { status: 500 });
  }
}

/** GET — 지원하지 않음 (계산은 POST 로만) */
export async function GET() {
  return NextResponse.json(
    { error: 'POST 로 요청해 주세요' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
