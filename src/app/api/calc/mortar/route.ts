// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 계산기 API — POST /api/calc/mortar
//
// 이 파일이 하는 일:
//   화면에서 보낸 값을 하나씩 검사한 뒤 서버 계산기를 돌리고 결과만 돌려준다.
//   단가와 산식은 전부 서버에서만 돌고, 응답에는 물량·소비자가 범위·물량 근거만 나간다.
//   (도배·바닥재 API 라우트와 같은 손검증 방식 — zod 없이 함수로 하나씩 확인한다)
//
// 요청 예시:
//   { "mode": "레미탈", "areaSqm": 10, "thicknessMm": 30 }
//   { "mode": "셀프레벨링", "areaSqm": 20, "thicknessMm": 5 }
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { calcMortar } from '@/server/calc/mortar';
import type { MortarCalcInput } from '@/server/calc/mortar';
// 2026-09-30 지휘관 긴급 전달(중요 1 남은 부분) — 입력 검증을 공용 파일로 옮겼다(내용은
// 그대로, 자리만 옮김). 결과 공유 화면(result/page.tsx)도 같은 함수를 불러 써서
// "같은 입력엔 같은 판정"이 보장된다(옮기기 전/후 API 응답을 바이트 단위로 비교 확인함).
import { parseInput, ValidationError } from '@/server/calc/validate/mortar';
// 계산 성공 횟수를 Upstash Redis에 조용히 기록(도배·바닥재 API와 같은 서버측 사용량 집계)
import { recordCalcRun } from '@/server/metrics/calcCounter';

/** 이 라우트는 매번 새로 계산한다 (캐시 금지) */
export const dynamic = 'force-dynamic';

// ── 라우트 핸들러 ──────────────────────────────

/** POST — 미장(레미탈·셀프레벨링) 계산 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 형식이 아닙니다' }, { status: 400 });
  }

  let input: MortarCalcInput;
  try {
    input = parseInput(body);
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : '입력을 확인해 주세요';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = calcMortar(input);
    // 계산이 실제로 성공했을 때만 1건 기록한다. 응답을 늦추지 않는다(fire-and-forget).
    // 미장은 도배(mode: '평형'/'실측') 같은 명시적 모드 칸이 없어서, 정밀 모드 실별 면적
    // (rooms)이 왔는지로 quick/precise를 가른다 — 화면의 view==='precise'와 같은 조건이다.
    recordCalcRun('mortar', input.rooms && input.rooms.length > 0 ? 'precise' : 'quick');
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error('[calc/mortar] 계산 실패', e);
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
