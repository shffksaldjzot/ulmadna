// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 결과 문구 만들기(순수 함수)
//
// 결과 카드(ResultBody, 클라이언트)와 공유 결과 화면(result/page.tsx, 서버)이 같은 문구를 쓰게
// 'use client' 없이 따로 뺐다. 서버 응답 모양만 알면 되므로 src/server/**를 import하지 않는다.
// 문구는 짧게(설명글 최소) — 한 줄에 한 가지만.
//
// 작성일: 2026년 10월 03일
// 개편(9단 결과 카드: 줄 상세·절약 팁·자주 틀리는 것·비율 막대): 2026년 10월 08일
// ──────────────────────────────────────────────

import type { TileCalcResultDTO, TileCostLineDTO } from '@/lib/v1/useTileCalc';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { settingLabel, TILE_SCOPES, TILE_SPACES, TILE_PATTERNS } from '@/lib/v1/tilePresets';

/** 대형 타일 덧방 경고(형아 결정: 막지 않고 경고만) */
export const LARGE_OVERLAY_WARNING = '600×600 이상 대형 타일 덧방은 무게로 떨어질 수 있어요 — 현장 확인 필요';
/** 철거했는데 방수를 끈 경우 경고 */
export const NO_WATERPROOF_WARNING = '철거하면 기존 방수층이 깨져요 — 방수 없이 붙이면 누수 위험';

/** 1만 원 미만은 천 원 단위로, 그 이상은 만 원 범위로 */
export function formatWonRange(min: number, max: number): string {
  if (max < 10000) {
    const a = Math.round(min / 1000);
    const b = Math.round(max / 1000);
    return a === b ? `${a}천원` : `${a}천~${b}천원`;
  }
  return formatManRange(min, max);
}

/** "약 N만원" */
function manText(won: number): string {
  return `약 ${toMan(won).toLocaleString('ko-KR')}만원`;
}

/** 화면 경고 — 화면당 1개(대형 덧방 > 방수 끔) */
export function warningOf(r: TileCalcResultDTO): string | null {
  if (r.checks.includes('largeOverlay')) return LARGE_OVERLAY_WARNING;
  if (r.checks.includes('noWaterproof')) return NO_WATERPROOF_WARNING;
  return null;
}

/** 공간 이름(간단 공간 또는 정확 공간) */
export function placeLabel(r: TileCalcResultDTO): string {
  if (r.resolved.scope) return TILE_SCOPES.find((s) => s.value === r.resolved.scope)?.label ?? '';
  if (r.resolved.space) return TILE_SPACES.find((s) => s.value === r.resolved.space)?.label ?? '';
  return `실측 ${r.quantity.byRoom.length}개 실`;
}

/** 조건 요약 한 줄(예: "욕실 1칸 · 도기질 300×600 · 압착 · 철거 후 새로") */
export function summaryLine(r: TileCalcResultDTO): string {
  const q = r.quantity;
  const main = q.wall ?? q.floor;
  const parts = [placeLabel(r)];
  if (main) parts.push(`${main.kindLabel} ${main.sizeLabel}`);
  parts.push(settingLabel(r.resolved.setting) + (r.resolved.settingRecommended ? '(추천)' : ''));
  parts.push(r.resolved.methodLabel);
  if (r.resolved.pyeong) parts.push(`${r.resolved.pyeong}평`);
  const pattern = TILE_PATTERNS.find((p) => p.value === r.resolved.pattern);
  if (pattern && r.resolved.pattern !== 'straight') parts.push(pattern.label);
  if (r.resolved.service === 'self') parts.push('셀프(자재만)');
  return parts.filter(Boolean).join(' · ');
}

/** 가정 한 줄 — 안 고른 값만. dimsAssumed면 맨 앞에 "기본 치수". 없으면 null */
export function assumptionLine(r: TileCalcResultDTO, dimsAssumed = false): string | null {
  const parts: string[] = [];
  if (dimsAssumed) parts.push('치수 미입력 — 기본 치수');
  if (r.assumed.includes('kind') || r.assumed.includes('size')) {
    const main = r.quantity.wall ?? r.quantity.floor;
    if (main) parts.push(`${main.kindLabel} ${main.sizeLabel}`);
  }
  if (r.assumed.includes('pyeong') && r.resolved.pyeong) parts.push(`${r.resolved.pyeong}평`);
  if (r.assumed.includes('rooms')) parts.push('84타입 욕실');
  return parts.length > 0 ? `${parts.join(' · ')} 가정` : null;
}

/** 자재 칸 줄의 수량 설명(예: "15.4㎡ · 로스 5% · 1.44㎡/박스") */
export function lineDetail(l: TileCostLineDTO, r: TileCalcResultDTO): string {
  const q = r.quantity;
  if (l.key === 'wallTile' && q.wall) return `${formatNum(q.wall.netSqm)}㎡ · 로스 ${q.wall.lossPct}% · ${q.wall.piecesPerBox}장(${q.wall.sqmPerBox}㎡)/박스`;
  if (l.key === 'floorTile' && q.floor) return `${formatNum(q.floor.netSqm)}㎡ · 로스 ${q.floor.lossPct}% · ${q.floor.piecesPerBox}장(${q.floor.sqmPerBox}㎡)/박스`;
  return l.note;
}

/** 줄 오른쪽 수량(예: "12박스", "기공 3일") */
export function lineQty(l: TileCostLineDTO): string {
  if (l.key === 'overhead') return '';
  return `${formatNum(l.qty)}${l.unit}`;
}

/** 결과 카드 세 묶음 — ② 자재(자재·부자재·방수) ③ 인건 ④ 철거·경비 */
export function costGroups(r: TileCalcResultDTO) {
  const b = r.cost.breakdown;
  const sum = (ls: TileCostLineDTO[]) => ({ min: ls.reduce((s, l) => s + l.amountMin, 0), max: ls.reduce((s, l) => s + l.amountMax, 0) });
  const material = b.filter((l) => l.layer === '자재' || l.layer === '부자재' || l.layer === '방수');
  const labor = b.filter((l) => l.layer === '인건');
  const demolish = b.filter((l) => l.layer === '철거');
  const overhead = b.filter((l) => l.layer === '경비');
  return {
    material: { lines: material, ...sum(material) },
    labor: { lines: labor, ...sum(labor) },
    demolish: { lines: demolish, ...sum(demolish) },
    overhead: { lines: overhead, ...sum(overhead) },
  };
}

/** ⑤ "왜 이 가격" 비율(중간값 기준, 합 100) — 0인 칸은 뺀다 */
export function shareBars(r: TileCalcResultDTO): { key: string; label: string; pct: number }[] {
  const g = costGroups(r);
  const mid = (x: { min: number; max: number }) => (x.min + x.max) / 2;
  const items = [
    { key: 'material', label: '자재', v: mid(g.material) },
    { key: 'labor', label: '인건', v: mid(g.labor) },
    { key: 'demolish', label: '철거', v: mid(g.demolish) },
    { key: 'overhead', label: '경비', v: mid(g.overhead) },
  ].filter((x) => x.v > 0);
  const total = items.reduce((s, x) => s + x.v, 0);
  if (total <= 0) return [];
  // 반올림 합이 100이 되게 마지막 칸이 나머지를 갖는다
  let used = 0;
  return items.map((x, i) => {
    const pct = i === items.length - 1 ? 100 - used : Math.round((x.v / total) * 100);
    used += pct;
    return { key: x.key, label: x.label, pct };
  });
}

/** ⑥ 절약 팁 3줄 — 서버가 준 "바꾸면 줄어드는 금액"을 큰 것부터, 모자라면 일반 팁 */
export function savingTips(r: TileCalcResultDTO): string[] {
  const out: string[] = [];
  for (const s of r.cost.savings) {
    const won = manText(s.amount);
    if (s.key === 'overlay') out.push(`기존 타일이 멀쩡하면 덧방으로 ${won} 줄어요`);
    else if (s.key === 'basicGrade') out.push(`보급 등급이면 ${won} 줄어요`);
    else if (s.key === 'smallerTile') out.push(`600각 포세린이면 ${won} 줄어요`);
    else if (s.key === 'cementGrout') out.push(`줄눈을 기본으로 하면 ${won} 줄어요 — 에폭시는 나중에도 돼요`);
    else if (s.key === 'straightPattern') out.push(`정배열이면 로스·품이 줄어 ${won} 줄어요`);
  }
  const fallback =
    r.resolved.service === 'self'
      ? ['박스는 로스까지 한 번에 — 나중에 산 박스는 색이 달라요', '남은 박스 1개는 보수용으로 남겨 두세요', '압착·줄눈재는 타일 가게에서 같이 사면 배송비가 줄어요']
      : ['다른 공정 철거와 같은 날 하면 폐기물비가 줄어요', '타일은 직접 고르고 시공만 맡겨도 돼요', '견적은 같은 조건(종류·크기·방수)으로 비교하세요'];
  for (const t of fallback) if (out.length < 3) out.push(t);
  return out.slice(0, 3);
}

/** ⑧ 자주 틀리는 것 — 면에 따라 3줄 + 덧방·난방이면 확인 줄 */
export function commonMistakes(r: TileCalcResultDTO): string[] {
  const out: string[] = [];
  const hasWall = !!r.quantity.wall;
  const hasFloor = !!r.quantity.floor;
  if (hasWall) out.push('벽 높이는 천장까지가 아니라 천장재 아래까지(보통 2.3m)');
  if (hasFloor && !hasWall) out.push('바닥은 문턱 안쪽까지만 — 붙박이장 밑은 빼고 재요');
  out.push('문·창은 빼고 재요 — 욕조·수납장 뒤는 따로 확인');
  out.push('로스 없이 딱 맞게 사면 모자라요 — 나중 박스는 로트(색)가 달라요');
  if (r.checks.includes('overlayConditions')) out.push('덧방 전: 방수층이 멀쩡한지 · 들뜸·금이 없는지 · 이미 덧방한 면이 아닌지');
  if (r.checks.includes('heatedFloor')) out.push('난방 위 시공: 배관 위치 표시 · 가장자리 신축 줄눈');
  return out;
}

/** 등급 이름 */
export const GRADE_LABEL: Record<'basic' | 'mid' | 'high', string> = { basic: '보급', mid: '중급', high: '고급' };
