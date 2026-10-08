// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 정확 모드 2단계: 치수(공간 하나)
//
// 공간마다 칸이 다르다: 욕실 벽 = 가로·세로·높이 / 주방 벽 = 길이·높이 / 바닥 = 가로·세로.
// 치수는 항상 mm로 저장하고, 단위 칩(mm/m)은 보여 주는 방식만 바꾼다.
// 프리셋 칩(욕실 1.5×2.0 · 현관 1.2×1.5 등)을 누르면 칸이 한 번에 채워진다.
// 욕실 벽은 문·창·욕조, 욕실 바닥은 욕조, 주방 벽은 창을 빼는 칩이 있다.
//
// 글자를 치는 동안 초점을 뺏지 않게: 칸의 key는 칸 이름으로 고정하고(공간을 바꿔도 같은 칸은
// 새로 만들어지지 않게), NumberField는 초점이 있는 동안 바깥 값으로 글자를 덮어쓰지 않는다.
//
// 작성일: 2026년 10월 08일
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import NumberField from '@/components/v1/NumberField';
import type { TileFormState } from '@/lib/v1/tileQuery';
import { dimPresetsFor, spaceDimFields, spaceDimLabel, spaceDimRange, type TileSpace } from '@/lib/v1/tilePresets';
import { rangeCaption } from '../_components/inputRanges';

export interface TileDimsProps {
  space: TileSpace;
  form: TileFormState;
  /** 치수·빼는 면적 바꾸기(부모가 손댐 표시까지 한다) */
  onChange: (p: Partial<TileFormState>) => void;
  /** 단위만 바꾸기(손댐 표시 없음) */
  onUnitChange: (u: 'mm' | 'm') => void;
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

export default function TileDims({ space, form, onChange, onUnitChange }: TileDimsProps) {
  const unit = form.unit ?? 'mm';
  const fields = spaceDimFields(space);
  const presets = dimPresetsFor(space);

  // 범위 안내 — 칸마다가 아니라 한 줄로(설명글 최소)
  const msgs = fields
    .map((f) => {
      const r = spaceDimRange(space, f);
      const c = rangeCaption(form[f], r.min, r.max, 'mm');
      return c ? `${spaceDimLabel(space, f)} ${c}` : null;
    })
    .filter(Boolean);

  // 지금 칸 값이 프리셋과 같으면 그 칩을 선택된 모습으로
  const presetSelected = (p: (typeof presets)[number]) => fields.every((f) => form[f] === p[f]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ChipGroup role="radiogroup" ariaLabel="치수 프리셋" className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <Chip
              key={p.label}
              size="sm"
              shape="square"
              asRadio
              selected={presetSelected(p)}
              onClick={() => {
                const patch: Partial<TileFormState> = {};
                for (const f of fields) patch[f] = p[f];
                onChange(patch);
              }}
            >
              {p.label}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup role="radiogroup" ariaLabel="단위" className="flex gap-2 ml-auto">
          {(['mm', 'm'] as const).map((u) => (
            <Chip key={u} shape="square" size="sm" asRadio selected={unit === u} onClick={() => onUnitChange(u)}>
              {u}
            </Chip>
          ))}
        </ChipGroup>
      </div>

      <div className={`grid gap-2 ${fields.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {fields.map((f) => (
          <NumberField
            key={f}
            value={toDisplay(form[f], unit)}
            onChange={(v) => onChange({ [f]: fromDisplay(v, unit) })}
            suffix={unit}
            placeholder={spaceDimLabel(space, f)}
            aria-label={spaceDimLabel(space, f)}
            className="min-w-0 !px-[10px]"
          />
        ))}
      </div>
      {msgs.length > 0 && <p className="t-sub text-danger">{msgs.join(' · ')}</p>}

      {/* 빼는 면적 — 공간마다 뜻 있는 것만 */}
      {space !== 'entrance' && space !== 'balcony' && space !== 'livingFloor' && (
        <ChipGroup role="group" ariaLabel="빼는 면적" className="flex gap-2 flex-wrap">
          {space === 'bathWall' && (
            <Chip size="sm" selected={(form.doors ?? 1) > 0} onClick={() => onChange({ doors: (form.doors ?? 1) > 0 ? 0 : 1 })}>
              문 빼기
            </Chip>
          )}
          {(space === 'bathWall' || space === 'kitchenWall') && (
            <Chip size="sm" selected={(form.windows ?? 0) > 0} onClick={() => onChange({ windows: (form.windows ?? 0) > 0 ? 0 : 1 })}>
              창 빼기
            </Chip>
          )}
          {(space === 'bathWall' || space === 'bathFloor') && (
            <Chip size="sm" selected={!!form.tub} onClick={() => onChange({ tub: !form.tub })}>
              욕조 빼기
            </Chip>
          )}
        </ChipGroup>
      )}
    </div>
  );
}
