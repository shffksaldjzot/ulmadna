// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: "간단하게 계산하기" 카드
//
// 2026-09-09 화면 재배치(벽지 최우선 A안):
//   벽지 종류는 이제 이 카드 위에 있는 벽지 카드(PaperPicker)에서 고른다. 여기는 평형·베이
//   + 즉답 큰 숫자 + 범위·지역·상태 칩(ConditionChips)만 담당한다.
//   예전에 있던 "정밀 폼이 유효하면 평형·베이 칩을 잠그는" 로직은 삭제했다 — 이제 "간단하게
//   계산하기"와 "정확하게 계산하기"가 아예 다른 카드라서 이 카드가 보일 때는 정밀 폼 값이
//   따로 없다(WallpaperCalculator가 모드에 따라 이 카드나 PreciseSection 둘 중 하나만 그린다).
//
// 2026-09-15 형아 지시(㎡ 모드 추가): 평형 칩만 있던 자리를 공용 부품 AreaInput(평/㎡ 토글 +
//   칩 + 직접 입력 + 환산 캡션)으로 바꿨다. 평 단위는 지금까지와 같은 "공급 평형", ㎡ 단위는
//   "전용면적" 직접 입력이다(엔진에 0.75 환산 없이 그대로 전달된다 — wallpaperEngineInput.ts).
//   예전의 "직접 입력" 칩 + 프리셋 칩 두 벌 UI는 AreaInput의 "칩 + 항상 보이는 입력칸" 방식으로
//   합쳐졌다(미장 계산기와 같은 UI로 재사용 — 디자인 원칙).
//
// 작성일: 2026년 09월 08일
// 채움: 2026년 09월 09일 (B 지시서)
// 재배치: 2026년 09월 09일 (벽지 최우선 A안)
// ㎡ 모드 추가: 2026년 09월 15일
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import { formatManRange, formatNum } from '@/lib/v1/money';
import type { WallpaperCalcResultDTO, WallpaperRange } from '@/lib/v1/useWallpaperCalc';
import { MIN_EXCLUSIVE_SQM } from '@/lib/v1/wallpaperEngineInput';
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
  /** 즉답 금액 범위 */
  range: WallpaperRange | null;
  loading: boolean;
  /** 계산 실패 메시지. 있으면 큰 숫자 자리에 실패 문구를 보여준다(재시도 버튼 없음) */
  error?: string | null;
  /** 다음 결과가 오기 전까지 이전 값을 보여주는 중이라는 표시(깜빡임 방지용, loading과 같은 취급) */
  stale?: boolean;
  /** 도배 대상 — 벽+천장 / 벽만 (이 화면은 두 개만 노출) */
  target: 'wall' | 'ceiling' | 'both';
  /** 벽지 종류. 위 벽지 카드(PaperPicker)에서 고른 값을 읽기만 한다(여기서 바꾸지 않음) —
   *  undefined면 "벽지를 고르면 바로 나와요" 메시지를 큰 숫자 자리에 보여준다 */
  paperType: '합지' | '실크' | undefined;
  /** 롤·면적 줄에 쓰는 계산 결과(물량 상세) */
  result: WallpaperCalcResultDTO | null;
  /**
   * 결과가 없을 때(!range) 보여줄 한 줄. WallpaperCalculator가 폼 상태를 보고 미리 계산해
   * 내려준다 — "벽지를 고르면 바로 나와요"(paperType 없음) 또는 "평형을 고르면 바로
   * 나와요"(벽지는 골랐는데 평형 없음). 결과 패널·하단 바와 문구를 통일하기 위해서다.
   */
  emptyMessage: string;
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
  range,
  loading,
  error,
  stale,
  target,
  paperType,
  result,
  emptyMessage,
}: QuickAnswerProps) {
  // 로딩 중이거나 이전 값을 보여주는 중이면 큰 숫자를 지우지 않고 옅게만 표시한다(깜빡임 방지 규칙)
  const dim = loading || stale;
  // 직접 입력한 값이 서버가 거부하는 범위면 호출 전에 미리 알려준다(검사관 지적 10번과 같은 이유)
  const pyeongTooSmall = areaUnit === '평' && typeof pyeong === 'number' && pyeong > 0 && pyeong < 5;
  const sqmTooSmall = areaUnit === '㎡' && typeof exclusiveSqm === 'number' && exclusiveSqm > 0 && exclusiveSqm < MIN_EXCLUSIVE_SQM;

  return (
    <Card>
      {/* 1) 면적 — 평(공급 평형)/㎡(전용면적) 토글 + 칩 + 직접 입력 + 환산 캡션(공용 부품) */}
      <AreaInput
        mode="supply"
        unit={areaUnit}
        onUnitChange={onAreaUnitChange}
        value={areaUnit === '㎡' ? exclusiveSqm : pyeong}
        onValueChange={(v) => (areaUnit === '㎡' ? onExclusiveSqmChange(v) : onPyeongChange(v))}
        label="면적"
        // 검사관 지적(2026-09-15): ㎡ 모드는 "전용 ㎡로 계산해요"가 아니라 이미 전용 ㎡ 그
        // 자체라 문구가 달라야 한다 — 평 모드만 공급→전용 환산을 설명한다
        caption={areaUnit === '㎡' ? '전용면적 ㎡ 그대로 계산해요' : '공급 평형 기준 · 전용 ㎡로 계산해요'}
      />

      {/* 2) 베이(구조) — 물량 정확도에 영향을 주는 값이라 면적 바로 아래에 둔다 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[16px] font-semibold text-foreground">베이</span>
        {BAY_CHIPS.map((b) => (
          <Chip key={b} selected={bay === b} onClick={() => onBayChange(b)}>
            {b}베이
          </Chip>
        ))}
      </div>

      {/* 3) 즉답 큰 숫자 — 실패/벽지 미선택/면적 너무 작음/면적 없음/정상 다섯 가지 상태만 있다 */}
      {error ? (
        <p className="text-[16px] text-foreground">계산에 실패했어요</p>
      ) : !paperType ? (
        <p className="text-[16px] text-v1-text-secondary">{emptyMessage}</p>
      ) : pyeongTooSmall ? (
        <p className="text-[16px] text-v1-text-secondary">5평부터 계산해요</p>
      ) : sqmTooSmall ? (
        <p className="text-[16px] text-v1-text-secondary">{MIN_EXCLUSIVE_SQM}㎡부터 계산해요</p>
      ) : !range ? (
        <p className="text-[16px] text-v1-text-secondary">{emptyMessage}</p>
      ) : (
        <>
          <div
            className={
              'text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] ' +
              `whitespace-nowrap transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`
            }
          >
            {formatManRange(range.min, range.max)}
          </div>
          {result && (
            <>
              <p className="text-[16px] text-foreground tabular-nums">
                {formatNum(result.quantity.rolls)}롤
                {target !== 'ceiling' && ` · 벽 ${result.quantity.wallSqm}㎡`}
                {target !== 'wall' && ` · 천장 ${result.quantity.ceilingSqm}㎡`}
              </p>
              <p className="text-[14px] text-v1-text-disabled tabular-nums">{result.cost.basisLine}</p>
            </>
          )}
        </>
      )}

    </Card>
  );
}
