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
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

'use client';

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
