// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 정확 모드: 실 카드 목록(욕실 / 바닥면 / 벽면)
//
// 카드마다 종류 칩 + 이름 + 치수 칸(욕실 가로·세로·높이 / 바닥 가로·세로 / 벽 길이·높이).
// 치수는 항상 mm로 저장하고, 단위 칩(mm/m)은 보여 주는 방식만 바꾼다.
// 욕실은 빼는 면적 칩(문·창·욕조)과 "84타입 불러오기"(추정 치수) 칩이 있다.
//
// 글자를 치는 동안 초점을 뺏지 않게: 카드 목록의 key는 자리 번호로 고정하고(다시 그려도 칸이
// 새로 만들어지지 않게), NumberField는 초점이 있는 동안 바깥 값으로 글자를 덮어쓰지 않는다.
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import NumberField from '@/components/v1/NumberField';
import type { TileRoomForm } from '@/lib/v1/tileQuery';
import { BATH_PRESETS, TILE_ROOMS_MAX, TILE_HEIGHT_MM_MIN, TILE_HEIGHT_MM_MAX, TILE_ROOM_MM_MIN, type TileRoomKind } from '@/lib/v1/tilePresets';
import { roomFields, roomWidthMax } from '@/lib/v1/tileEngineInput';
import { rangeCaption } from '../_components/inputRanges';

export interface TileRoomsProps {
  rooms: TileRoomForm[];
  unit: 'mm' | 'm';
  onRoomsChange: (rooms: TileRoomForm[]) => void;
  onUnitChange: (u: 'mm' | 'm') => void;
}

/** 종류 칩 이름 */
const KIND_LABEL: Record<TileRoomKind, string> = { bath: '욕실', floor: '바닥', wall: '벽' };
/** 칸 이름(종류마다 가로의 뜻이 다르다 — 벽면은 "길이") */
function fieldLabel(kind: TileRoomKind, f: 'widthMm' | 'depthMm' | 'heightMm'): string {
  if (f === 'heightMm') return '높이';
  if (f === 'depthMm') return '세로';
  return kind === 'wall' ? '길이' : '가로';
}

/** mm 저장값 → 화면 값(단위에 맞춰) */
function toDisplay(mm: number | undefined, unit: 'mm' | 'm'): number | '' {
  if (mm === undefined) return '';
  return unit === 'm' ? Math.round(mm) / 1000 : mm;
}
/** 화면 값 → mm 저장값 */
function fromDisplay(v: number | '', unit: 'mm' | 'm'): number | undefined {
  if (v === '') return undefined;
  return unit === 'm' ? Math.round(v * 1000) : v;
}

export default function TileRooms({ rooms, unit, onRoomsChange, onUnitChange }: TileRoomsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // 키보드로 "+ 실 추가"를 누르면 새 카드 첫 칸으로 초점을 옮긴다(터치·마우스는 안 옮긴다)
  const pendingFocusRef = useRef(false);

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const input = listRef.current?.querySelector<HTMLInputElement>(`input[aria-label="실 ${rooms.length} 가로"], input[aria-label="실 ${rooms.length} 길이"]`);
    input?.focus();
  }, [rooms.length]);

  /** 카드 하나 고치기 */
  function update(i: number, p: Partial<TileRoomForm>) {
    onRoomsChange(rooms.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }
  /** 카드 추가(최대 6장) */
  function add() {
    if (rooms.length >= TILE_ROOMS_MAX) return;
    if (typeof document !== 'undefined' && document.documentElement.dataset.focusModality === 'keyboard') pendingFocusRef.current = true;
    onRoomsChange([...rooms, { kind: 'bath', name: `욕실${rooms.length + 1}` }]);
  }
  /** 카드 지우기 */
  function remove(i: number) {
    onRoomsChange(rooms.filter((_, j) => j !== i));
  }
  /** 종류 바꾸기 — 이름이 기본 이름이면 새 종류 이름으로 바꿔 준다 */
  function changeKind(i: number, kind: TileRoomKind) {
    const r = rooms[i];
    const isDefaultName = /^(욕실|바닥|벽)\d+$/.test(r.name);
    update(i, { kind, name: isDefaultName ? `${KIND_LABEL[kind]}${i + 1}` : r.name });
  }

  const unitSuffix = unit === 'm' ? 'm' : 'mm';

  return (
    <div ref={listRef} className="flex flex-col gap-3">
      <ChipGroup role="radiogroup" ariaLabel="단위" className="flex gap-2">
        {(['mm', 'm'] as const).map((u) => (
          <Chip key={u} shape="square" size="sm" asRadio selected={unit === u} onClick={() => onUnitChange(u)}>
            {u}
          </Chip>
        ))}
      </ChipGroup>

      {rooms.map((r, i) => {
        const n = i + 1;
        const fields = roomFields(r.kind);
        return (
          <div key={i} className="flex flex-col gap-2 border-t border-v1-line-2 pt-3">
            <div className="flex items-center gap-2">
              <ChipGroup role="radiogroup" ariaLabel={`실 ${n} 종류`} className="flex gap-2">
                {(['bath', 'floor', 'wall'] as const).map((k) => (
                  <Chip key={k} size="sm" asRadio selected={r.kind === k} onClick={() => changeKind(i, k)}>
                    {KIND_LABEL[k]}
                  </Chip>
                ))}
              </ChipGroup>
              <input
                type="text"
                value={r.name}
                onChange={(e) => update(i, { name: e.target.value.slice(0, 20) })}
                aria-label={`실 ${n} 이름`}
                className="flex-1 min-w-0 h-9 rounded-[4px] border border-v1-line-3 px-2 text-[14px] text-foreground"
              />
              {rooms.length > 1 && (
                <button type="button" onClick={() => remove(i)} aria-label={`실 ${n} 삭제`} className="w-9 h-9 flex-none text-v1-text-secondary">
                  ×
                </button>
              )}
            </div>

            <div className={`grid gap-2 ${fields.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {fields.map((f) => (
                <NumberField
                  key={f}
                  value={toDisplay(r[f], unit)}
                  onChange={(v) => update(i, { [f]: fromDisplay(v, unit) })}
                  suffix={unitSuffix}
                  placeholder={fieldLabel(r.kind, f)}
                  aria-label={`실 ${n} ${fieldLabel(r.kind, f)}`}
                  className="min-w-0 !px-[10px]"
                />
              ))}
            </div>
            {/* 범위 안내 — 칸마다 따로가 아니라 카드에 한 줄(설명글 최소) */}
            {(() => {
              const msgs = fields
                .map((f) => {
                  const min = f === 'heightMm' ? TILE_HEIGHT_MM_MIN : TILE_ROOM_MM_MIN;
                  const max = f === 'heightMm' ? TILE_HEIGHT_MM_MAX : roomWidthMax(r.kind);
                  const c = rangeCaption(r[f], min, max, 'mm');
                  return c ? `${fieldLabel(r.kind, f)} ${c}` : null;
                })
                .filter(Boolean);
              return msgs.length > 0 ? <p className="t-sub text-danger">{msgs.join(' · ')}</p> : null;
            })()}

            {r.kind === 'bath' && (
              <div className="flex items-center gap-2 flex-wrap">
                <ChipGroup role="group" ariaLabel={`실 ${n} 빼는 면적`} className="flex gap-2 flex-wrap">
                  <Chip size="sm" selected={(r.doors ?? 1) > 0} onClick={() => update(i, { doors: (r.doors ?? 1) > 0 ? 0 : 1 })}>
                    문
                  </Chip>
                  <Chip size="sm" selected={(r.windows ?? 0) > 0} onClick={() => update(i, { windows: (r.windows ?? 0) > 0 ? 0 : 1 })}>
                    창
                  </Chip>
                  <Chip size="sm" selected={!!r.tub} onClick={() => update(i, { tub: !r.tub })}>
                    욕조
                  </Chip>
                </ChipGroup>
                <span className="t-sub text-ink-2 ml-auto">84타입</span>
                {BATH_PRESETS.map((p) => (
                  <Chip key={p.key} size="sm" shape="square" onClick={() => update(i, { ...p.dims })}>
                    {p.label.replace('욕실', '')}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {rooms.length < TILE_ROOMS_MAX && (
        <button type="button" onClick={add} className="h-11 rounded-[4px] border border-dashed border-v1-line-3 text-[15px] text-v1-text-secondary">
          + 실 추가
        </button>
      )}
    </div>
  );
}
