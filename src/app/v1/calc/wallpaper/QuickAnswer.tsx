// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 즉답 블록
// 평형 하나만 넣으면 그 자리에서 바로 범위 견적이 뜨는 첫 화면 (설계 정본 0-C절 제1 차별점).
// 그 아래 "범위·벽지·지역·상태" 칩 4줄을 답할수록 즉답 범위가 좁아진다.
//
// 작성일: 2026년 09월 08일
// 채움: 2026년 09월 09일 (B 지시서)
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import RegionPicker from '@/components/v1/RegionPicker';
import { formatManRange, formatNum } from '@/lib/v1/money';
import type { PreciseInputInfo } from '@/lib/v1/wallpaperEngineInput';
import type { WallpaperCalcResultDTO, WallpaperRange } from '@/lib/v1/useWallpaperCalc';

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
  /** 즉답 금액 범위. 벽지 종류를 아직 안 고르면 합지~실크 폭까지 넓게 잡힌 값이 들어온다 */
  range: WallpaperRange | null;
  loading: boolean;
  /** 계산 실패 메시지. 있으면 큰 숫자 자리에 실패 문구를 보여준다(재시도 버튼 없음) */
  error?: string | null;
  /** 다음 결과가 오기 전까지 이전 값을 보여주는 중이라는 표시(깜빡임 방지용, loading과 같은 취급) */
  stale?: boolean;
  /** 도배 대상 — 벽+천장 / 벽만 (이 화면은 두 개만 노출) */
  target: 'wall' | 'both';
  onTargetChange: (v: 'wall' | 'both') => void;
  /** 벽지 종류. undefined = "아직 몰라요"(즉답 단계 기본, 합지~실크 합집합) */
  paperType: '합지' | '실크' | undefined;
  onPaperTypeChange: (v: '합지' | '실크' | undefined) => void;
  /** 지역(선택). 비용에만 영향 */
  region: string | undefined;
  onRegionChange: (v: string | undefined) => void;
  /** 구축(재도배) 여부. 기본 false(신축·빈집) */
  isOld: boolean;
  onIsOldChange: (v: boolean) => void;
  /** 롤·면적 줄에 쓰는 계산 결과(물량 상세) */
  result: WallpaperCalcResultDTO | null;
  /** 정밀 폼(방별 실측/벽 길이)이 지금 유효한지. 있으면 평형·베이 칩을 잠근다(정밀 폼이 우선이라서) */
  precise?: PreciseInputInfo;
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
  onPaperTypeChange,
  region,
  onRegionChange,
  isOld,
  onIsOldChange,
  result,
  precise = null,
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
  // 정밀 폼(방별 실측 또는 벽 길이)이 유효하면 평형·베이 칩은 눌러도 소용없는 죽은 버튼이 된다
  // — 아예 잠그고(옅게 + 클릭 막음) 이유를 한 줄로 알려준다(검사관 지적 4번·N2)
  const preciseLocked = precise !== null;
  // 직접 입력한 평형이 1~4처럼 서버가 거부하는 범위(5 미만)면 호출 전에 미리 알려준다(검사관 지적 10번)
  const pyeongTooSmall = typeof pyeong === 'number' && pyeong > 0 && pyeong < 5;

  return (
    <Card>
      {/* 1)+2) 평형·베이 — 정밀 폼(방별 실측/벽 길이)이 유효하면 그게 우선이라 둘 다 잠그고
          이유를 한 줄로 알려준다 */}
      <div className={preciseLocked ? 'opacity-50 pointer-events-none' : undefined}>
        <h2 className="text-[20px] font-bold text-foreground">우리 집 몇 평?</h2>
        {/* 가로 스크롤 대신 줄바꿈으로 둔다(검사관 지적) — 360px 화면에서 칩 8개가 두 줄로
            접힌다. 순서는 [직접 입력][18][24][25][30][34][40][45]를 그대로 유지한다 */}
        <div className="flex flex-wrap gap-2 mt-2">
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
            className="mt-2 w-full"
          />
        )}

        {/* 베이(구조) — 물량 정확도에 영향을 주는 값이라 평형 바로 아래에 둔다 */}
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <span className="text-[16px] font-semibold text-foreground">베이</span>
          {BAY_CHIPS.map((b) => (
            <Chip key={b} selected={bay === b} onClick={() => onBayChange(b)}>
              {b}베이
            </Chip>
          ))}
        </div>
      </div>
      {precise?.kind === 'room' && (
        <p className="text-[14px] text-v1-text-secondary">실측 {precise.count}개 방으로 계산 중</p>
      )}
      {precise?.kind === 'length' && (
        <p className="text-[14px] text-v1-text-secondary">벽 길이로 계산 중</p>
      )}

      {/* 3) 즉답 큰 숫자 — 실패/5평 미만/빈값/정상 네 가지 상태만 있다 */}
      {error ? (
        <p className="text-[16px] text-foreground">계산에 실패했어요</p>
      ) : pyeongTooSmall ? (
        <p className="text-[16px] text-v1-text-secondary">5평부터 계산해요</p>
      ) : !range ? (
        <p className="text-[16px] text-v1-text-secondary">평형을 고르면 바로 나와요</p>
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

      {/* 4) 칩 4줄 — 답할수록 즉답 범위가 좁아진다("더 정확하게" 유도 문구는 여기서 쓰지 않는다) */}
      <div className="flex flex-col gap-3 pt-2 border-t border-v1-line-2">
        <div className="flex flex-col gap-1">
          <span className="text-[14px] text-v1-text-label">범위</span>
          <div className="flex gap-2">
            <Chip selected={target === 'both'} onClick={() => onTargetChange('both')}>
              벽+천장
            </Chip>
            <Chip selected={target === 'wall'} onClick={() => onTargetChange('wall')}>
              벽만
            </Chip>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[14px] text-v1-text-label">벽지</span>
          <div className="flex gap-2">
            <Chip selected={paperType === undefined} onClick={() => onPaperTypeChange(undefined)}>
              아직 몰라요
            </Chip>
            <Chip selected={paperType === '합지'} onClick={() => onPaperTypeChange('합지')}>
              합지
            </Chip>
            <Chip selected={paperType === '실크'} onClick={() => onPaperTypeChange('실크')}>
              실크
            </Chip>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[14px] text-v1-text-label">지역</span>
          <RegionPicker value={region} onChange={onRegionChange} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[14px] text-v1-text-label">상태</span>
          <div className="flex gap-2">
            <Chip selected={!isOld} onClick={() => onIsOldChange(false)}>
              신축·빈집
            </Chip>
            <Chip selected={isOld} onClick={() => onIsOldChange(true)}>
              구축·재도배
            </Chip>
          </div>
        </div>
      </div>
    </Card>
  );
}
