// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: "간단하게 계산하기" 3단계(면적) 내용
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 6절 표: 간단 모드 3단계는 "면적"만 담당한다.
// 베이(구조) 칩은 여기 있었지만 "조정 칩" 구역(결과 위, 3-12절)으로 옮겼다 — 베이는
// 물량에 영향은 주지만 사용자가 굳이 안 골라도 기본값(3베이)으로 바로 계산되는 보조값이라,
// 단계를 하나 더 누르게 만들 필요가 없다는 지시서 1절 결정 3번 그대로다.
//
// 작성일: 2026년 09월 08일
// 채움: 2026년 09월 09일 (B 지시서)
// 재배치: 2026년 09월 09일 (벽지 최우선 A안)
// ㎡ 모드 추가: 2026년 09월 15일
// 결과 중복 제거 + 카드 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// 베이 칩을 조정 칩으로 이동: 2026년 09월 27일 (단계 흐름 개선 6절)
// ──────────────────────────────────────────────

'use client';

import { MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM } from '@/lib/v1/wallpaperEngineInput';
import { MIN_SUPPLY_PYEONG, MAX_SUPPLY_PYEONG, rangeCaption } from '../_components/inputRanges';
import AreaInput from '../_components/AreaInput';

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
  /**
   * 숫자 칸에서 엔터를 쳤을 때(값이 유효할 때만) 불러 준다 — 면적 단계를 완료 처리하는 데
   * 쓴다(지시서 3-6절, 2026-09-27 검수 지적 8번). 2026-09-29 지적 6번: 부르는 쪽이 항상
   * 넘기므로 필수 prop으로 바꿨다(AreaInput 쪽과 맞춤).
   */
  onEnterComplete: () => void;
  /**
   * true면 사용자가 아직 이 면적 단계를 안 눌렀다는 뜻 — AreaInput에 그대로 넘겨서 칩
   * 선택 표시·숫자 칸 값·환산 캡션을 전부 숨긴다(2026-09-27 지휘관 3차 검수 지적 1번).
   * 계산 자체는 기본값(34평)으로 계속 되고, 이건 화면 표시만 바꾼다.
   */
  untouched?: boolean;
}

export default function QuickAnswer({
  pyeong,
  onPyeongChange,
  areaUnit,
  onAreaUnitChange,
  exclusiveSqm,
  onExclusiveSqmChange,
  onEnterComplete,
  untouched = false,
}: QuickAnswerProps) {
  // 2026-09-29 지적 2번: 직접 입력한 값이 서버 허용 범위(평 5~200 · ㎡ 20~300)를 벗어나면
  // 칸 아래에 짧게 알려준다(결과 카드의 가정 줄과는 다른, 이 입력칸 고유의 안내라 중복이
  // 아니다) — 이 범위 밖 값은 WallpaperCalculator.tsx가 계산에 안 쓰고 34평 가정으로
  // 대신 계산한다(가정 표시·공유 숨김은 거기서 처리).
  const areaCaption =
    areaUnit === '평'
      ? rangeCaption(pyeong, MIN_SUPPLY_PYEONG, MAX_SUPPLY_PYEONG, '평')
      : rangeCaption(exclusiveSqm, MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM, '㎡');

  return (
    <div className="flex flex-col gap-4">
      {/* 면적 — 평(공급 평형)/㎡(전용면적) 토글 + 칩 + 직접 입력 + 환산 캡션(공용 부품).
          label을 안 주면(라벨 없이 토글만) — 제목은 바깥 StepRow가 이미 "면적"으로 그려서 중복 방지 */}
      <AreaInput
        mode="supply"
        unit={areaUnit}
        onUnitChange={onAreaUnitChange}
        value={areaUnit === '㎡' ? exclusiveSqm : pyeong}
        onValueChange={(v) => (areaUnit === '㎡' ? onExclusiveSqmChange(v) : onPyeongChange(v))}
        onEnterComplete={onEnterComplete}
        untouched={untouched}
        // 2026-09-29 지적 4번: 범위 밖일 때(areaCaption이 있을 때)는 환산 줄("≈ ...㎡")을
        // 안 그린다 — 범위 안내 글과 같이 뜨면 뜻 없는 환산까지 보여 정신없다.
        outOfRange={!!areaCaption}
      />
      {areaCaption && <p className="t-sub text-danger">{areaCaption}</p>}
    </div>
  );
}
