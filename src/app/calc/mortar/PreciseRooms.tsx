// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "정확하게 계산하기" 2단계(구역 ㎡ 목록) 내용
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9-2절: 정확 모드는 [용도 → 구역(㎡ 목록) →
// 두께] 3단계다. 예전엔 이 구역 목록이 두께·배합비·옵션 등과 한 화면(PreciseSection.tsx)에
// 몰려 있었는데, 이제 "구역" 하나만 떼서 독립된 단계로 만든다(나머지는 두께 단계와
// "세부 조정" 접힘 구역으로 나뉜다 — PreciseSection.tsx가 그 세부 조정을 맡는다).
//
// 이 부품은 예전 PreciseSection.tsx의 "2. 실별 면적" 블록을 그대로 옮긴 것이다(NumberField
// 등 부품 그대로) — 로직·모양을 새로 만들지 않았다.
//
// 작성일: 2026년 09월 27일 (지시서 9장 — 정확 모드 단계 분리)
// ──────────────────────────────────────────────

'use client';

import NumberField from '@/components/v1/NumberField';
import type { MortarPreciseRoom } from '@/lib/v1/mortarQuery';
import { rangeCaption, MORTAR_ZONE_SQM_MIN, MORTAR_ZONE_SQM_MAX } from '../_components/inputRanges';

export interface PreciseRoomsProps {
  rooms: MortarPreciseRoom[];
  onRoomsChange: (v: MortarPreciseRoom[]) => void;
}

export default function PreciseRooms({ rooms, onRoomsChange }: PreciseRoomsProps) {
  function addRoom() {
    onRoomsChange([...rooms, { name: `구역${rooms.length + 1}`, areaSqm: 0 }]);
  }

  function updateRoom(i: number, v: Partial<MortarPreciseRoom>) {
    onRoomsChange(rooms.map((r, j) => (j === i ? { ...r, ...v } : r)));
  }

  function removeRoom(i: number) {
    onRoomsChange(rooms.filter((_, j) => j !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {rooms.map((r, i) => {
        // 2026-09-29 지적 2번: 구역 면적이 서버 허용 범위(0.1~500㎡)를 벗어나면 짧게 알려준다.
        // 값이 그대로 아직 0(=안 적음)이면 rangeCaption이 undefined를 돌려주니 안 뜬다.
        const caption = rangeCaption(r.areaSqm || '', MORTAR_ZONE_SQM_MIN, MORTAR_ZONE_SQM_MAX, '㎡');
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={r.name}
                onChange={(e) => updateRoom(i, { name: e.target.value })}
                aria-label={`구역 ${i + 1} 이름`}
                className="w-20 h-11 rounded-[4px] border border-v1-line-3 px-2 text-[14px] text-foreground"
              />
              <NumberField
                className="flex-1 min-w-0"
                aria-label={`구역 ${i + 1} 면적`}
                suffix="㎡"
                value={r.areaSqm || ''}
                onChange={(v) => updateRoom(i, { areaSqm: v === '' ? 0 : v })}
              />
              <button
                type="button"
                onClick={() => removeRoom(i)}
                aria-label={`구역 ${i + 1} 삭제`}
                className="w-11 h-11 flex-none text-v1-text-secondary"
              >
                ×
              </button>
            </div>
            {caption && <p className="t-sub text-danger">{caption}</p>}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addRoom}
        className="h-11 rounded-[4px] border border-dashed border-v1-line-3 text-[15px] text-v1-text-secondary"
      >
        + 구역 추가
      </button>
    </div>
  );
}
