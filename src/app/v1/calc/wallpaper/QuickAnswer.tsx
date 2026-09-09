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
// 작성일: 2026년 09월 08일
// 채움: 2026년 09월 09일 (B 지시서)
// 재배치: 2026년 09월 09일 (벽지 최우선 A안)
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import { formatManRange, formatNum } from '@/lib/v1/money';
import type { WallpaperCalcResultDTO, WallpaperRange } from '@/lib/v1/useWallpaperCalc';
import ConditionChips from './ConditionChips';

// 평형 칩 목록 — 설계 정본 59/74/84 비율표와 매칭되는 대표 평형
const PYEONG_CHIPS: readonly number[] = [18, 24, 25, 30, 34, 40, 45];
// 베이(구조) 칩 목록
const BAY_CHIPS: readonly (2 | 3 | 4)[] = [2, 3, 4];

export interface QuickAnswerProps {
  /** 평형 입력값. 칩(18·24·25·30·34·40·45) + 직접 입력 겸용 */
  pyeong: number | '';
  onPyeongChange: (v: number | '') => void;
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
  target: 'wall' | 'both';
  onTargetChange: (v: 'wall' | 'both') => void;
  /** 벽지 종류. 위 벽지 카드(PaperPicker)에서 고른 값을 읽기만 한다(여기서 바꾸지 않음) —
   *  undefined면 "벽지를 고르면 바로 나와요" 메시지를 큰 숫자 자리에 보여준다 */
  paperType: '합지' | '실크' | undefined;
  /** 지역(선택). 비용에만 영향 */
  region: string | undefined;
  onRegionChange: (v: string | undefined) => void;
  /** 구축(재도배) 여부. 기본 false(신축·빈집) */
  isOld: boolean;
  onIsOldChange: (v: boolean) => void;
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
  bay,
  onBayChange,
  range,
  loading,
  error,
  stale,
  target,
  onTargetChange,
  paperType,
  region,
  onRegionChange,
  isOld,
  onIsOldChange,
  result,
  emptyMessage,
}: QuickAnswerProps) {
  // "직접 입력" 모드 여부 — 값이 프리셋과 같은지로 매번 다시 판단하지 않고 명시적 상태로 든다.
  // (검사관 지적 N1: 예전엔 값 비교로 판단해서 "18"까지 친 순간 18평 프리셋과 같아져
  //  입력칸이 사라지고 "18.5"를 이어 칠 수 없었다. 이제는 칩을 눌러야만 모드가 바뀐다.)
  // 초기값은 넘어온 pyeong으로 한 번만 정한다 — 공유 링크로 프리셋과 다른 값이 복원되면
  // 그 값 자체가 이미 "프리셋에 없음"이라 여기서 자동으로 직접 입력 모드로 시작한다.
  const [directMode, setDirectMode] = useState<boolean>(
    () => pyeong === '' || !PYEONG_CHIPS.includes(pyeong),
  );
  // 로딩 중이거나 이전 값을 보여주는 중이면 큰 숫자를 지우지 않고 옅게만 표시한다(깜빡임 방지 규칙)
  const dim = loading || stale;
  // 직접 입력한 평형이 1~4처럼 서버가 거부하는 범위(5 미만)면 호출 전에 미리 알려준다(검사관 지적 10번)
  const pyeongTooSmall = typeof pyeong === 'number' && pyeong > 0 && pyeong < 5;

  return (
    <Card>
      {/* 1) 평형 — 제목 없이 라벨만(20/700 큰 제목은 벽지 카드가 이미 맨 위에 있어 중복이라 뺐다) */}
      <span className="text-[16px] font-semibold text-foreground">평형</span>
      {/* 가로 스크롤 대신 줄바꿈으로 둔다 — 360px 화면에서 칩 8개가 두 줄로 접힌다.
          순서는 [직접 입력][18][24][25][30][34][40][45]를 그대로 유지한다 */}
      <div className="flex flex-wrap gap-2">
        <Chip
          selected={directMode}
          onClick={() => {
            setDirectMode(true);
            onPyeongChange('');
          }}
        >
          직접 입력
        </Chip>
        {PYEONG_CHIPS.map((p) => (
          <Chip
            key={p}
            selected={!directMode && pyeong === p}
            onClick={() => {
              setDirectMode(false);
              onPyeongChange(p);
            }}
          >
            {p}평
          </Chip>
        ))}
      </div>
      {directMode && (
        <NumberField
          value={pyeong}
          onChange={onPyeongChange}
          suffix="평"
          placeholder="평형을 입력하세요"
          aria-label="평형 직접 입력"
          className="w-full"
        />
      )}

      {/* 2) 베이(구조) — 물량 정확도에 영향을 주는 값이라 평형 바로 아래에 둔다 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[16px] font-semibold text-foreground">베이</span>
        {BAY_CHIPS.map((b) => (
          <Chip key={b} selected={bay === b} onClick={() => onBayChange(b)}>
            {b}베이
          </Chip>
        ))}
      </div>

      {/* 3) 즉답 큰 숫자 — 실패/벽지 미선택/5평 미만/평형 없음/정상 다섯 가지 상태만 있다 */}
      {error ? (
        <p className="text-[16px] text-foreground">계산에 실패했어요</p>
      ) : !paperType ? (
        <p className="text-[16px] text-v1-text-secondary">{emptyMessage}</p>
      ) : pyeongTooSmall ? (
        <p className="text-[16px] text-v1-text-secondary">5평부터 계산해요</p>
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
                {formatNum(result.quantity.rolls)}롤 · 벽 {result.quantity.wallSqm}㎡
                {target !== 'wall' && ` · 천장 ${result.quantity.ceilingSqm}㎡`}
              </p>
              <p className="text-[14px] text-v1-text-disabled tabular-nums">{result.cost.basisLine}</p>
            </>
          )}
        </>
      )}

      {/* 4) 범위·지역·상태 칩 3줄 — "정확하게 계산하기" 카드와 공유하는 부품 */}
      <ConditionChips
        target={target}
        onTargetChange={onTargetChange}
        region={region}
        onRegionChange={onRegionChange}
        isOld={isOld}
        onIsOldChange={onIsOldChange}
      />
    </Card>
  );
}
