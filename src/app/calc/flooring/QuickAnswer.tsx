// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: "간단하게 계산하기" 카드 (도배 QuickAnswer.tsx를 그대로 본떠 만듦)
//
// 바닥재 종류·제품은 이 카드 위에 있는 바닥재 카드(MaterialPicker)에서 고른다.
// 범위 칩(ScopeChips)도 이 카드가 아니라 MaterialPicker의 footer에 있다(간단 모드일 때만
// 보인다 — 검사관 1라운드 지적 1번: 정확 모드는 범위 개념이 없어서 그때는 안 그린다).
// 여기(QuickAnswer)는 평형·베이 + 즉답 큰 숫자만 담당한다.
// 도배와 달리 "벽/천장" 같은 대상 선택이 없다 — 바닥재는 바닥 하나뿐이다.
// 2026-09-11 검사관 2라운드 지적 N-3: 위 주석이 "범위 칩도 여기서 담당"이라고 잘못
// 적혀 있던 걸 지금 구조(MaterialPicker footer)에 맞게 정정했다.
//
// ※ "계산하기" 버튼과 결과 표는 만들지 않는다. 값이 바뀌는 즉시 자동으로 계산되고
//   (useFlooringCalc), 결과는 ResultPanel이 그린다.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import { formatManRange, formatNum } from '@/lib/v1/money';
import type { FlooringCalcResultDTO, FlooringRange } from '@/lib/v1/useFlooringCalc';
import type { FlooringKind } from '@/lib/v1/flooringQuery';

// 평형 칩 목록 — 도배와 같은 대표 평형 목록을 그대로 쓴다
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
  range: FlooringRange | null;
  loading: boolean;
  /** 계산 실패 메시지. 있으면 큰 숫자 자리에 실패 문구를 보여준다(재시도 버튼 없음) */
  error?: string | null;
  /** 다음 결과가 오기 전까지 이전 값을 보여주는 중이라는 표시(깜빡임 방지용, loading과 같은 취급) */
  stale?: boolean;
  /** 바닥재 종류. 위 바닥재 카드(MaterialPicker)에서 고른 값을 읽기만 한다(여기서 바꾸지 않음) */
  kind: FlooringKind | undefined;
  /** 물량 상세(구매 단위·수량·바닥 면적 등) */
  result: FlooringCalcResultDTO | null;
  /**
   * 결과가 없을 때(!range) 보여줄 한 줄. FlooringCalculator가 폼 상태를 보고 미리 계산해
   * 내려준다 — 결과 패널·하단 바와 문구를 통일하기 위해서다.
   */
  emptyMessage: string;
}

/** 큰 숫자 아래 줄 — "28박스 · 바닥 42㎡" 또는 "42m · 바닥 42㎡" (구매 단위에 따라 다르다) */
function formatQuantityLine(result: FlooringCalcResultDTO): string {
  const unitLabel = result.quantity.unit === '박스' ? '박스' : 'm';
  return `${formatNum(result.quantity.units)}${unitLabel} · 바닥 ${formatNum(result.quantity.floorSqm)}㎡`;
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
  kind,
  result,
  emptyMessage,
}: QuickAnswerProps) {
  // "직접 입력" 모드 여부 — 값이 프리셋과 같은지로 매번 다시 판단하지 않고 명시적 상태로 든다
  // (도배 QuickAnswer와 같은 이유 — 칩을 눌러야만 모드가 바뀐다)
  const [directMode, setDirectMode] = useState<boolean>(
    () => pyeong === '' || !PYEONG_CHIPS.includes(pyeong),
  );
  // 로딩 중이거나 이전 값을 보여주는 중이면 큰 숫자를 지우지 않고 옅게만 표시한다(깜빡임 방지 규칙)
  const dim = loading || stale;
  // 직접 입력한 평형이 서버가 거부하는 범위(5 미만)면 호출 전에 미리 알려준다
  const pyeongTooSmall = typeof pyeong === 'number' && pyeong > 0 && pyeong < 5;

  return (
    <Card>
      {/* 1) 평형 — 제목 없이 라벨만(20/700 큰 제목은 바닥재 카드가 이미 맨 위에 있어 중복이라 뺐다) */}
      <span className="text-[16px] font-semibold text-foreground">평형</span>
      {/* 가로 스크롤 대신 줄바꿈으로 둔다 — 360px 화면에서 칩 8개가 두 줄로 접힌다 */}
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

      {/* 3) 즉답 큰 숫자 — 실패/종류 미선택/5평 미만/평형 없음/정상 다섯 가지 상태만 있다 */}
      {error ? (
        <p className="text-[16px] text-foreground">계산에 실패했어요</p>
      ) : !kind ? (
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
              <p className="text-[16px] text-foreground tabular-nums">{formatQuantityLine(result)}</p>
              <p className="text-[14px] text-v1-text-disabled tabular-nums">{result.cost.basisLine}</p>
            </>
          )}
        </>
      )}
    </Card>
  );
}
