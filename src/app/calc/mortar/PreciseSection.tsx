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

import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import Toggle from '@/components/v1/Toggle';
import { IconChevronDown } from '@/components/v1/icons';
import { formatNum } from '@/lib/v1/money';
import type { MortarFormState } from '@/lib/v1/mortarQuery';
import type { MortarProductOption } from '@/lib/v1/mortarProductOptions';
import { productCoversThickness, formatMortarProductLabel } from '@/lib/v1/mortarProductOptions';
import type { MortarCalcResultDTO } from '@/lib/v1/useMortarCalc';
import { MONEY_INPUT_WON_MAX, FORKLIFT_DEFAULT_FEE_WON } from '@/lib/v1/mortarPresets';

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
  const lossPct = Math.round((form.lossRate ?? 0.05) * 100);

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
    <div className="flex flex-col gap-4">
      {/* 1. 로스율 — 칩이 4개라 360px에서 라벨과 한 줄에 다 안 들어가면 라벨 글자가 한 글자씩
          세로로 깨지는 문제가 있었다(현장 검수 지적) — 라벨은 줄바꿈 금지로 고정하고,
          칩 묶음은 통째로 다음 줄로 넘어가게 한다(글자 단위가 아니라 칩 단위로 줄바꿈) */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">로스율</span>
        <div className="flex flex-wrap gap-2 justify-end">
          {LOSS_CHIPS.map((p) => (
            <Chip key={p} selected={lossPct === p} onClick={() => patch({ lossRate: p / 100 })}>
              {p}%
            </Chip>
          ))}
        </div>
      </div>

      {/* 2. 배합비(레미탈 전용) — 현장 배합 대안 계산에만 쓴다 */}
      {mode === '레미탈' && (
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">배합비</span>
          <div className="flex gap-2">
            <Chip shape="square" selected={(form.mixRatio ?? '1:3') === '1:2'} onClick={() => patch({ mixRatio: '1:2' })}>
              1:2
            </Chip>
            <Chip shape="square" selected={(form.mixRatio ?? '1:3') === '1:3'} onClick={() => patch({ mixRatio: '1:3' })}>
              1:3
            </Chip>
          </div>
        </div>
      )}

      {/* 3. 운송·하차 — 배송비 직접 입력 + 지게차 하차비 옵션(06_미장.md §11-2) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">배송비</span>
          <NumberField
            value={form.deliveryFeeWon ?? ''}
            onChange={(v) => patch({ deliveryFeeWon: v === '' ? undefined : v })}
            suffix="원"
            placeholder="0"
            aria-label="배송비(원)"
            min={0}
            max={MONEY_INPUT_WON_MAX}
            className="w-32"
          />
        </div>
        {/* 2026-09-27 저녁 지휘관 3차 검수 지적 7번: 긴 안내 문장을 줄였다 — 값이 있으면
            콤마 찍힌 금액만, 없으면 짧은 한마디("지역별로 달라요")만 보여준다 */}
        <p className="t-sub text-ink-2 tabular-nums">
          {isPositive(form.deliveryFeeWon) ? `${formatNum(form.deliveryFeeWon)}원` : '지역별로 달라요'}
        </p>
      </div>
      <div className="flex flex-col gap-1 py-2 border-t border-v1-line-2">
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-foreground">지게차 하차비</span>
          <Toggle
            checked={(form.forkliftFeeWon ?? 0) > 0}
            onChange={(v) => patch({ forkliftFeeWon: v ? FORKLIFT_DEFAULT_FEE_WON : undefined })}
            label="지게차 하차비 포함"
          />
        </div>
        {/* 켰을 때만 금액 칸을 보여준다 — 기본 10만원(운영자 현장 기준), 직접 수정 가능 */}
        {(form.forkliftFeeWon ?? 0) > 0 && (
          <div className="flex flex-col items-end gap-1">
            <NumberField
              value={form.forkliftFeeWon ?? ''}
              onChange={(v) => patch({ forkliftFeeWon: v === '' ? undefined : v })}
              suffix="원"
              aria-label="지게차 하차비(원)"
              min={0}
              max={MONEY_INPUT_WON_MAX}
              className="w-32"
            />
            {isPositive(form.forkliftFeeWon) && (
              <p className="text-[13px] text-v1-text-disabled tabular-nums">{formatNum(form.forkliftFeeWon)}원</p>
            )}
          </div>
        )}
      </div>

      {/* 4. 양중 — 사용자 직접 입력 + 참고값 채우기(06_미장.md §11-3) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">양중비</span>
          <NumberField
            value={form.liftingFeeWon ?? ''}
            onChange={(v) => patch({ liftingFeeWon: v === '' ? undefined : v })}
            suffix="원"
            placeholder="0"
            aria-label="양중비(원)"
            min={0}
            max={MONEY_INPUT_WON_MAX}
            className="w-32"
          />
        </div>
        {/* 2026-09-27 저녁 지휘관 3차 검수 지적 7번: 긴 안내 문장을 줄이고, "참고값
            채우기"를 글자 링크가 아니라 눌리는 범위 44px가 확실한 칩 모양 버튼으로
            바꿨다(Chip이 이미 그 하트존 확장을 갖고 있어 그대로 재사용한다) */}
        <div className="flex items-center justify-between gap-2">
          <p className="t-sub text-ink-2 tabular-nums">
            {isPositive(form.liftingFeeWon) ? `${formatNum(form.liftingFeeWon)}원` : '표준품셈 노임 기준'}
          </p>
          <Chip
            size="sm"
            disabled={!result}
            onClick={() => result && patch({ liftingFeeWon: result.liftingReferenceWon })}
            className="flex-none disabled:opacity-40"
          >
            참고값 채우기
          </Chip>
        </div>
      </div>

      {/* 5. 옵션 — 와이어메시(레미탈 전용)·프라이머 */}
      {mode === '레미탈' && (
        <div className="flex items-center justify-between py-2 border-t border-v1-line-2">
          <span className="text-[15px] text-foreground">와이어메시</span>
          <Toggle checked={form.wireMesh ?? false} onChange={(v) => patch({ wireMesh: v })} label="와이어메시 포함" />
        </div>
      )}
      <div className="flex items-center justify-between py-2 border-t border-v1-line-2">
        <span className="text-[15px] text-foreground">프라이머</span>
        <Toggle
          checked={form.primer ?? mode === '셀프레벨링'}
          onChange={(v) => patch({ primer: v })}
          label="프라이머 포함"
        />
      </div>

      {/* 6. 제품 선택 — 06_미장.md에 있는 제조사 목록만(직접 입력 없음). 포장 kg를 항상 적는다 */}
      <div className="flex flex-col">
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
