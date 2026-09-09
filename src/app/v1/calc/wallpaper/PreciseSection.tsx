// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: "정확히 계산하기" 펼침(정밀 폼)
//
// 이 파일이 하는 일:
//   평형만 넣은 즉답을 "실측"으로 좁히는 접이식 카드다. 참고 폼(참고_20260908_챗GPT_도배계산기.html)의
//   순서를 그대로 따른다 — 입력 방식 → 단위 → 높이 → (방 카드 또는 벽 길이) → 지역.
//   범위(벽+천장/벽만)는 즉답 블록 칩에 이미 있어 여기서는 뺐다(2026년 09월 09일 검수 반영).
//
//   ※ 참고 폼에 있던 "계산하기" 버튼과 결과 표는 만들지 않는다.
//     이 화면은 값이 바뀌는 즉시 자동으로 계산되고(useWallpaperCalc), 결과는 ResultPanel이 그린다.
//
//   길이는 화면에서 m 또는 mm로 보이지만 저장은 항상 m이다(precise/units.ts가 변환).
//   문·창은 항상 cm로 저장한다.
//
//   상태는 이 컴포넌트가 갖지 않는다. 전부 WallpaperCalculator가 들고 있고
//   여기서는 "값 + 바꾸는 함수"만 받아 쓴다.
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

'use client';

import type { ReactNode } from 'react';
import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import Segment from '@/components/v1/Segment';
import NumberField from '@/components/v1/NumberField';
import RegionPicker from '@/components/v1/RegionPicker';
import { IconChevronDown, IconChevronUp } from '@/components/v1/icons';
import type { PreciseRoomInput, WallpaperOpening } from '@/lib/v1/wallpaperQuery';
import RoomCard from './precise/RoomCard';
import OpeningTable from './precise/OpeningTable';
import { toDisplay, toMeters, heightPlaceholder } from './precise/units';

export interface PreciseSectionProps {
  /** 펼침 상태 (닫혀 있어도 값이 남아 있으면 훅이 그 값을 우선한다) */
  open: boolean;
  onToggleOpen: () => void;

  /** 입력 방식 — 방별 실측 / 벽 길이 직접 입력 */
  entry: 'room' | 'length';
  onEntryChange: (v: 'room' | 'length') => void;

  /** 치수 입력 단위(화면 표시 전용, 저장값은 항상 m — precise/units.ts가 변환) */
  unit: 'mm' | 'm';
  onUnitChange: (v: 'mm' | 'm') => void;

  /**
   * 도배 대상. 이 화면에는 고르는 칸을 두지 않는다(즉답 블록의 "범위" 칩과 중복이라 2026-09-09 삭제).
   * 벽 길이 모드에서 "천장 면적" 칸을 열지 말지 판단하는 데만 쓴다.
   */
  target: 'wall' | 'ceiling' | 'both';
  /** 지금은 이 화면에서 범위를 바꾸지 않지만, 계약(오케스트레이터 배선)은 그대로 남겨 둔다 */
  onTargetChange: (v: 'wall' | 'ceiling' | 'both') => void;

  /** 공통 천장 높이 (m). 비우면 훅이 기본 2.3m로 계산한다 */
  heightM: number | '';
  onHeightChange: (v: number | '') => void;

  /** entry === 'room'일 때 쓰는 방별 실측 목록 */
  rooms: PreciseRoomInput[];
  onRoomsChange: (v: PreciseRoomInput[]) => void;

  /** entry === 'length'일 때 쓰는 벽 전체 길이 (m) */
  wallLength: number | '';
  onWallLengthChange: (v: number | '') => void;

  /** entry === 'length'이고 천장도 포함할 때 쓰는 천장 면적 직접 입력 (㎡) */
  directCeilingSqm: number | '';
  onDirectCeilingSqmChange: (v: number | '') => void;

  region: string | undefined;
  onRegionChange: (v: string | undefined) => void;

  // ── 아래 두 칸은 이번에 새로 생긴 자리다. B가 상태에 배선하기 전에도 화면이 안 깨지게
  //    optional로 둔다(배선 전에는 벽 길이 모드의 문·창 표를 아예 그리지 않는다).
  /** 벽 길이 모드에서 빼는 문·창 목록 (훅이 면적으로 환산해 벽 면적에서 뺀다) */
  lengthOpenings?: WallpaperOpening[];
  onLengthOpeningsChange?: (v: WallpaperOpening[]) => void;
}

/** 라벨(16 600) + 부품 한 덩어리 — 폼 안에서 반복되는 모양이라 여기서 한 번만 만든다 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[16px] font-semibold text-foreground">{label}</span>
      {children}
    </div>
  );
}

export default function PreciseSection(props: PreciseSectionProps) {
  const {
    open,
    onToggleOpen,
    entry,
    onEntryChange,
    unit,
    onUnitChange,
    target,
    heightM,
    onHeightChange,
    rooms,
    onRoomsChange,
    wallLength,
    onWallLengthChange,
    directCeilingSqm,
    onDirectCeilingSqmChange,
    region,
    onRegionChange,
    lengthOpenings,
    onLengthOpeningsChange,
  } = props;

  // 지금 고른 입력 방식에서 "실제로 계산에 쓰이는 값"이 있을 때만 배지를 띄운다.
  //   · 방 크기로: 가로·세로가 다 들어간 방이 1개 이상 (빈 방 카드만 만들어 둔 상태는 아님)
  //   · 벽 전체 길이로: 길이가 0보다 큼
  // 벽 길이를 넣었다가 "방 크기로" 돌아오면 그 길이는 계산에 안 쓰이므로 배지도 꺼져야 한다.
  // ※ 이 판정 규칙은 wallpaperEngineInput의 describePreciseInput과 같은 규칙이다
  //   (이 부품은 폼 상태 전체를 받지 않아 같은 규칙을 여기서 다시 따진다 — 한쪽을 고치면 다른 쪽도 확인할 것).
  const hasPrecise =
    entry === 'room'
      ? rooms.some((r) => r.w > 0 && r.d > 0)
      : wallLength !== '' && wallLength > 0;

  /** 방 한 장 추가 — 참고 폼처럼 문 한 개(90×210)가 미리 들어간 채로 생긴다 */
  function addRoom() {
    const next: PreciseRoomInput = {
      w: 0,
      d: 0,
      openings: [{ kind: 'door', w: 90, h: 210, count: 1 }],
    };
    onRoomsChange([...rooms, next]);
  }

  return (
    <Card>
      {/* 카드 머리 — 누르면 펼쳐진다. 접혀 있어도 값이 있으면 골드 배지로 표시 */}
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex items-center justify-between min-h-11 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-[20px] font-bold text-foreground">정확히 계산하기</span>
          {hasPrecise && (
            <span className="text-[14px] text-brown border border-gold bg-v1-badge-gold-bg rounded-[4px] px-2 py-[2px]">
              실측 반영 중
            </span>
          )}
        </span>
        {open ? (
          <IconChevronUp className="text-v1-text-label" />
        ) : (
          <IconChevronDown className="text-v1-text-label" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-4 pt-2">
          {/* 1. 입력 방식 — 방을 하나씩 재느냐, 벽 전체 길이를 아느냐 */}
          <Field label="입력 방식">
            <Segment
              options={[
                { value: 'room', label: '방 크기로' },
                { value: 'length', label: '벽 전체 길이로' },
              ]}
              value={entry}
              onChange={onEntryChange}
            />
          </Field>

          {/* 2. 단위 — 화면에 보이는 숫자만 바뀌고 저장값(m)은 그대로다 */}
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-semibold text-foreground">단위</span>
            <div className="flex gap-2">
              <Chip shape="square" selected={unit === 'm'} onClick={() => onUnitChange('m')}>
                m
              </Chip>
              <Chip shape="square" selected={unit === 'mm'} onClick={() => onUnitChange('mm')}>
                mm
              </Chip>
            </div>
          </div>

          {/* 3. 높이 — 비우면 훅이 기본 2.3m로 계산한다 */}
          <Field label="높이">
            <NumberField
              aria-label="천장 높이"
              suffix={unit}
              placeholder={heightPlaceholder(unit)}
              value={toDisplay(heightM, unit)}
              onChange={(v) => onHeightChange(toMeters(v, unit))}
            />
          </Field>

          {/* 범위(벽+천장 / 벽만)는 즉답 블록 칩과 중복이라 이 화면에는 두지 않는다 */}

          {/* 4. 방 크기 모드 — 방 카드 목록 */}
          {entry === 'room' && (
            <Field label="방">
              <div className="flex flex-col gap-3">
                {rooms.map((room, i) => (
                  <RoomCard
                    key={i}
                    index={i}
                    room={room}
                    unit={unit}
                    onChange={(v) => onRoomsChange(rooms.map((r, j) => (j === i ? v : r)))}
                    onRemove={() => onRoomsChange(rooms.filter((_, j) => j !== i))}
                  />
                ))}
                <button
                  type="button"
                  onClick={addRoom}
                  className="h-11 rounded-[4px] border border-dashed border-v1-line-3 text-[16px] text-v1-text-secondary"
                >
                  + 방 추가
                </button>
              </div>
            </Field>
          )}

          {/* 5. 벽 길이 모드 — 벽 전체 길이 + 문·창, 천장은 면적을 직접 적는다 */}
          {entry === 'length' && (
            <>
              <Field label="벽 전체 길이">
                <NumberField
                  aria-label="벽 전체 길이"
                  suffix={unit}
                  placeholder={unit === 'mm' ? '18000' : '18'}
                  value={toDisplay(wallLength, unit)}
                  onChange={(v) => onWallLengthChange(toMeters(v, unit))}
                />
              </Field>

              {/* 문·창 표는 B가 lengthOpenings를 배선한 뒤에만 그린다(안 그러면 적은 값이 사라져 보인다) */}
              {onLengthOpeningsChange && (
                <Field label="문·창">
                  <OpeningTable openings={lengthOpenings ?? []} onChange={onLengthOpeningsChange} />
                </Field>
              )}

              {/* 벽 길이만으로는 천장을 알 수 없어, 천장을 포함할 때만 면적 칸을 연다 */}
              {target !== 'wall' && (
                <Field label="천장 면적">
                  <NumberField
                    aria-label="천장 면적"
                    suffix="㎡"
                    placeholder="천장 ㎡"
                    value={directCeilingSqm}
                    onChange={onDirectCeilingSqmChange}
                  />
                </Field>
              )}
            </>
          )}

          {/* 6. 지역 — 즉답 블록과 같은 상태를 함께 쓴다 */}
          <Field label="지역">
            <RegionPicker value={region} onChange={onRegionChange} />
          </Field>
        </div>
      )}
    </Card>
  );
}
