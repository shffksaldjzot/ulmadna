// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 결과 문구 만들기(순수 함수)
//
// 결과 카드(ResultPanel, 클라이언트)와 공유 결과 화면(result/page.tsx, 서버)이 같은 문구를 쓰게
// 'use client' 없이 따로 뺐다. 서버 응답 모양만 알면 되므로 src/server/**를 import하지 않는다.
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import type { TileCalcResultDTO } from '@/lib/v1/useTileCalc';
import type { TileFormState } from '@/lib/v1/tileQuery';
import { formatNum } from '@/lib/v1/money';
import { TILE_GRADES, TILE_PATTERNS } from '@/lib/v1/tilePresets';

/** 대형 타일 덧방 경고(형아 결정: 막지 않고 경고만) */
export const LARGE_OVERLAY_WARNING = '600×600 이상 대형 타일 덧방은 무게로 떨어질 수 있어요 — 현장 확인 필요';

/** 요약 줄 조각 — "벽 300×600 12박스", "바닥 300×300 4박스" */
export function quantityChunks(r: TileCalcResultDTO): string[] {
  const out: string[] = [];
  if (r.quantity.wall) out.push(`벽 ${r.quantity.wall.sizeLabel} ${formatNum(r.quantity.wall.boxes)}박스`);
  if (r.quantity.floor) out.push(`바닥 ${r.quantity.floor.sizeLabel} ${formatNum(r.quantity.floor.boxes)}박스`);
  return out;
}

/** 보조 줄 조각 — 면적·로스·장 수·부자재·품·공법 */
export function subChunks(r: TileCalcResultDTO): string[] {
  const q = r.quantity;
  const out: string[] = [];
  if (q.wall) out.push(`벽 ${formatNum(q.wall.netSqm)}㎡ ${formatNum(q.wall.pieces)}장`);
  if (q.floor) out.push(`바닥 ${formatNum(q.floor.netSqm)}㎡ ${formatNum(q.floor.pieces)}장`);
  if (q.wall && q.floor && q.wall.lossPct !== q.floor.lossPct) out.push(`로스 벽 ${q.wall.lossPct}%·바닥 ${q.floor.lossPct}%`);
  else out.push(`로스 ${(q.wall ?? q.floor)?.lossPct ?? 0}% 포함`);
  if (q.grout.bags > 0) out.push(`줄눈재 ${q.grout.bagKg}kg×${q.grout.bags}포`);
  if (q.adhesive.bags > 0) out.push(`${q.adhesive.name} ${q.adhesive.bagKg}kg×${q.adhesive.bags}포`);
  if (q.mandays > 0) out.push(`타일공 ${formatNum(q.mandays)}품`);
  out.push(r.resolved.methodLabel);
  const pattern = TILE_PATTERNS.find((p) => p.value === r.resolved.pattern)?.label;
  if (pattern && r.resolved.pattern !== 'straight') out.push(pattern);
  const grade = TILE_GRADES.find((g) => g.value === r.resolved.grade)?.label;
  if (grade) out.push(grade);
  return out;
}

/** 가정 한 줄 — 안 고른 값만("공법 철거 후 새로 · 타일 300×600 · 34평 가정"). 없으면 null */
export function assumptionLine(r: TileCalcResultDTO, form: TileFormState): string | null {
  const parts: string[] = [];
  if (r.assumed.includes('method')) parts.push(`공법 ${r.resolved.methodLabel}`);
  if (r.assumed.includes('size')) {
    const sizes = [r.quantity.wall?.sizeLabel, r.quantity.floor?.sizeLabel].filter(Boolean);
    const uniq = [...new Set(sizes)];
    if (uniq.length > 0) parts.push(`타일 ${uniq.join('·')}`);
  }
  if (r.assumed.includes('pyeong') && r.resolved.pyeong) parts.push(`${r.resolved.pyeong}평`);
  if (r.assumed.includes('dims') || r.assumed.includes('rooms')) parts.push('빈 치수 84타입 추정');
  void form;
  return parts.length > 0 ? `${parts.join(' · ')} 가정` : null;
}

/** 현장 확인 목록 문구 */
export function checkTexts(r: TileCalcResultDTO): string[] {
  const out: string[] = [];
  if (r.checks.includes('overlayConditions')) {
    out.push('덧방 전: 기존 방수층이 멀쩡한지');
    out.push('덧방 전: 기존 타일에 들뜸·금이 없는지');
    out.push('덧방 전: 이미 한 번 덧방한 면이 아닌지');
  }
  if (r.checks.includes('largeOverlay')) out.push(LARGE_OVERLAY_WARNING);
  if (r.checks.includes('lot')) out.push('같은 생산번호(로트)로 한 번에 주문 — 색이 조금씩 달라요');
  return out;
}
