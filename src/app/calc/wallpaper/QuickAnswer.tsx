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

import { MIN_EXCLUSIVE_SQM } from '@/lib/v1/wallpaperEngineInput';
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
}

export default function QuickAnswer({
  pyeong,
  onPyeongChange,
  areaUnit,
  onAreaUnitChange,
  exclusiveSqm,
  onExclusiveSqmChange,
}: QuickAnswerProps) {
  // 직접 입력한 값이 서버가 거부하는 범위면 미리 알려준다(결과 카드의 가정 줄과는
  // 다른, 이 입력칸 고유의 안내라 중복이 아니다)
  const pyeongTooSmall = areaUnit === '평' && typeof pyeong === 'number' && pyeong > 0 && pyeong < 5;
  const sqmTooSmall = areaUnit === '㎡' && typeof exclusiveSqm === 'number' && exclusiveSqm > 0 && exclusiveSqm < MIN_EXCLUSIVE_SQM;

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
      />
      {(pyeongTooSmall || sqmTooSmall) && (
        <p className="t-sub text-ink-2">{pyeongTooSmall ? '5평부터 계산해요' : `${MIN_EXCLUSIVE_SQM}㎡부터 계산해요`}</p>
      )}
    </div>
  );
}
