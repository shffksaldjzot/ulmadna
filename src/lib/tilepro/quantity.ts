// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 — 입력값 → 물량표(순수 함수, 화면 없음)
//
// 금액은 다루지 않는다(전문가가 물량만 뽑으러 오는 화면). 나오는 값:
//   온장·컷 장 수 → 필요 장 수(자투리 재사용·파손 여유 반영) → 박스 수, 로스율,
//   줄눈재 kg·포, 접착제(압착시멘트·타일본드·떠붙임 몰탈) kg·포.
//
// 바닥 — 방 모양 하나를 구역으로 깐다.
// 벽   — 방의 벽마다 "길이 × 시공 높이" 전개도를 만들고, 그 벽에 붙은 문·창을 구멍으로 뺀다.
//        빼기로 고른 벽(예: 주방은 한쪽 벽만)은 건너뛴다.
//
// 부자재 계수는 소비자용 타일 계산기(서버 tile-coefficients.ts)와 같은 값을 쓴다.
// 서버 파일은 브라우저에서 못 읽으므로 숫자만 옮겨 적고 출처를 남긴다.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

import { buildRoom, fitOpening, signedArea, wallOf, type Pt, type Rect } from '@/components/plan/geometry';
import { layoutTiles, tilesForCuts, type LayoutResult } from './layout';
import type { TileProForm } from './form';

// ── 부자재 계수(소비자용 tile-coefficients.ts 와 같은 값) ──
/** 압착시멘트 ㎡당 kg — 일반 5.5, 대형(긴 변 600 이상) 7.5 / 20kg 포 */
const CEMENT_KG = { normal: 5.5, large: 7.5, pack: 20 };
/** 타일본드 ㎡당 kg — 일반 3.5, 대형 5 / 20kg 통 */
const BOND_KG = { normal: 3.5, large: 5, pack: 20 };
/** 떠붙임 몰탈 ㎡당 kg — 18 / 40kg 포 */
const MORTAR_KG = { normal: 18, large: 18, pack: 40 };
/** 줄눈재 비중(kg/L)·로스·포장(kg) */
const GROUT = { density: 1.6, loss: 0.2, pack: 2 };

/** 계산할 구역 하나 */
export interface TileRegion {
  /** 화면에 보일 이름 — "바닥" 또는 "벽 2" */
  label: string;
  /** 벽이면 벽 번호(0부터), 바닥이면 -1 */
  wall: number;
  outline: Pt[];
  holes: Rect[];
}

/** 구역별 결과 */
export interface RegionResult extends TileRegion {
  layout: LayoutResult;
}

/** 물량표 */
export interface TileProResult {
  regions: RegionResult[];
  /** 시공 실면적(㎡) */
  netSqm: number;
  full: number;
  cut: number;
  /** 컷 자리를 만드는 데 드는 타일 수(자투리 재사용 반영) */
  cutTiles: number;
  /** 파손 여유 장 수 */
  spareTiles: number;
  /** 필요 장 수(주문 기준) */
  total: number;
  /** 박스 수 */
  boxes: number;
  /** 로스율(%) — (필요 장 수 × 장당 면적 − 실면적) ÷ 실면적 */
  lossPct: number;
  /** 줄눈재 */
  grout: { kg: number; packs: number; packKg: number };
  /** 접착제 */
  adhesive: { kg: number; packs: number; packKg: number };
  /** 너무 많아 일부 구역 계산을 멈췄으면 true */
  truncated: boolean;
}

/** 입력값 → 계산할 구역 목록 */
export function regionsOf(form: TileProForm): TileRegion[] {
  const room = buildRoom(form.shape);
  if (form.surface === 'floor') {
    return [{ label: '바닥', wall: -1, outline: room, holes: [] }];
  }
  // 벽 전개도 — 방 안에서 벽을 바라본 모습. 시계 방향 방은 벽 시작점이 왼쪽에 온다.
  const cw = signedArea(room) > 0;
  const H = form.wallH;
  const out: TileRegion[] = [];
  room.forEach((_, i) => {
    if (form.wallsOff.includes(i)) return;
    const len = Math.round(wallOf(room, i).len);
    if (len <= 0) return;
    const holes: Rect[] = form.openings
      .filter((o) => o.wall === i)
      .map((o) => fitOpening(o, len))
      .map((o) => {
        // 문·창의 위(바닥에서 sill+height)가 시공 높이를 넘으면 시공 높이까지만 뺀다
        const top = Math.min(o.sill + o.height, H);
        const h = Math.max(top - o.sill, 0);
        const x = cw ? o.offset : len - o.offset - o.width;
        return { x, y: H - top, w: o.width, h };
      })
      .filter((r) => r.h > 0);
    out.push({
      label: `벽 ${i + 1}`,
      wall: i,
      outline: [
        { x: 0, y: 0 },
        { x: len, y: 0 },
        { x: len, y: H },
        { x: 0, y: H },
      ],
      holes,
    });
  });
  return out;
}

/** 입력값 → 물량표 */
export function computeTilePro(form: TileProForm): TileProResult {
  const tile = { w: form.tileW, h: form.tileH, joint: form.joint };
  const regions: RegionResult[] = regionsOf(form).map((r) => ({
    ...r,
    // 벽은 바닥선(아래 모서리)에서 시작, 바닥은 왼쪽 위 모서리에서 시작
    layout: layoutTiles({ outline: r.outline, holes: r.holes, tile, pattern: form.pattern, origin: form.origin, anchor: r.wall >= 0 ? 'bottom' : 'top' }),
  }));

  const netMm2 = regions.reduce((s, r) => s + r.layout.netAreaMm2, 0);
  const netSqm = netMm2 / 1e6;
  const full = regions.reduce((s, r) => s + r.layout.full, 0);
  const cut = regions.reduce((s, r) => s + r.layout.cut, 0);
  // 컷 조각은 모든 구역을 합쳐 자투리를 맞춰 본다(같은 타일이니까)
  const cutRatios = regions.flatMap((r) => r.layout.tiles.filter((t) => t.cut).map((t) => t.ratio));
  const cutTiles = tilesForCuts(cutRatios, form.reuse);
  const base = full + cutTiles;
  const total = base > 0 ? Math.ceil(base * (1 + form.spare / 100)) : 0;
  const spareTiles = total - base;
  const boxes = form.perBox > 0 ? Math.ceil(total / form.perBox) : 0;
  const tileSqm = (form.tileW * form.tileH) / 1e6;
  const lossPct = netSqm > 0 ? ((total * tileSqm - netSqm) / netSqm) * 100 : 0;

  // 줄눈재 — ㎡당 kg = (가로+세로)/(가로×세로) × 줄눈 폭 × 깊이(타일 두께) × 비중, 로스 20%
  const groutPerSqm = ((form.tileW + form.tileH) / (form.tileW * form.tileH)) * form.joint * form.thick * GROUT.density;
  const groutKg = netSqm * groutPerSqm * (1 + GROUT.loss);

  // 접착제 — 긴 변 600mm 이상이면 대형 기준
  const large = Math.max(form.tileW, form.tileH) >= 600;
  const coef = form.adhesive === 'bond' ? BOND_KG : form.adhesive === 'mortar' ? MORTAR_KG : CEMENT_KG;
  const adhKg = netSqm * (large ? coef.large : coef.normal);

  return {
    regions,
    netSqm,
    full,
    cut,
    cutTiles,
    spareTiles,
    total,
    boxes,
    lossPct,
    grout: { kg: groutKg, packs: Math.ceil(groutKg / GROUT.pack), packKg: GROUT.pack },
    adhesive: { kg: adhKg, packs: Math.ceil(adhKg / coef.pack), packKg: coef.pack },
    truncated: regions.some((r) => r.layout.truncated),
  };
}
