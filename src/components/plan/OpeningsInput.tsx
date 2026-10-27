// ──────────────────────────────────────────────
// 공용 2D 도면 부품 — 문·창 입력 목록
//
// 문·창 하나 = [몇 번 벽] + [벽 시작에서 거리] + [폭] (+ 벽 전개도용 [높이]·[바닥에서])
// 벽 번호는 그림의 동그라미 번호와 같다. 손가락으로 끌어 놓지 않고 숫자로 넣는다.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import MmField from './MmField';
import type { Opening, OpeningKind } from './geometry';

interface OpeningsInputProps {
  value: Opening[];
  onChange: (v: Opening[]) => void;
  /** 방 벽 개수(벽 번호 고르기 범위) */
  wallCount: number;
  /** 높이·바닥에서 칸을 보일지(벽 전개도에서만 필요) */
  showHeight: boolean;
}

/** 새로 넣을 때 기본값 — 문 800×2100, 창 1200×1200(바닥에서 900) */
const NEW_OPENING: Record<OpeningKind, Omit<Opening, 'wall'>> = {
  door: { kind: 'door', offset: 200, width: 800, height: 2100, sill: 0 },
  window: { kind: 'window', offset: 300, width: 1200, height: 1200, sill: 900 },
};

export default function OpeningsInput({ value, onChange, wallCount, showHeight }: OpeningsInputProps) {
  /** i 번째 문·창 일부 값 바꾸기 */
  const set = (i: number, patch: Partial<Opening>) => onChange(value.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <div className="flex flex-col gap-3">
      {value.map((o, i) => (
        <div key={i} className="flex flex-col gap-2 pb-3 border-b border-v1-line-2">
          <div className="flex items-center gap-2">
            <span className="t-body font-semibold text-ink">{o.kind === 'door' ? '문' : '창'}</span>
            <label className="flex items-center gap-1 t-sub text-ink-2">
              벽
              <select
                value={Math.min(o.wall, wallCount - 1)}
                onChange={(e) => set(i, { wall: Number(e.target.value) })}
                className="h-9 rounded-[8px] border border-v1-line-3 bg-white px-2 text-[14px] text-ink"
                aria-label={`${o.kind === 'door' ? '문' : '창'} 붙은 벽 번호`}
              >
                {Array.from({ length: wallCount }, (_, w) => (
                  <option key={w} value={w}>
                    {w + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="ml-auto h-9 px-2 t-sub text-v1-text-label"
              aria-label={`${o.kind === 'door' ? '문' : '창'} 빼기`}
            >
              빼기
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MmField label="벽 시작에서" value={o.offset} min={0} max={30000} onChange={(offset) => set(i, { offset })} />
            <MmField label="폭" value={o.width} min={100} max={5000} onChange={(width) => set(i, { width })} />
            {showHeight && (
              <>
                <MmField label="높이" value={o.height} min={100} max={3000} onChange={(height) => set(i, { height })} />
                <MmField label="바닥에서" value={o.sill} min={0} max={2500} onChange={(sill) => set(i, { sill })} />
              </>
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        {(['door', 'window'] as const).map((k) =>
          value.length < 12 ? (
            <Chip key={k} size="sm" onClick={() => onChange([...value, { ...NEW_OPENING[k], wall: 0 }])}>
              + {k === 'door' ? '문' : '창'}
            </Chip>
          ) : null,
        )}
      </div>
    </div>
  );
}
