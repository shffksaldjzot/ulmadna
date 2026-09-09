// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: "정확하게 계산하기" 카드(정밀 폼)
//
// 이 파일이 하는 일:
//   평형 즉답 대신 실측·벽 길이로 정밀하게 계산하는 카드다. 참고 폼(참고_20260908_챗GPT_도배계산기.html)의
//   순서를 그대로 따른다 — 입력 방식 → 단위 → 높이 → (방 카드 또는 벽 길이) → 범위·지역·상태.
//
//   2026-09-09 화면 재배치(벽지 최우선 A안):
//     · 예전엔 "정확히 계산하기" 접이식 카드였지만, 이제 위쪽 [간단하게/정확하게 계산하기]
//       세그먼트로 모드를 고르면 이 카드가 통째로 보이거나 안 보인다 — 그래서 펼침 토글
//       (open/onToggleOpen)과 제목·"실측 반영 중" 배지를 없앴다. 이 카드가 보이면 곧 정밀
//       모드라는 뜻이라 따로 표시할 필요가 없다.
//     · "지역"은 더 이상 이 카드 혼자 갖지 않는다. 범위·지역·상태 칩 3줄을 공용 부품
//       ConditionChips로 빼서 "간단하게 계산하기" 카드와 함께 쓴다.
//
//   ※ "계산하기" 버튼과 결과 표는 만들지 않는다.
//     이 화면은 값이 바뀌는 즉시 자동으로 계산되고(useWallpaperCalc), 결과는 ResultPanel이 그린다.
//
//   길이는 화면에서 m 또는 mm로 보이지만 저장은 항상 m이다(precise/units.ts가 변환).
//   문·창은 항상 cm로 저장한다.
//
//   상태는 이 컴포넌트가 갖지 않는다. 전부 WallpaperCalculator가 들고 있고
//   여기서는 "값 + 바꾸는 함수"만 받아 쓴다.
//
// 작성일: 2026년 09월 09일
// 재배치: 2026년 09월 09일 (벽지 최우선 A안 — 펼침 토글·지역 필드 삭제, ConditionChips 도입)
// ──────────────────────────────────────────────

'use client';

import type { ReactNode } from 'react';
import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import Segment from '@/components/v1/Segment';
import NumberField from '@/components/v1/NumberField';
import type { PreciseRoomInput, WallpaperOpening } from '@/lib/v1/wallpaperQuery';
import RoomCard from './precise/RoomCard';
import OpeningTable from './precise/OpeningTable';
import { toDisplay, toMeters, heightPlaceholder } from './precise/units';
import ConditionChips from './ConditionChips';

export interface PreciseSectionProps {
  /** 입력 방식 — 방별 실측 / 벽 길이 직접 입력 */
  entry: 'room' | 'length';
  onEntryChange: (v: 'room' | 'length') => void;

  /** 치수 입력 단위(화면 표시 전용, 저장값은 항상 m — precise/units.ts가 변환) */
  unit: 'mm' | 'm';
  onUnitChange: (v: 'mm' | 'm') => void;

  /**
   * 도배 대상. 이 카드에는 고르는 칩을 직접 두지 않고 아래 ConditionChips가 "범위" 줄로
   * 보여준다. 이 프롭은 벽 길이 모드에서 "천장 면적" 칸을 열지 말지 판단하는 데만 쓴다.
   */
  target: 'wall' | 'ceiling' | 'both';
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

  /** 아래 ConditionChips(범위·지역·상태)로 그대로 전달한다 */

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
    entry,
    onEntryChange,
    unit,
    onUnitChange,
    target,
    onTargetChange,
    heightM,
    onHeightChange,
    rooms,
    onRoomsChange,
    wallLength,
    onWallLengthChange,
    directCeilingSqm,
    onDirectCeilingSqmChange,
    lengthOpenings,
    onLengthOpeningsChange,
  } = props;

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
      <h2 className="text-[20px] font-bold text-foreground">실측</h2>

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

          {/* 문·창 표는 lengthOpenings가 배선된 뒤에만 그린다(안 그러면 적은 값이 사라져 보인다) */}
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

      {/* 6. 범위·지역·상태 칩 3줄 — "간단하게 계산하기" 카드와 공유하는 부품 */}
      <ConditionChips
        target={target}
        onTargetChange={onTargetChange}
      />
    </Card>
  );
}
