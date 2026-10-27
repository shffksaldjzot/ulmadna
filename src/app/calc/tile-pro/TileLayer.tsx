// ──────────────────────────────────────────────
// 타일 플러그인 — 도면 그림판(PlanCanvas) 안에 타일을 한 장씩 그린다
//
// PlanCanvas 가 방 모양으로 잘라서(clipPath) 보여 주므로, 여기서는 타일 사각형을 통째로
// 그리기만 하면 잘린 모양이 저절로 보인다. 온장은 옅은 베이지, 컷 장은 옅은 주황으로 칠해
// 어디를 잘라야 하는지 한눈에 보이게 한다. 대각이면 계산 때 쓴 회전을 그대로 되돌린다.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

import { memo } from 'react';
import type { LayoutResult, TileSpec } from '@/lib/tilepro/layout';

/** 타일 색 — 온장/컷 장/줄눈 */
export const TILE_COLORS = { full: '#EFE6D8', cut: '#F4C9B5', line: '#C9B9A3' };

interface TileLayerProps {
  layout: LayoutResult;
  tile: TileSpec;
  /** 도면 글자 기준 길이(선 굵기용) */
  unit: number;
}

function TileLayer({ layout, tile, unit }: TileLayerProps) {
  const { angle, pivot, tiles } = layout;
  const sw = Math.max(unit * 0.05, 1);
  return (
    <g transform={angle ? `rotate(${angle} ${pivot.x} ${pivot.y})` : undefined}>
      {tiles.map((t, i) => (
        <rect
          key={i}
          x={t.x}
          y={t.y}
          width={tile.w}
          height={tile.h}
          fill={t.cut ? TILE_COLORS.cut : TILE_COLORS.full}
          stroke={TILE_COLORS.line}
          strokeWidth={sw}
        />
      ))}
    </g>
  );
}

// 입력칸을 칠 때마다 수천 장을 다시 그리지 않게, 배치 결과가 같으면 건너뛴다
export default memo(TileLayer);
