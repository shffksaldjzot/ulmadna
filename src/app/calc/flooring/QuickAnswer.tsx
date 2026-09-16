// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: "간단하게 계산하기" 카드 (도배 QuickAnswer.tsx를 그대로 본떠 만듦)
//
// 바닥재 종류·제품은 이 카드 위에 있는 바닥재 카드(MaterialPicker)에서 고른다.
// 범위 칩(ScopeChips)도 이 카드가 아니라 MaterialPicker의 footer에 있다. 여기(QuickAnswer)는
// 면적·베이만 담당한다. 도배와 달리 "벽/천장" 같은 대상 선택이 없다 — 바닥재는 바닥 하나뿐이다.
//
// 2026-09-15 형아 지시(㎡ 모드 추가): 평형 칩만 있던 자리를 공용 부품 AreaInput(평/㎡ 토글 +
//   칩 + 직접 입력 + 환산 캡션)으로 바꿨다.
//
// 2026-09-15 디자인 통일 지시(계산기 3종 화면 정리):
//   이 카드가 직접 보여주던 즉답 큰 숫자(금액·물량·근거줄)를 통째로 없앴다 — 바로 옆(PC)·
//   아래(모바일)에 있는 ResultPanel이 이미 똑같은 숫자를 보여주고 있어서 한 화면에 같은
//   금액이 두 번 보이는 중복이었다(도배와 같은 지적). 결과는 ResultPanel 한 곳에서만
//   보여준다. 테두리 카드(Card)도 없앴다 — 카드 속 카드 금지.
//
// 작성일: 2026년 09월 10일
// ㎡ 모드 추가: 2026년 09월 15일
// 결과 중복 제거 + 카드 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import { MIN_EXCLUSIVE_SQM } from '@/lib/v1/flooringEngineInput';
import AreaInput from '../_components/AreaInput';

// 베이(구조) 칩 목록
const BAY_CHIPS: readonly (2 | 3 | 4)[] = [2, 3, 4];

export interface QuickAnswerProps {
  /** 평형 입력값(areaUnit === '평'일 때). 칩(18·24·25·30·34·40·45) + 직접 입력 겸용 */
  pyeong: number | '';
  onPyeongChange: (v: number | '') => void;
  /** 면적 단위 — 평(공급 평형) / ㎡(전용면적 직접 입력). 기본 '평' */
  areaUnit: '평' | '㎡';
  onAreaUnitChange: (u: '평' | '㎡') => void;
  /** 전용면적 직접 입력값(areaUnit === '㎡'일 때) */
  exclusiveSqm: number | '';
  onExclusiveSqmChange: (v: number | '') => void;
  /** 베이 수(2·3·4). 기본 3 */
  bay: 2 | 3 | 4;
  onBayChange: (v: 2 | 3 | 4) => void;
}

export default function QuickAnswer({
  pyeong,
  onPyeongChange,
  areaUnit,
  onAreaUnitChange,
  exclusiveSqm,
  onExclusiveSqmChange,
  bay,
  onBayChange,
}: QuickAnswerProps) {
  // 직접 입력한 값이 서버가 거부하는 범위면 미리 알려준다(결과 카드의 emptyMessage와는
  // 다른, 이 입력칸 고유의 안내라 중복이 아니다)
  const pyeongTooSmall = areaUnit === '평' && typeof pyeong === 'number' && pyeong > 0 && pyeong < 5;
  const sqmTooSmall = areaUnit === '㎡' && typeof exclusiveSqm === 'number' && exclusiveSqm > 0 && exclusiveSqm < MIN_EXCLUSIVE_SQM;

  return (
    <div className="flex flex-col gap-4">
      {/* 면적 — 평(공급 평형)/㎡(전용면적) 토글 + 칩 + 직접 입력 + 환산 캡션(공용 부품) */}
      <AreaInput
        mode="supply"
        unit={areaUnit}
        onUnitChange={onAreaUnitChange}
        value={areaUnit === '㎡' ? exclusiveSqm : pyeong}
        onValueChange={(v) => (areaUnit === '㎡' ? onExclusiveSqmChange(v) : onPyeongChange(v))}
        label="면적"
        // 2026-09-16 형아 피드백: 캡션에서 "공급"·"전용" 단어를 뺐다(계산 규칙은 그대로 — 평형
        // 칩은 공급 평형표로, ㎡ 입력은 전용면적 그대로 계산한다)
        caption={areaUnit === '㎡' ? '면적 ㎡ 그대로 계산해요' : '평형 기준 · ㎡로 계산해요'}
      />
      {(pyeongTooSmall || sqmTooSmall) && (
        <p className="text-[13px] text-v1-text-disabled">
          {pyeongTooSmall ? '5평부터 계산해요' : `${MIN_EXCLUSIVE_SQM}㎡부터 계산해요`}
        </p>
      )}

      {/* 베이(구조) — 물량 정확도에 영향을 주는 값이라 면적 바로 아래에 둔다 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[15px] font-semibold text-foreground">베이</span>
        {BAY_CHIPS.map((b) => (
          <Chip key={b} selected={bay === b} onClick={() => onBayChange(b)}>
            {b}베이
          </Chip>
        ))}
      </div>
    </div>
  );
}
