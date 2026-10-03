// ──────────────────────────────────────────────
// 타일 계산기 API — POST /api/calc/tile
//
// 화면에서 보낸 값을 검사(validate/tile.ts)한 뒤 서버 계산기(calcTile)를 돌리고 결과만 돌려준다.
// 단가표·계수는 전부 서버에서만 쓰이고, 응답에는 수량·금액 범위·견적DB 비교 범위만 나간다.
//
// 요청 예시:
//   { "mode": "simple", "scope": "bath1" }
//   { "mode": "simple", "scope": "living", "pyeong": 34, "floorTile": { "widthMm": 600, "lengthMm": 1200 } }
//   { "mode": "precise", "rooms": [{ "kind": "bath", "widthMm": 1600, "depthMm": 2100, "heightMm": 2300 }] }
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { calcTile, type TileCalcInput } from '@/server/calc/tile';
import { parseInput, ValidationError } from '@/server/calc/validate/tile';
// 계산 성공 횟수를 조용히 기록(다른 계산기 API와 같은 서버측 사용량 집계)
import { recordCalcRun } from '@/server/metrics/calcCounter';

/** 매번 새로 계산한다(캐시 금지) */
export const dynamic = 'force-dynamic';

/** POST — 타일 계산 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 형식이 아닙니다' }, { status: 400 });
  }

  let input: TileCalcInput;
  try {
    input = parseInput(body);
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : '입력을 확인해 주세요';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = calcTile(input);
    // 계산이 성공했을 때만 1건 기록(응답을 늦추지 않는다)
    recordCalcRun('tile', input.mode === 'precise' ? 'precise' : 'quick', input.pyeong);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error('[calc/tile] 계산 실패', e);
    return NextResponse.json({ error: '계산 중 문제가 생겼습니다' }, { status: 500 });
  }
}

/** GET — 지원하지 않음 */
export async function GET() {
  return NextResponse.json({ error: 'POST 로 요청해 주세요' }, { status: 405, headers: { Allow: 'POST' } });
}
