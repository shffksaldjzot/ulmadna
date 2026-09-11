// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: "정확하게 계산하기" 카드(실측)
//
// 도배 PreciseSection.tsx를 본떠 만들었지만 훨씬 단순하다 — 바닥재는 방별 실측
// 하나뿐이고("벽 전체 길이로" 같은 대체 입력 방식이 없다), 높이·문·창 개념도 없다
// (바닥은 벽이 아니라서 문·창을 뺄 필요가 없다). 그래서 방 카드는 도배가 쓰는
// RoomCard를 simple=true로 재사용해 가로·세로 두 칸만 보여준다.
//
// ※ "계산하기" 버튼과 결과 표는 만들지 않는다. 값이 바뀌는 즉시 자동으로 계산되고
//   (useFlooringCalc), 결과는 ResultPanel이 그린다.
//
// 길이는 화면에서 m 또는 mm로 보이지만 저장은 항상 m이다(도배 precise/units.ts를 그대로 쓴다).
//
// 상태는 이 컴포넌트가 갖지 않는다. 전부 FlooringCalculator가 들고 있고
// 여기서는 "값 + 바꾸는 함수"만 받아 쓴다.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import RoomCard from '../wallpaper/precise/RoomCard';
import type { LengthUnit } from '../wallpaper/precise/units';
import type { FlooringPreciseRoom } from '@/lib/v1/flooringQuery';
import type { PreciseRoomInput } from '@/lib/v1/wallpaperQuery';

export interface PreciseSectionProps {
  /** 치수 입력 단위(화면 표시 전용, 저장값은 항상 m — 도배 precise/units.ts가 변환) */
  unit: LengthUnit;
  onUnitChange: (v: LengthUnit) => void;

  /** 방별 실측 목록(가로·세로만) */
  rooms: FlooringPreciseRoom[];
  onRoomsChange: (v: FlooringPreciseRoom[]) => void;
}

/**
 * 바닥재 방({w,d})을 도배 RoomCard가 받는 모양(PreciseRoomInput, openings 필수)으로 감싼다.
 * RoomCard는 simple=true로 쓰면 openings·h를 화면에 아예 그리지 않으므로, 여기서는 항상
 * 빈 배열만 흘려보내고 RoomCard가 돌려주는 값에서 w·d만 다시 뽑아 쓴다.
 */
function toRoomCardInput(room: FlooringPreciseRoom): PreciseRoomInput {
  return { w: room.w, d: room.d, openings: [] };
}

export default function PreciseSection({ unit, onUnitChange, rooms, onRoomsChange }: PreciseSectionProps) {
  /** 방 한 장 추가 — 문·창 개념이 없어 빈 값(0, 0)으로만 시작한다 */
  function addRoom() {
    onRoomsChange([...rooms, { w: 0, d: 0 }]);
  }

  return (
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">실측</h2>

      {/* 1. 단위 — 화면에 보이는 숫자만 바뀌고 저장값(m)은 그대로다 */}
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

      {/* 2. 방 크기 — 방 카드 목록 (RoomCard simple=true: 가로·세로만 보인다) */}
      <div className="flex flex-col gap-3">
        {rooms.map((room, i) => (
          <RoomCard
            key={i}
            index={i}
            room={toRoomCardInput(room)}
            unit={unit}
            simple
            // 바닥재는 벽·천장·높이 개념이 없어 target·heightM은 RoomCard 내부에서
            // 안 쓰인다(simple=true면 그 값들을 쓰는 블록 자체를 그리지 않는다) — 타입만 맞춘다
            target="both"
            heightM={0}
            onChange={(v) => onRoomsChange(rooms.map((r, j) => (j === i ? { w: v.w, d: v.d } : r)))}
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
    </Card>
  );
}
