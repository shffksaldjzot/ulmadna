// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: "정확히 계산하기" 펼침(정밀 폼)
// 방별 실측 또는 벽 길이 직접 입력으로 로스를 "추정"에서 "실제 재단"으로 좁힌다.
//
// ※ C 지시서(정밀 폼 화면)가 이 파일 내부를 채운다. 지금은 props 계약만 확정하고
//   최소 렌더(제목 + 받은 값 요약)만 넣어 둔다.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import type { PreciseRoomInput } from '@/lib/v1/wallpaperQuery';

export interface PreciseSectionProps {
  /** 펼침 상태 (닫혀 있어도 값이 남아 있으면 훅이 그 값을 우선한다) */
  open: boolean;
  onToggleOpen: () => void;

  /** 입력 방식 — 방별 실측 / 벽 길이 직접 입력 */
  entry: 'room' | 'length';
  onEntryChange: (v: 'room' | 'length') => void;

  /** 치수 입력 단위(화면 표시 전용, 저장값은 항상 m — src/lib/v1/wallpaperDefaults.ts 변환 유틸 사용) */
  unit: 'mm' | 'm';
  onUnitChange: (v: 'mm' | 'm') => void;

  /** 도배 대상 — 벽만 / 천장만 / 둘 다 */
  target: 'wall' | 'ceiling' | 'both';
  onTargetChange: (v: 'wall' | 'ceiling' | 'both') => void;

  /** 공통 천장 높이 (m). 기본 2.3 (wallpaperDefaults.ts DEFAULT_CEILING_HEIGHT_M) */
  heightM: number | '';
  onHeightChange: (v: number | '') => void;

  /** entry === 'room'일 때 쓰는 방별 실측 목록 */
  rooms: PreciseRoomInput[];
  onRoomsChange: (v: PreciseRoomInput[]) => void;

  /** entry === 'length'일 때 쓰는 벽 둘레 직접 입력 (m) */
  wallLength: number | '';
  onWallLengthChange: (v: number | '') => void;

  /** entry === 'length'이고 천장도 포함할 때 쓰는 천장 면적 직접 입력 (㎡) */
  directCeilingSqm: number | '';
  onDirectCeilingSqmChange: (v: number | '') => void;

  region: string | undefined;
  onRegionChange: (v: string | undefined) => void;
}

/** C 지시서가 세그먼트·방 카드·지역 선택으로 채울 자리. 지금은 뼈대만 렌더한다. */
export default function PreciseSection({ open, entry, target, rooms, wallLength }: PreciseSectionProps) {
  return (
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">정확히 계산하기 (C 지시서 예정)</h2>
      <p className="text-[14px] text-v1-text-secondary tabular-nums">
        {open ? '펼침' : '접힘'} · {entry === 'room' ? `방 ${rooms.length}개` : `벽 길이 ${wallLength || '미입력'}m`} ·{' '}
        {target === 'wall' ? '벽만' : target === 'ceiling' ? '천장만' : '벽+천장'}
      </p>
    </Card>
  );
}
