// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "간단하게 계산하기" 카드
//
// 면적(평/㎡ 토글, 또는 가로×세로) + 용도 칩 + 두께 칩만으로 즉답을 낸다. 포수는 서버
// 응답을 기다리지 않고 quick(useMortarQuickCalc, 클라이언트 즉시 계산)으로 바로 보여주고,
// 비용 범위만 서버 응답(result)이 오면 덧붙인다("계산하기" 버튼 없음).
//
// 레미탈 모드 — 용도 칩 4개(확장부 바닥 / 욕실·현관 구배 / 마루 철거 후 보수 / 방통 전체)를
//   누르면 06_미장.md 관행 두께로 자동 채워진다. 공법(장비 타설/손미장)도 용도가 정한다
//   (방통 전체만 장비 타설). 그 아래 두께 칩 줄(30~150mm) + 직접 입력 칸을 따로 둔다
//   (2026-09-15 형아 피드백: 방통은 현장에서 50~150mm까지도 흔히 쓴다).
// 셀프레벨링 모드 — 용도 칩 3개(두께 기본값만 정한다) + 두께 칩 6개(3~30mm) + 직접 입력.
//
// 2026-09-15 형아 피드백:
//   - "레미탈 포수가 안 보였다" → 큰 숫자를 quick(즉시 계산)에서 가져와 항상 보여준다.
//   - "몇 kg짜리 몇 포인지 안 보인다" → 큰 숫자를 "레미탈 40kg × 65포" 형태로 쓰고,
//     그 아래 제품명 + "주문 수량: N포(로스 5% 포함)" 캡션을 붙인다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(형아 피드백 2라운드)
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import { formatManRange, formatNum } from '@/lib/v1/money';
import AreaInput from '../_components/AreaInput';
import type { MortarFormState } from '@/lib/v1/mortarQuery';
import type { MortarCalcResultDTO, MortarRange } from '@/lib/v1/useMortarCalc';
import type { MortarQuickResult } from '@/lib/v1/useMortarQuickCalc';
import {
  USAGE_PRESET,
  USAGE_ORDER,
  SELF_LEVEL_USAGE_PRESET,
  SELF_LEVEL_USAGE_ORDER,
  REMICON_THICKNESS_CHIPS,
  SELF_LEVEL_THICKNESS_CHIPS,
} from '@/lib/v1/mortarPresets';

export interface QuickAnswerProps {
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  /** 즉시 계산 결과(서버 응답 없이도 항상 있음) — 포수·체적은 여기서만 가져온다 */
  quick: MortarQuickResult | null;
  /** 서버 계산 결과(비용·인건). 늦게 오거나 없을 수 있다 */
  result: MortarCalcResultDTO | null;
  range: MortarRange | null;
  /** 서버 계산 실패 메시지. 있으면 비용 자리에 "비용은 잠시 후 다시"만 보여준다(포수는 그대로 남는다) */
  error?: string | null;
}

/** 면적 직접 입력 프리셋(평) — 미장은 보통 소면적이라 도배보다 작은 값 위주 */
const AREA_PRESETS_PYEONG: readonly number[] = [3, 5, 10, 20, 34];
const AREA_PRESETS_SQM: readonly number[] = [5, 10, 20, 33, 66];

export default function QuickAnswer({ form, patch, quick, result, range, error }: QuickAnswerProps) {
  const mode = form.mode ?? '레미탈';
  const areaInputMode = form.areaInputMode ?? 'area';
  const areaUnit = form.areaUnit ?? '평';

  const presets = areaUnit === '평' ? AREA_PRESETS_PYEONG : AREA_PRESETS_SQM;
  const thicknessChips = mode === '레미탈' ? REMICON_THICKNESS_CHIPS : SELF_LEVEL_THICKNESS_CHIPS;

  return (
    <Card>
      {/* 1) 시공 면적 — 평/㎡ 직접 입력 또는 가로×세로. 라벨을 "시공 면적"으로 둬서(2026-09-15
          형아 지시) 집 평형이 아니라 "바를 바닥 면적"이라는 걸 캡션 1줄로 분명히 한다 */}
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold text-foreground">시공 면적</span>
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
      <p className="text-[14px] text-v1-text-secondary">바를 바닥 면적 기준</p>

      {areaInputMode === 'area' ? (
        // 공용 부품(AreaInput) — 미장은 "시공 면적"(공급/전용 구분 없음)이라 mode="work".
        // 바깥에 이미 "시공 면적" 제목이 있어 label은 비워 토글만 왼쪽 정렬로 그린다.
        <AreaInput
          mode="work"
          unit={areaUnit}
          onUnitChange={(u) => patch({ areaUnit: u })}
          value={form.area ?? ''}
          onValueChange={(v) => patch({ area: v === '' ? undefined : v })}
          chips={presets}
          placeholder="면적을 입력하세요"
        />
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

      {/* 2) 용도 — 두께·(레미탈만) 공법 기본값을 같이 채운다 */}
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
          <span className="text-[16px] font-semibold text-foreground pt-1">용도</span>
          <div className="flex flex-wrap gap-2">
            {SELF_LEVEL_USAGE_ORDER.map((u) => (
              <Chip
                key={u}
                selected={form.selfLevelUsage === u}
                onClick={() => patch({ selfLevelUsage: u, thicknessMm: SELF_LEVEL_USAGE_PRESET[u].defaultMm })}
              >
                {SELF_LEVEL_USAGE_PRESET[u].label}
              </Chip>
            ))}
          </div>
        </>
      )}

      {/* 3) 두께 — 칩(용도를 고르면 기본값이 자동 선택된다) + 직접 입력.
          2026-09-15 형아 피드백: 용도 아래에 두께 칩 줄을 따로 두고, 바꾸면 그 값이 우선한다
          (용도를 다시 누르면 그 용도의 기본값으로 되돌아간다) */}
      <span className="text-[16px] font-semibold text-foreground pt-1">두께</span>
      <div className="flex flex-wrap gap-2">
        {thicknessChips.map((mm) => (
          <Chip key={mm} selected={form.thicknessMm === mm} onClick={() => patch({ thicknessMm: mm })}>
            {mm}mm
          </Chip>
        ))}
      </div>
      <NumberField
        value={form.thicknessMm ?? ''}
        onChange={(v) => patch({ thicknessMm: v === '' ? undefined : v })}
        suffix="mm"
        placeholder="두께 직접 입력"
        aria-label="두께 직접 입력"
        className="w-full"
      />
      <p className="text-[14px] text-v1-text-secondary">용도별 기본값, 바꿔도 돼요</p>
      {quick?.standardRangeNote && <p className="text-[14px] text-v1-text-secondary">{quick.standardRangeNote}</p>}

      {/* 4) 즉답 큰 숫자 — "레미탈 40kg × 65포" 형태(65가 크다). 서버 응답 없이 quick으로 바로 나온다 */}
      {!quick ? (
        <p className="text-[16px] text-v1-text-secondary">면적과 두께를 넣으면 바로 나와요</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-[20px] font-semibold text-foreground whitespace-nowrap">
              {quick.mode} {quick.bagKg}kg ×
            </span>
            <span className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
              {formatNum(quick.bags)}
            </span>
            <span className="text-[20px] font-semibold text-foreground">포</span>
          </div>
          <p className="text-[16px] text-foreground">{quick.productLabel}</p>
          <p className="text-[14px] text-v1-text-disabled tabular-nums">
            주문 수량: {formatNum(quick.bags)}포(로스 {quick.lossPct}% 포함)
          </p>

          {error ? (
            <p className="text-[14px] text-v1-text-secondary">비용은 잠시 후 다시</p>
          ) : (
            result &&
            range && (
              <p className="text-[16px] text-foreground tabular-nums">
                {formatManRange(range.min, range.max)} · 몰탈 {quick.volumeWithLossM3}㎥
              </p>
            )
          )}
          <p className="text-[14px] text-v1-text-disabled tabular-nums">{result?.cost.basisLine}</p>
        </>
      )}
    </Card>
  );
}
