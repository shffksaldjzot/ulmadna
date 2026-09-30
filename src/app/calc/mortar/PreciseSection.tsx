// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "정확하게 계산하기" 세부 조정
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9-2절: 정확 모드는 [용도 → 구역 → 두께] 3단계
// 뿐이다(도배·바닥재와 같은 세 칸). 예전엔 두께·구역·로스율·배합비·운송·양중·옵션·제품이
// 전부 이 파일 한 화면에 몰려 있었는데, 이제 두께는 3단계로, 구역은 2단계(PreciseRooms.tsx)로
// 각각 떨어져 나갔다. 이 파일은 남은 것 — "세부 조정" 접힘 구역(조정 칩 아래, 결과 카드
// 위, 카드로 안 감싼다)에 들어가는 내용만 담당한다:
//   제품(포대 규격) · 로스율 · 와이어메시(레미탈) · 프라이머 · 배합비(레미탈) · 배송비 ·
//   지게차 하차비 · 양중비
// 값 범위·기본값은 하나도 안 바꿨다 — 예전 PreciseSection.tsx의 해당 블록을 그대로 옮겼다.
//
// 운반(층수·엘리베이터) 가산은 06_미장.md에 근거 수치가 없어 옵션 자체를 넣지 않는다
// (지시서 원칙 — 근거 없는 항목은 만들지 말고 숨긴다).
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 피드백 2라운드)
// 세부 조정만 남기고 두께·구역을 단계로 분리: 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import NumberField from '@/components/v1/NumberField';
import Toggle from '@/components/v1/Toggle';
import { IconChevronDown } from '@/components/v1/icons';
import type { MortarFormState } from '@/lib/v1/mortarQuery';
import type { MortarProductOption } from '@/lib/v1/mortarProductOptions';
import { productCoversThickness, formatMortarProductLabel } from '@/lib/v1/mortarProductOptions';
import type { MortarCalcResultDTO } from '@/lib/v1/useMortarCalc';
import { MONEY_INPUT_WON_MAX, FORKLIFT_DEFAULT_FEE_WON } from '@/lib/v1/mortarPresets';
import { moneyRangeCaption } from '../_components/inputRanges';

export interface PreciseSectionProps {
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  products: MortarProductOption[];
  /** 서버 계산 결과 — "참고값 채우기" 버튼이 양중비 참고값을 가져올 때만 쓴다 */
  result: MortarCalcResultDTO | null;
}

/** 로스율 조정 칩(%) */
const LOSS_CHIPS: readonly number[] = [0, 5, 10, 15];

/** 값이 0보다 큰 유한수인지 — 운송·양중비 콤마 캡션을 보여줄지 판단할 때 쓴다 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export default function PreciseSection({ form, patch, products, result }: PreciseSectionProps) {
  const mode = form.mode ?? '레미탈';

  // 2026-09-29 지적 4번(검사관이 확인 못 한 부분) — "지게차 하차비" 토글의 켜짐 여부를
  // form.forkliftFeeWon > 0으로만 판정하면, 사용자가 금액 칸을 전부 지우고 새 값을 치는
  // 그 짧은 순간(칸이 빈 값 = 0으로 취급)에 토글이 꺼진 것처럼 보이면서 금액 칸 자체가
  // 화면에서 사라져 버렸다(칸을 다시 채울 방법이 없어짐 — 포커스도 같이 날아간다). 토글
  // 켜짐 여부는 이 부품의 로컬 상태로 따로 기억해서, 금액이 잠깐 비어도 칸이 안 사라지게
  // 한다. 값 범위·기본값 자체는 안 바꿨다(초기값만 기존 값 유무로 정한다).
  const [forkliftOn, setForkliftOn] = useState(isPositive(form.forkliftFeeWon));
  const lossPct = Math.round((form.lossRate ?? 0.05) * 100);

  // 2026-09-29 지적 2번: 서버·엔진 최댓값(MONEY_INPUT_WON_MAX)을 넘으면 칸 아래에
  // 짧게 안내한다(면적·두께와 같은 캡션 규칙, formatNum이 아니라 "만원" 단위로 보여준다).
  // 실제 계산에서 그 값을 안 쓰고 직전 유효값을 쓰는 처리는 MortarCalculator.tsx가 한다
  // (이 부품은 화면 표시만 맡는다 — form.값은 사용자가 친 그대로 유지해야 칸이 안 변한다).
  const deliveryCaption = moneyRangeCaption(form.deliveryFeeWon, MONEY_INPUT_WON_MAX);
  const forkliftCaption = moneyRangeCaption(form.forkliftFeeWon, MONEY_INPUT_WON_MAX);
  const liftingCaption = moneyRangeCaption(form.liftingFeeWon, MONEY_INPUT_WON_MAX);

  const modeProducts = products.filter((p) => p.mode === mode);
  // 지금 고른 공법 — 2026-09-27 지시서 9-2절: 공법 자체는 이제 조정 칩 구역
  // (MortarCalculator)에 있고, 여기서는 세부 조정 안의 다른 값들만 다룬다.

  /**
   * 제품을 고를 때 — 셀프레벨링 모드에서 지금 두께가 그 제품 범위 밖이면
   * 두께를 그 제품 범위 안(가까운 쪽 경계)으로 당겨 온다.
   */
  function handleProductSelect(code: string | undefined) {
    if (mode === '셀프레벨링' && code) {
      const picked = modeProducts.find((p) => p.code === code);
      if (picked && form.thicknessMm != null && !productCoversThickness(picked, form.thicknessMm)) {
        const clamped = Math.min(picked.maxThicknessMm, Math.max(picked.minThicknessMm, form.thicknessMm));
        patch({ productCode: code, thicknessMm: clamped });
        return;
      }
    }
    patch({ productCode: code });
  }

  return (
    // 지시서 9-2절: "세부 조정"은 카드로 감싸지 않는다(테두리·배경 없음) — 이 컴포넌트
    // 자체는 그냥 세로로 쌓인 입력 블록만 그리고, 감싸는 Collapsible·여백은 부르는 쪽
    // (MortarCalculator)이 맡는다.
    // 2026-09-29 지적 3번: flowFocusScope를 여기(세부 조정)에도 줘서 안의 입력 칸
    // 초점 테두리가 새 틀 규칙(--accent)을 따르게 한다(진한 갈색이 아니라).
    // 항목 묶음을 넷으로 나눴다: [로스율·배합비] / [배송비·지게차 하차비·양중비] /
    // [와이어메시·프라이머] / [제품] — 구분선은 묶음 "사이"에만 두고, 같은 묶음 안
    // 항목들은 구분선 없이 같은 간격(gap-3)으로 둔다(예전엔 항목마다 들쭉날쭉했다).
    <div className="flowFocusScope flex flex-col gap-4">
      {/* 묶음 1: 로스율 · 배합비 — 첫 묶음이라 구분선 없음 */}
      <div className="flex flex-col gap-3">
        {/* 칩이 4개라 360px에서 라벨과 한 줄에 다 안 들어가면 라벨 글자가 한 글자씩
            세로로 깨지는 문제가 있었다(현장 검수 지적) — 라벨은 줄바꿈 금지로 고정하고,
            칩 묶음은 통째로 다음 줄로 넘어가게 한다(글자 단위가 아니라 칩 단위로 줄바꿈) */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 min-h-11">
          <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">로스율</span>
          <ChipGroup role="radiogroup" ariaLabel="로스율" className="flex flex-wrap gap-2 justify-end">
            {LOSS_CHIPS.map((p) => (
              <Chip key={p} asRadio selected={lossPct === p} onClick={() => patch({ lossRate: p / 100 })}>
                {p}%
              </Chip>
            ))}
          </ChipGroup>
        </div>

        {/* 배합비(레미탈 전용) — 현장 배합 대안 계산에만 쓴다 */}
        {mode === '레미탈' && (
          <div className="flex items-center justify-between min-h-11">
            <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">배합비</span>
            <ChipGroup role="radiogroup" ariaLabel="배합비" className="flex gap-2">
              <Chip shape="square" asRadio selected={(form.mixRatio ?? '1:3') === '1:2'} onClick={() => patch({ mixRatio: '1:2' })}>
                1:2
              </Chip>
              <Chip shape="square" asRadio selected={(form.mixRatio ?? '1:3') === '1:3'} onClick={() => patch({ mixRatio: '1:3' })}>
                1:3
              </Chip>
            </ChipGroup>
          </div>
        )}
      </div>

      {/* 묶음 2: 배송비 · 지게차 하차비 · 양중비(06_미장.md §11-2·§11-3) */}
      <div className="flex flex-col gap-3 pt-3 border-t border-v1-line-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between min-h-11">
            <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">배송비</span>
            {/* 2026-09-29 지적 3번: 칸 아래에 값을 되풀이하던 글("50,000원")을 지우고
                showCommas로 칸 안 숫자 자체에 쉼표를 넣었다 — 안 넣었을 때만 안내 한 줄 유지 */}
            <NumberField
              value={form.deliveryFeeWon ?? ''}
              onChange={(v) => patch({ deliveryFeeWon: v === '' ? undefined : v })}
              suffix="원"
              placeholder="0"
              aria-label="배송비(원)"
              min={0}
              max={MONEY_INPUT_WON_MAX}
              showCommas
              className="w-32"
            />
          </div>
          {!isPositive(form.deliveryFeeWon) && <p className="t-sub text-ink-2">지역별로 달라요</p>}
          {/* 2026-09-29 지적 2번: 서버·엔진 상한을 넘으면 안내 — 실제 계산은 직전 유효값을 쓴다 */}
          {deliveryCaption && <p className="t-sub text-danger">{deliveryCaption}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between min-h-11">
            <span className="text-[15px] text-foreground">지게차 하차비</span>
            <Toggle
              checked={forkliftOn}
              onChange={(v) => {
                setForkliftOn(v);
                patch({ forkliftFeeWon: v ? FORKLIFT_DEFAULT_FEE_WON : undefined });
              }}
              label="지게차 하차비 포함"
            />
          </div>
          {/* 켰을 때만 금액 칸을 보여준다 — 기본 10만원(운영자 현장 기준), 직접 수정 가능.
              forkliftOn(로컬 상태)으로 판정한다 — form.forkliftFeeWon으로 판정하면 금액을
              지우는 동안 칸이 사라지는 사고가 난다(위 주석 참고) */}
          {forkliftOn && (
            <div className="flex flex-col items-end gap-1">
              <NumberField
                value={form.forkliftFeeWon ?? ''}
                onChange={(v) => patch({ forkliftFeeWon: v === '' ? undefined : v })}
                suffix="원"
                aria-label="지게차 하차비(원)"
                min={0}
                max={MONEY_INPUT_WON_MAX}
                showCommas
                className="w-32"
              />
              {forkliftCaption && <p className="t-sub text-danger">{forkliftCaption}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between min-h-11">
            <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">양중비</span>
            <NumberField
              value={form.liftingFeeWon ?? ''}
              onChange={(v) => patch({ liftingFeeWon: v === '' ? undefined : v })}
              suffix="원"
              placeholder="0"
              aria-label="양중비(원)"
              min={0}
              max={MONEY_INPUT_WON_MAX}
              showCommas
              className="w-32"
            />
          </div>
          {/* 2026-09-27 저녁 지휘관 3차 검수 지적 7번: "참고값 채우기"를 글자 링크가
              아니라 눌리는 범위 44px가 확실한 칩 모양 버튼으로(Chip이 이미 그 히트존
              확장을 갖고 있어 그대로 재사용한다). 안 넣었을 때만 안내 한 줄 유지 */}
          <div className="flex items-center justify-between gap-2">
            {!isPositive(form.liftingFeeWon) ? (
              <p className="t-sub text-ink-2">표준품셈 노임 기준</p>
            ) : (
              <span />
            )}
            <Chip
              size="sm"
              disabled={!result}
              onClick={() => result && patch({ liftingFeeWon: result.liftingReferenceWon })}
              className="flex-none disabled:opacity-40"
            >
              참고값 채우기
            </Chip>
          </div>
          {liftingCaption && <p className="t-sub text-danger">{liftingCaption}</p>}
        </div>
      </div>

      {/* 묶음 3: 옵션 — 와이어메시(레미탈 전용)·프라이머 */}
      <div className="flex flex-col gap-3 pt-3 border-t border-v1-line-2">
        {mode === '레미탈' && (
          <div className="flex items-center justify-between min-h-11">
            <span className="text-[15px] text-foreground">와이어메시</span>
            <Toggle checked={form.wireMesh ?? false} onChange={(v) => patch({ wireMesh: v })} label="와이어메시 포함" />
          </div>
        )}
        <div className="flex items-center justify-between min-h-11">
          <span className="text-[15px] text-foreground">프라이머</span>
          <Toggle
            checked={form.primer ?? mode === '셀프레벨링'}
            onChange={(v) => patch({ primer: v })}
            label="프라이머 포함"
          />
        </div>
      </div>

      {/* 묶음 4: 제품 선택 — 06_미장.md에 있는 제조사 목록만(직접 입력 없음). 포장 kg를 항상 적는다 */}
      <div className="flex flex-col pt-3 border-t border-v1-line-2">
        <label className="text-[13px] text-v1-text-label pb-1" htmlFor="mortar-product-select">
          제품
        </label>
        <div className="relative">
          <select
            id="mortar-product-select"
            aria-label="제품"
            value={form.productCode ?? ''}
            onChange={(e) => handleProductSelect(e.target.value === '' ? undefined : e.target.value)}
            className="w-full h-11 appearance-none rounded-lg border border-v1-line-2 bg-white pl-3 pr-10 text-[16px] text-foreground focus:outline-none focus:border-brown"
          >
            <option value="">제품 선택 안 함(기본 계수)</option>
            {modeProducts.map((p) => (
              <option key={p.code} value={p.code}>
                {formatMortarProductLabel(p)}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <IconChevronDown className="text-v1-text-label" />
          </span>
        </div>
      </div>
    </div>
  );
}
