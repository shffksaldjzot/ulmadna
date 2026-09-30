// ──────────────────────────────────────────────
// v1 허브 — 계산기 3종 공용 "첫 화면" 부품
//
// 계산기에 처음 들어오면(공유 링크가 아니면) 빈 폼을 바로 보여주지 않고, 질문 하나만
// 먼저 보여준다 — "어떻게 계산할까요?" + 큰 카드 2개(간단하게 / 정확하게). 하나를
// 고르면 그제서야 아래 단계들이 나타난다(WallpaperCalculator 등이 이 값으로 view를
// 정하고 모드를 "골랐다"는 상태로 바꾼다).
//
// 이 화면일 때는 결과 패널·하단 고정 바를 전부 숨긴다 — 부르는 쪽(각 Calculator)이
// 그 처리를 한다. 이 부품은 순수하게 "카드 2개 보여주고 고르면 알려주기"만 한다.
//
// 2026-09-30 지휘관 긴급 전달(치명 — 모드 선택 뒤 초점이 body로 사라짐) — 키보드(Tab →
// Enter)로 카드를 고르면, 예전(라이브)엔 다음 화면(단계 흐름)의 첫 칩으로 초점이
// 넘어갔는데 새 코드는 body로 떨어졌다. 원인을 찾아보니: "마지막 입력 방식이 키보드
// 였는지"를 기록하는 리스너(flow/focusModality.ts의 ensureFocusModalityTracking)가
// 지금까지는 FlowShell이 마운트될 때만(=모드를 고른 "다음" 화면이 열릴 때) 붙었다.
// 그런데 이 화면(ModePicker, 모드를 고르는 "그 순간")은 FlowShell보다 먼저 보이는
// 화면이라 그 시점엔 리스너가 아직 안 붙어 있었다 — 그래서 Enter 키를 눌러도 "지금은
// 키보드로 조작 중"이라는 기록 자체가 안 남았다. 카드 버튼이 눌리면서 화면이 통째로
// 다음 단계 화면으로 바뀌면(버튼이 DOM에서 사라지면) 브라우저가 초점을 일단 body로
// 떨어뜨리는데, 그 다음 새로 생긴 첫 단계가 "자동으로 초점을 가져올지" 판단할 때
// 필요한 "키보드였다"는 기록이 없어서(undefined) 자동 초점 이동 자체가 안 일어나
// 초점이 body에 그대로 남아 버린 것이다.
// 고침: 이 화면(ModePicker)이 뜨자마자 리스너를 붙인다 — 그러면 카드를 고르는 그
// Enter 키 입력부터 이미 "키보드로 조작 중"이 기록되어 있어서, 다음 화면의 첫 단계가
// 정상적으로 자동 초점을 받는다. 터치·마우스로 고르면 pointerdown이 먼저 기록을
// '포인터'로 남기므로(focusModality.ts), 이 경우는 그대로 초점 이동이 안 일어난다
// (요구사항 그대로 — 터치·마우스는 초점을 안 옮긴다).
//
// 작성일: 2026년 09월 16일
// 초점 추적 리스너를 이 화면에서도 붙이도록 수리(치명 결함): 2026년 09월 30일
// ──────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import { ensureFocusModalityTracking } from './flow/focusModality';

export type CalcViewMode = 'simple' | 'precise';

export interface ModePickerOption {
  value: CalcViewMode;
  /** 카드 큰 글자 (예: "간단하게") */
  title: string;
  /** 카드 아래 짧은 설명 (예: "평형만으로 바로") */
  caption: string;
}

export interface ModePickerProps {
  onPick: (v: CalcViewMode) => void;
  /** 계산기마다 문구가 조금씩 다를 수 있어 옵션을 밖에서 받는다. 안 주면 공통 기본값 */
  options?: ModePickerOption[];
}

const DEFAULT_OPTIONS: ModePickerOption[] = [
  { value: 'simple', title: '간단하게', caption: '평형만으로 바로' },
  { value: 'precise', title: '정확하게', caption: '실측과 제품까지' },
];

export default function ModePicker({ onPick, options = DEFAULT_OPTIONS }: ModePickerProps) {
  // 이 화면이 뜨는 즉시 "키보드/포인터 중 뭘로 조작했는지" 추적을 켠다(중복 호출은
  // 안에서 알아서 막아 준다) — 모드를 고르는 키보드 Enter부터 기록이 남아야, 다음
  // 화면(단계 흐름)의 첫 단계가 자동 초점을 제대로 받는다(위 설명 참고).
  useEffect(() => {
    ensureFocusModalityTracking();
  }, []);

  return (
    <div className="flex flex-col gap-4 py-6">
      <h2 className="t-section text-foreground">어떻게 계산할까요?</h2>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className="flex flex-col items-start gap-1 rounded-lg border border-v1-line bg-white p-4 text-left transition-colors active:bg-cream md:hover:border-accent"
          >
            <span className="text-[17px] font-bold text-foreground">{opt.title}</span>
            <span className="text-[13px] text-v1-text-secondary">{opt.caption}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
