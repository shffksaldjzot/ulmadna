// ──────────────────────────────────────────────
// 공용 2D 도면 부품 — 방 모양 입력(사각형 · ㄱ자 · 자유형)
//
// 손가락으로 벽을 끌어 그리는 대신 숫자로 넣는다(휴대폰에서 정밀도가 훨씬 높다).
//   사각형 — 가로·세로 2칸
//   ㄱ자   — 전체 가로·세로 + 따낸 가로·세로 + 따낸 자리(네 모서리 칩)
//   자유형 — 벽 길이를 차례로, 벽 끝마다 [오른쪽/왼쪽] 꺾기. 마지막 닫는 벽은 자동.
//            벽 추가·빼기 단추. 닫는 벽 길이는 그림의 치수선에서 바로 보인다.
//
// 타일·붙박이장·냉장고장이 같은 입력칸을 쓴다(값 모양 ShapeInput 하나).
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import MmField from './MmField';
import { MAX_SIDE_MM, type NotchCorner, type ShapeInput, type ShapeKind } from './geometry';

const KIND_OPTIONS: { value: ShapeKind; label: string }[] = [
  { value: 'rect', label: '사각형' },
  { value: 'L', label: 'ㄱ자' },
  { value: 'free', label: '자유형' },
];

const CORNER_OPTIONS: { value: NotchCorner; label: string }[] = [
  { value: 'tl', label: '왼쪽 위' },
  { value: 'tr', label: '오른쪽 위' },
  { value: 'bl', label: '왼쪽 아래' },
  { value: 'br', label: '오른쪽 아래' },
];

interface RoomShapeInputProps {
  value: ShapeInput;
  onChange: (v: ShapeInput) => void;
}

export default function RoomShapeInput({ value, onChange }: RoomShapeInputProps) {
  /** 일부 값만 바꾸기 */
  const set = (patch: Partial<ShapeInput>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <ChipGroup role="radiogroup" ariaLabel="방 모양" className="flex gap-2 flex-wrap">
        {KIND_OPTIONS.map((o) => (
          <Chip key={o.value} asRadio selected={value.kind === o.value} onClick={() => set({ kind: o.value })}>
            {o.label}
          </Chip>
        ))}
      </ChipGroup>

      {value.kind !== 'free' && (
        <div className="grid grid-cols-2 gap-2">
          <MmField label="가로" value={value.w} min={300} max={MAX_SIDE_MM} onChange={(w) => set({ w })} />
          <MmField label="세로" value={value.h} min={300} max={MAX_SIDE_MM} onChange={(h) => set({ h })} />
        </div>
      )}

      {value.kind === 'L' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <MmField label="따낸 가로" value={value.nw} min={100} max={MAX_SIDE_MM} onChange={(nw) => set({ nw })} />
            <MmField label="따낸 세로" value={value.nh} min={100} max={MAX_SIDE_MM} onChange={(nh) => set({ nh })} />
          </div>
          <ChipGroup role="radiogroup" ariaLabel="따낸 자리" className="flex gap-2 flex-wrap">
            {CORNER_OPTIONS.map((o) => (
              <Chip key={o.value} size="sm" asRadio selected={value.corner === o.value} onClick={() => set({ corner: o.value })}>
                {o.label}
              </Chip>
            ))}
          </ChipGroup>
        </>
      )}

      {value.kind === 'free' && (
        <div className="flex flex-col gap-2">
          {value.walls.map((wall, i) => (
            <div key={i} className="flex items-end gap-2">
              <MmField
                className="flex-1"
                label={`벽 ${i + 1}`}
                value={wall.len}
                min={100}
                max={MAX_SIDE_MM}
                onChange={(len) => set({ walls: value.walls.map((x, j) => (j === i ? { ...x, len } : x)) })}
              />
              {/* 마지막 벽 뒤는 자동으로 닫히므로 꺾기 칩이 없다 */}
              {i < value.walls.length - 1 ? (
                <ChipGroup role="radiogroup" ariaLabel={`벽 ${i + 1} 끝에서 꺾기`} className="flex gap-1 pb-[2px]">
                  {(['R', 'L'] as const).map((t) => (
                    <Chip
                      key={t}
                      size="sm"
                      asRadio
                      selected={wall.turn === t}
                      onClick={() => set({ walls: value.walls.map((x, j) => (j === i ? { ...x, turn: t } : x)) })}
                    >
                      {t === 'R' ? '오른쪽 ↱' : '왼쪽 ↰'}
                    </Chip>
                  ))}
                </ChipGroup>
              ) : (
                <span className="t-sub text-v1-text-disabled pb-3 whitespace-nowrap">다음 벽 자동</span>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            {value.walls.length < 11 && (
              <Chip size="sm" onClick={() => set({ walls: [...value.walls, { len: 1000, turn: 'R' }] })}>
                + 벽
              </Chip>
            )}
            {value.walls.length > 2 && (
              <Chip size="sm" onClick={() => set({ walls: value.walls.slice(0, -1) })}>
                − 마지막 벽
              </Chip>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
