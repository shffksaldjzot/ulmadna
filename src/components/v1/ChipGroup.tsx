// ──────────────────────────────────────────────
// v1 허브 — 칩 묶음(하나 또는 여러 개를 고르는 칩 여러 개)에 방향키 이동을 붙이는 공용 틀
//
// 2026-09-29 지시서 3-6절(미구현이었던 부분) — 검사관 다듬기 지시:
//   "한 묶음의 칩은 Tab으로 묶음에 들어오면 선택된 칩(없으면 첫 칩) 하나에만 초점이
//   가고, 좌우·상하 방향키로 묶음 안을 옮겨 다닌다. Tab을 다시 누르면 다음 묶음으로
//   나간다. Home·End는 첫 칩·끝 칩. 방향키로 옮기는 것만으로 값이 바뀌지는 않는다
//   (옮긴 뒤 Enter·Space로 고름). 격자로 놓인 칩은 상하 방향키가 같은 열의 위·아래
//   칩으로 간다."
//
// 어떻게 만들었나("roving tabindex" 패턴):
//   묶음 안의 버튼 중 "선택된 것(없으면 첫 번째)" 딱 하나만 tabIndex=0으로 두고
//   나머지는 전부 -1로 둔다. 그러면 브라우저 Tab 키는 그 버튼 하나만 들르고(묶음
//   전체가 "정거장 하나"), 묶음 안에서는 이 부품이 직접 방향키를 받아서 focus()만
//   옮긴다(클릭은 안 한다 — 값은 안 바뀐다). Enter·Space는 버튼 기본 동작(클릭)이라
//   손 안 대도 이미 된다.
//
// 격자(그리드) 자동 인식: columns 값을 따로 안 받는다. 화면 폭에 따라 평형 칩이
// 3열이었다가 360px에서 2열로 줄어드는 등 격자 칸 수가 반응형으로 바뀌기 때문에,
// 대신 각 버튼의 실제 화면 위치(offsetTop)를 재서 "같은 줄"끼리 묶는다 — 그래서
// 화면 폭이 얼마든 지금 실제로 보이는 모양 그대로 상하 이동이 맞아떨어진다.
// 한 줄짜리 묶음(세그먼트·토글 등)이면 모든 버튼이 같은 줄이라 상하 방향키는
// 아무 일도 안 한다(격자가 아니므로 자연스럽다).
//
// 이 부품은 화면 모습을 하나도 안 바꾼다 — 그냥 감싸는 div 하나(role·aria-label만
// 얹음)와 키보드 이벤트 처리만 더한다. 터치·마우스 클릭은 원래 Chip·Segment의
// onClick 그대로 동작해서 전혀 영향이 없다.
//
// Chip.tsx·Segment.tsx와 같은 공용 부품 자리(src/components/v1/)에 둔다 — 계산기
// 전용 폴더(src/app/calc/_components/)에 두면 Segment.tsx가 계산기 폴더를 거슬러
// import 하는 어색한 방향이 생긴다.
//
// 작성일: 2026년 09월 29일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface ChipGroupProps {
  /** 스크린리더가 묶음을 소개할 때 읽는 이름 — 단계 제목("벽지 종류")이나 조정 칩
   *  라벨("베이") 등 사람이 보는 그 이름을 그대로 쓴다 */
  ariaLabel: string;
  /**
   * 묶음의 성격:
   *  - 'radiogroup' : 하나만 고르는 묶음(벽지 종류, 평형, 두께, 용도, 공법 등) — 칩은
   *    Chip의 asRadio(role="radio"+aria-checked)와 짝을 이룬다.
   *  - 'group'      : 여러 개를 각각 켜고 끌 수 있는 묶음(도배 범위 벽·천장) — 칩은
   *    기존 aria-pressed 그대로 쓴다.
   *  - 'tablist'    : Segment(모드 전환 등) 전용 — 안의 버튼은 이미 role="tab"이다.
   */
  role: 'radiogroup' | 'group' | 'tablist';
  className?: string;
  children: ReactNode;
}

/** 세로 줄(행) 단위로 버튼을 묶는다 — offsetTop이 2px 이내로 같으면 같은 줄로 본다 */
function groupByRow(items: HTMLButtonElement[]): HTMLButtonElement[][] {
  const rows: HTMLButtonElement[][] = [];
  for (const el of items) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].offsetTop - el.offsetTop) < 2) {
      last.push(el);
    } else {
      rows.push([el]);
    }
  }
  return rows;
}

export default function ChipGroup({ ariaLabel, role, className, children }: ChipGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  /** 지금 이 묶음 안에서 초점을 받을 수 있는 버튼들(꺼진 건 건너뛴다) */
  function items(): HTMLButtonElement[] {
    if (!ref.current) return [];
    return [...ref.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  }

  // roving tabindex 맞추기 — "선택된 칩(없으면 첫 칩)"만 tabIndex=0, 나머지는 -1.
  // 매 렌더마다 다시 계산하되, 지금 이 묶음 "안"에 실제로 초점이 있으면(=사용자가 방금
  // 방향키로 옮기는 중) 손대지 않는다 — 안 그러면 옮긴 직후 다른 이유로 리렌더가 나서
  // tabIndex가 되돌아가 버리는 사고가 난다(포커스 자체는 안 없어지지만 다음 Tab 자리가
  // 어긋난다).
  useEffect(() => {
    const els = items();
    if (els.length === 0) return;
    if (ref.current?.contains(document.activeElement)) return;
    const selectedIdx = els.findIndex(
      (b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-selected') === 'true',
    );
    const activeIdx = selectedIdx === -1 ? 0 : selectedIdx;
    els.forEach((b, i) => {
      b.tabIndex = i === activeIdx ? 0 : -1;
    });
  });

  function moveFocusTo(next: HTMLButtonElement, all: HTMLButtonElement[]) {
    all.forEach((b) => {
      b.tabIndex = b === next ? 0 : -1;
    });
    next.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const els = items();
    if (els.length === 0) return;
    const current = els.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return; // 이 묶음 안이 아니면(예: 안쪽 다른 입력칸) 관여 안 함

    let next = -1;
    if (e.key === 'ArrowRight') {
      next = (current + 1) % els.length;
    } else if (e.key === 'ArrowLeft') {
      next = (current - 1 + els.length) % els.length;
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // 격자 자동 인식 — 지금 버튼이 몇 번째 줄·몇 번째 칸인지 실제 위치로 찾는다
      const rows = groupByRow(els);
      let rowIdx = -1;
      let colIdx = -1;
      rows.forEach((row, r) => {
        const c = row.indexOf(els[current]);
        if (c !== -1) {
          rowIdx = r;
          colIdx = c;
        }
      });
      if (rowIdx === -1) return;
      const targetRow = e.key === 'ArrowDown' ? rowIdx + 1 : rowIdx - 1;
      if (targetRow < 0 || targetRow >= rows.length) return; // 한 줄짜리 묶음이면 여기서 그냥 끝(아무 일 안 함)
      const row = rows[targetRow];
      const el = row[Math.min(colIdx, row.length - 1)]; // 그 줄이 더 짧으면 마지막 칸으로 보정
      next = els.indexOf(el);
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = els.length - 1;
    } else {
      return;
    }
    if (next < 0 || next >= els.length) return;
    e.preventDefault(); // 방향키의 기본 동작(스크롤 등)을 막는다
    moveFocusTo(els[next], els);
  }

  return (
    <div ref={ref} role={role} aria-label={ariaLabel} className={className} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
