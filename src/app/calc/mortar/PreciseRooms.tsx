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
// 2026-09-30 지휘관 긴급 전달("+ 구역 추가" 뒤 초점 처리) — "+ 구역 추가"를 키보드로
// 누르면(Enter) 새로 생긴 구역의 첫 칸(면적)으로 초점을 옮긴다. 터치·마우스로 눌렀을
// 때는 아무 것도 안 한다(브라우저 기본 동작대로 버튼에 그대로 남는다 — 손가락으로
// 계속 누르는 도중에 화면이 스크롤되며 초점이 튀면 오히려 불편하다). 지금이 키보드
// 조작인지는 focusModality.ts가 <html data-focus-modality>에 적어 둔 값으로 판단한다
// (ModePicker.tsx가 화면 진입 시 그 추적을 이미 켜 뒀다).
//
// 작성일: 2026년 09월 27일 (지시서 9장 — 정확 모드 단계 분리)
// 구역 추가 뒤 키보드 초점 이동 추가: 2026년 09월 30일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import NumberField from '@/components/v1/NumberField';
import type { MortarPreciseRoom } from '@/lib/v1/mortarQuery';
import { rangeCaption, MORTAR_ZONE_SQM_MIN, MORTAR_ZONE_SQM_MAX } from '../_components/inputRanges';

export interface PreciseRoomsProps {
  rooms: MortarPreciseRoom[];
  onRoomsChange: (v: MortarPreciseRoom[]) => void;
  /**
   * 2026-09-30 치명 3 수리 — 구역들의 합계가 전체 범위(0.5~500㎡)를 넘으면
   * MortarCalculator.tsx가 "합계 500㎡ 이하" 같은 문구를 계산해 넘겨준다. 개별 구역
   * 범위 안내(아래 caption)와는 별개로 목록 맨 아래에 한 번 더 보여준다.
   */
  sumCaption?: string;
}

export default function PreciseRooms({ rooms, onRoomsChange, sumCaption }: PreciseRoomsProps) {
  // 목록 전체를 감싸는 바깥 div — 방금 추가한 구역의 면적 입력칸을 찾아 초점을 옮길 때 쓴다
  const listRef = useRef<HTMLDivElement>(null);
  // "다음에 구역 개수가 늘어나면(useEffect) 새로 생긴 칸으로 초점을 옮겨야 한다"는 표시.
  // addRoom이 키보드로 눌렸을 때만 true로 세워 두고, 초점 이동 뒤 바로 false로 되돌린다.
  const pendingKeyboardFocusRef = useRef(false);

  function addRoom() {
    // 지금이 키보드 조작인지 확인한다(focusModality.ts가 <html>에 적어 둔 값) — 터치·
    // 마우스로 눌렀으면 아무 표시도 안 남겨서 초점을 그대로 둔다(브라우저 기본 동작).
    if (typeof document !== 'undefined' && document.documentElement.dataset.focusModality === 'keyboard') {
      pendingKeyboardFocusRef.current = true;
    }
    onRoomsChange([...rooms, { name: `구역${rooms.length + 1}`, areaSqm: 0 }]);
  }

  // 구역 개수가 늘어난 직후(=addRoom이 방금 실행돼 상태가 반영된 뒤) 대기 중인 표시가
  // 있으면, 새로 생긴 구역(항상 목록 맨 끝)의 면적 입력칸으로 초점을 옮긴다.
  useEffect(() => {
    if (!pendingKeyboardFocusRef.current) return;
    pendingKeyboardFocusRef.current = false;
    // 새로 생긴 구역은 화면에 "구역 N 면적"(N = rooms.length, 1부터 세는 번호)이라는
    // aria-label을 달고 있다 — NumberField를 손대지 않고 그 라벨로 실제 input을 찾는다.
    const label = `구역 ${rooms.length} 면적`;
    const input = listRef.current?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    input?.focus();
  }, [rooms.length]);

  function updateRoom(i: number, v: Partial<MortarPreciseRoom>) {
    onRoomsChange(rooms.map((r, j) => (j === i ? { ...r, ...v } : r)));
  }

  function removeRoom(i: number) {
    onRoomsChange(rooms.filter((_, j) => j !== i));
  }

  return (
    <div ref={listRef} className="flex flex-col gap-2">
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
      {sumCaption && <p className="t-sub text-danger">{sumCaption}</p>}
    </div>
  );
}
