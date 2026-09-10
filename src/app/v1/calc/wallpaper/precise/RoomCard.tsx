// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 정밀 폼: 방 카드 한 장
//
// 이 파일이 하는 일:
//   방 하나의 실측값(가로·세로·이 방만의 높이·문·창)을 적는 카드를 그린다.
//   방 이름은 "방 1, 방 2…"로 자동(수정 칸 없음) — 순서가 바뀌면 번호도 다시 매겨진다.
//
//   가로·세로·높이는 화면 단위(m/mm)로 보이지만 저장은 항상 m,
//   문·창은 항상 cm로 저장한다(units.ts가 그 변환을 맡는다).
//
// 작성일: 2026년 09월 09일
// 2026년 09월 10일: 바닥재 계산기(U 지시서)가 이 카드를 그대로 재사용할 수 있도록
//   optional prop `simple`을 추가했다. 바닥재 방 실측은 가로·세로만 있고 높이·문창
//   개념이 없어서(바닥은 벽이 아니다), simple=true면 "이 방만 다르게"(높이)·문·창 표·
//   벽 면적 미리보기를 통째로 숨기고 가로·세로 입력칸만 남긴다. 기본값 false라
//   도배 화면(PreciseSection)은 지금까지와 똑같이 그려진다.
// ──────────────────────────────────────────────

'use client';

import NumberField from '@/components/v1/NumberField';
import Collapsible from '@/components/v1/Collapsible';
import { IconClose } from '@/components/v1/icons';
import type { PreciseRoomInput, WallpaperOpening } from '@/lib/v1/wallpaperQuery';
import OpeningTable from './OpeningTable';
import { toDisplay, toMeters, heightPlaceholder, type LengthUnit } from './units';

interface RoomCardProps {
  /** 0부터 세는 순서 — 화면 이름 "방 N"을 여기서 만든다 */
  index: number;
  room: PreciseRoomInput;
  /** 화면 표시 단위 (저장값은 항상 m) */
  unit: LengthUnit;
  /** 이 방의 값이 바뀌면 방 하나를 통째로 올려 준다 */
  onChange: (v: PreciseRoomInput) => void;
  /** 이 방 카드를 지운다 */
  onRemove: () => void;
  /** 폼 공통 높이(m) — 이 방 높이가 비어 있으면 이 값으로 벽 면적을 계산해 보여준다 */
  heightM: number;
  /** 범위 — 벽·천장 중 켜진 것만 계산값 줄에 보여준다 */
  target: 'wall' | 'ceiling' | 'both';
  /**
   * true면 "이 방만 다르게"(높이)·문·창 표·벽 면적 미리보기를 숨기고 가로·세로 입력칸만
   * 보여준다(바닥재 계산기 전용). 기본 false — 안 주면 도배 화면 그대로다.
   */
  simple?: boolean;
}

/** 소수 첫째 자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

export default function RoomCard({ index, room, unit, onChange, onRemove, heightM, target, simple = false }: RoomCardProps) {
  // ── 이 방의 벽·천장 면적 미리보기 (엔진과 같은 규칙: 벽 = 둘레×높이 − 문·창, 천장 = 가로×세로) ──
  // 2026-09-09 형아 지적: 방 크기 모드에서 천장 면적 입력칸이 없어 천장이 빠진 줄로 보였다.
  // 천장은 가로×세로로 자동이므로 칸 대신 계산값을 바로 보여준다.
  const w = room.w ?? 0;
  const d = room.d ?? 0;
  const h = room.h ?? heightM;
  const openingSqm = room.openings.reduce((s, o) => s + (o.w / 100) * (o.h / 100) * o.count, 0);
  const wallSqm = w > 0 && d > 0 ? Math.max(0, 2 * (w + d) * h - openingSqm) : 0;
  const ceilingSqm = w > 0 && d > 0 ? w * d : 0;
  const previewParts: string[] = [];
  if (target !== 'ceiling') previewParts.push(`벽 ${r1(wallSqm)}㎡`);
  if (target !== 'wall') previewParts.push(`천장 ${r1(ceilingSqm)}㎡ (가로×세로 자동)`);
  /** 저장값(m) → 화면 숫자. 0은 "아직 안 적음"이라 빈 칸으로 그린다 */
  function show(meters: number | undefined): number | '' {
    if (meters === undefined || meters === 0) return '';
    return toDisplay(meters, unit);
  }

  /** 화면 숫자 → 저장값(m). 빈 칸은 0(=아직 안 적음)으로 담는다 */
  function store(shown: number | ''): number {
    const m = toMeters(shown, unit);
    return m === '' ? 0 : m;
  }

  return (
    <div className="border border-v1-line rounded-[4px] p-3 flex flex-col gap-3">
      {/* 카드 머리 — 자동으로 붙는 이름 + 오른쪽 삭제 × */}
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold text-foreground">방 {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`방 ${index + 1} 삭제`}
          className="w-11 h-11 -mr-2 -my-2 flex items-center justify-center text-v1-text-label"
        >
          <IconClose />
        </button>
      </div>

      {/* 가로·세로 — 한 줄에 2칸(각 flex-1 min-w-0으로 좁은 화면에서도 안 넘친다) */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 text-[14px] text-v1-text-label">
          <span className="flex-1 min-w-0">가로</span>
          <span className="flex-1 min-w-0">세로</span>
        </div>
        <div className="flex gap-2">
          <NumberField
            className="flex-1 min-w-0"
            aria-label={`방 ${index + 1} 가로`}
            suffix={unit}
            placeholder={unit === 'mm' ? '3600' : '3.6'}
            value={show(room.w)}
            onChange={(v) => onChange({ ...room, w: store(v) })}
          />
          <NumberField
            className="flex-1 min-w-0"
            aria-label={`방 ${index + 1} 세로`}
            suffix={unit}
            placeholder={unit === 'mm' ? '4200' : '4.2'}
            value={show(room.d)}
            onChange={(v) => onChange({ ...room, d: store(v) })}
          />
        </div>
        {/* 가로·세로를 다 적으면 이 방의 벽·천장 면적을 바로 보여준다 (바닥재는 벽 개념이 없어 simple에서 뺀다) */}
        {!simple && (wallSqm > 0 || ceilingSqm > 0) ? (
          <p className="text-[14px] text-v1-text-disabled tabular-nums">{previewParts.join(' · ')}</p>
        ) : null}
      </div>

      {/* 이 방만 천장이 높거나 낮을 때만 펼쳐서 적는 칸(비우면 폼 공통 높이를 쓴다) — 바닥재는 높이 개념이 없어 simple에서 뺀다 */}
      {!simple && (
      <Collapsible title="이 방만 다르게" defaultOpen={room.h !== undefined}>
        <div className="pt-2">
          <NumberField
            aria-label={`방 ${index + 1} 높이`}
            suffix={unit}
            placeholder={heightPlaceholder(unit)}
            value={show(room.h)}
            onChange={(v) => {
              const m = toMeters(v, unit);
              // 비우면 h 자체를 없애 공통 높이로 되돌린다
              onChange({ ...room, h: m === '' ? undefined : m });
            }}
          />
        </div>
      </Collapsible>
      )}

      {/* 문·창 — 벽 면적에서 빼는 값 (바닥재는 문·창 차감이 없어 simple에서 뺀다) */}
      {!simple && (
      <div className="flex flex-col gap-2 border-t border-v1-line-2 pt-3">
        <span className="text-[16px] font-semibold text-foreground">문·창</span>
        <OpeningTable
          openings={room.openings}
          onChange={(v: WallpaperOpening[]) => onChange({ ...room, openings: v })}
        />
      </div>
      )}
    </div>
  );
}
