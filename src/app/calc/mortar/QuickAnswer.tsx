// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "간단하게 계산하기" 카드
//
// 면적(평/㎡ 토글, 또는 가로×세로) + 용도 칩만으로 즉답을 낸다. 값이 바뀌는 즉시
// 자동으로 계산되고, 결과는 ResultPanel이 그린다("계산하기" 버튼 없음).
//
// 레미탈 모드 — 용도 칩 4개(확장부 바닥 / 욕실·현관 구배 / 마루 철거 후 보수 / 방통 전체)를
//   누르면 06_미장.md 관행 두께로 자동 채워진다. 공법(장비 타설/손미장)도 용도가 정한다
//   (방통 전체만 장비 타설).
// 셀프레벨링 모드 — 두께 칩 5개(3/5/10/15/20mm, 그중 3개는 용도가 같이 붙어 있다).
//
// 2026-09-14 검사관 지적: 계산 훅(useMortarCalc)은 MortarCalculator 한 곳에서만 부르고
// 이 컴포넌트는 결과를 props로만 받는다(API 중복 호출 방지 — 전엔 QuickAnswer가 안 보일
// 때도 PreciseSection과 각자 따로 훅을 불러 매번 두 번 호출됐다).
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 14일(검사관 1라운드)
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import { formatManRange, formatNum } from '@/lib/v1/money';
import type { MortarFormState } from '@/lib/v1/mortarQuery';
import type { MortarCalcResultDTO, MortarRange } from '@/lib/v1/useMortarCalc';
import { USAGE_PRESET, USAGE_ORDER, SELF_LEVEL_THICKNESS_CHIPS } from '@/lib/v1/mortarPresets';

export interface QuickAnswerProps {
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  result: MortarCalcResultDTO | null;
  range: MortarRange | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
}

/** 면적 직접 입력 프리셋(평) — 미장은 보통 소면적이라 도배보다 작은 값 위주 */
const AREA_PRESETS_PYEONG: readonly number[] = [3, 5, 10, 20, 34];
const AREA_PRESETS_SQM: readonly number[] = [5, 10, 20, 33, 66];

export default function QuickAnswer({ form, patch, result, range, loading, error, stale }: QuickAnswerProps) {
  const mode = form.mode ?? '레미탈';
  const areaInputMode = form.areaInputMode ?? 'area';
  const areaUnit = form.areaUnit ?? '평';
  const dim = loading || stale;

  const presets = areaUnit === '평' ? AREA_PRESETS_PYEONG : AREA_PRESETS_SQM;

  return (
    <Card>
      {/* 1) 면적 — 평/㎡ 직접 입력 또는 가로×세로 */}
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold text-foreground">면적</span>
        <div className="flex gap-2">
          <Chip
            shape="square"
            selected={areaInputMode === 'area'}
            onClick={() => patch({ areaInputMode: 'area' })}
          >
            면적
          </Chip>
          <Chip
            shape="square"
            selected={areaInputMode === 'rect'}
            onClick={() => patch({ areaInputMode: 'rect' })}
          >
            가로×세로
          </Chip>
        </div>
      </div>

      {areaInputMode === 'area' ? (
        <>
          <div className="flex gap-2">
            <Chip selected={areaUnit === '평'} onClick={() => patch({ areaUnit: '평' })}>
              평
            </Chip>
            <Chip selected={areaUnit === '㎡'} onClick={() => patch({ areaUnit: '㎡' })}>
              ㎡
            </Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip key={p} selected={form.area === p} onClick={() => patch({ area: p })}>
                {p}
                {areaUnit}
              </Chip>
            ))}
          </div>
          <NumberField
            value={form.area ?? ''}
            onChange={(v) => patch({ area: v === '' ? undefined : v })}
            suffix={areaUnit}
            placeholder="면적을 입력하세요"
            aria-label="면적 직접 입력"
            className="w-full"
          />
        </>
      ) : (
        <div className="flex gap-2">
          <NumberField
            value={form.rectWidth ?? ''}
            onChange={(v) => patch({ rectWidth: v === '' ? undefined : v })}
            suffix="m"
            placeholder="가로"
            aria-label="가로(m)"
            className="flex-1 min-w-0"
          />
          <NumberField
            value={form.rectDepth ?? ''}
            onChange={(v) => patch({ rectDepth: v === '' ? undefined : v })}
            suffix="m"
            placeholder="세로"
            aria-label="세로(m)"
            className="flex-1 min-w-0"
          />
        </div>
      )}

      {/* 2) 용도(레미탈) / 두께(셀프레벨링) 칩 — 두께 기본값을 같이 채운다 */}
      {mode === '레미탈' ? (
        <>
          <span className="text-[16px] font-semibold text-foreground pt-1">용도</span>
          <div className="flex flex-wrap gap-2">
            {USAGE_ORDER.map((u) => (
              <Chip
                key={u}
                selected={form.usage === u}
                onClick={() => patch({ usage: u, thicknessMm: USAGE_PRESET[u].defaultMm, method: undefined })}
              >
                {USAGE_PRESET[u].label}
              </Chip>
            ))}
          </div>
        </>
      ) : (
        <>
          <span className="text-[16px] font-semibold text-foreground pt-1">두께</span>
          <div className="flex flex-wrap gap-2">
            {SELF_LEVEL_THICKNESS_CHIPS.map((c) => (
              <Chip
                key={c.mm}
                selected={form.thicknessMm === c.mm}
                onClick={() => patch({ thicknessMm: c.mm, selfLevelUsage: c.usage })}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </>
      )}

      {/* 3) 즉답 큰 숫자 */}
      {error ? (
        <p className="text-[16px] text-foreground">계산에 실패했어요</p>
      ) : !range || !result ? (
        <p className="text-[16px] text-v1-text-secondary">면적과 두께를 넣으면 바로 나와요</p>
      ) : (
        <>
          <div
            className={
              'text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] ' +
              `whitespace-nowrap transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`
            }
          >
            {formatNum(result.quantity.bags)}포
          </div>
          <p className="text-[16px] text-foreground tabular-nums">
            {formatManRange(range.min, range.max)} · 몰탈 {result.quantity.volumeWithLossM3}㎥ · 로스 {result.quantity.lossPct}% 포함
          </p>
          {/* 레미탈 장비 타설이면 장비비 별도, 셀프레벨링이면 시공비 별도 — 가격은 안 지어낸다 */}
          {(result.equipmentNote || result.laborAdvisoryNote) && (
            <p className="text-[14px] text-v1-text-secondary">{result.equipmentNote ?? result.laborAdvisoryNote}</p>
          )}
          <p className="text-[14px] text-v1-text-disabled tabular-nums">{result.cost.basisLine}</p>
        </>
      )}
    </Card>
  );
}
