// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "정확하게 계산하기" 카드
//
// 두께 숫자 입력, 실별 면적 여러 개, 공법 토글(레미탈 전용), 로스율 조정,
// 옵션(와이어메시·프라이머), 제품 선택을 담당한다. 포수는 서버 응답을 기다리지 않고
// quick(useMortarQuickCalc, 클라이언트 즉시 계산)으로 바로 보여주고, 비용 범위만
// 서버 응답(result)이 오면 덧붙인다.
//
// 운반(층수·엘리베이터) 가산은 06_미장.md에 근거 수치가 없어 옵션 자체를 넣지 않는다
// (지시서 원칙 — 근거 없는 항목은 만들지 말고 숨긴다).
//
// 2026-09-15 운영자 현장 기준 피드백 2라운드:
//   - 두께 슬라이더를 없애고 mm 숫자 입력으로 바꿨다(모바일 숫자 키패드, 스텝 5).
//     레미탈은 10~150mm(현장에서 방통이 50~150mm까지 흔하다), 셀프레벨링은 1~50mm.
//   - 06_미장.md 표준 범위(레미탈 10~50mm)를 넘으면 계산은 그대로 하되 캡션 1줄을 띄운다.
//   - 제품 선택 칸에 포장 kg를 반드시 적는다("삼표 SP몰탈 일반미장용 · 40kg · 10~50mm").
//   - 즉답 큰 숫자를 "레미탈 40kg × 65포" 형태로, 제품명·주문 수량 캡션을 같이 보여준다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 피드백 2라운드)
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import Toggle from '@/components/v1/Toggle';
import { IconChevronDown } from '@/components/v1/icons';
import { formatNum } from '@/lib/v1/money';
import type { MortarFormState, MortarPreciseRoom } from '@/lib/v1/mortarQuery';
import type { MortarProductOption } from '@/lib/v1/mortarProductOptions';
import { productCoversThickness, recommendSelfLevelProduct, formatMortarProductLabel } from '@/lib/v1/mortarProductOptions';
import type { MortarCalcResultDTO } from '@/lib/v1/useMortarCalc';
import type { MortarQuickResult } from '@/lib/v1/useMortarQuickCalc';
import {
  USAGE_PRESET,
  THICKNESS_MM_MIN,
  thicknessMmMax,
  METHOD_CAPTION,
  MONEY_INPUT_WON_MAX,
  FORKLIFT_DEFAULT_FEE_WON,
} from '@/lib/v1/mortarPresets';

export interface PreciseSectionProps {
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  products: MortarProductOption[];
  /** 즉시 계산 결과(서버 응답 없이도 항상 있음) — 표준 범위 벗어남 안내에만 쓴다 */
  quick: MortarQuickResult | null;
  /** 서버 계산 결과 — "참고값 채우기" 버튼이 양중비 참고값을 가져올 때만 쓴다 */
  result: MortarCalcResultDTO | null;
}

/** 로스율 조정 칩(%) */
const LOSS_CHIPS: readonly number[] = [0, 5, 10, 15];

/** 값이 0보다 큰 유한수인지 — 운송·양중비 콤마 캡션을 보여줄지 판단할 때 쓴다 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export default function PreciseSection({ form, patch, products, quick, result }: PreciseSectionProps) {
  const mode = form.mode ?? '레미탈';
  const rooms = form.preciseRooms ?? [];
  const lossPct = Math.round((form.lossRate ?? 0.05) * 100);

  const modeProducts = products.filter((p) => p.mode === mode);
  // 지금 고른 공법 — 명시적으로 안 바꿨으면 용도 기본값을 그대로 보여준다(레미탈 전용)
  const effectiveMethod = form.method ?? (form.usage ? USAGE_PRESET[form.usage].defaultMethod : '손미장');
  // 지금 고른 셀프레벨링 제품(있으면) — 두께 범위 캡션·자동 전환에 쓴다
  const selectedProduct = form.productCode ? modeProducts.find((p) => p.code === form.productCode) : undefined;

  // 두께 입력 범위 — 모드마다 다르다(레미탈 10~150mm · 셀프레벨링 1~50mm)
  const thicknessMax = thicknessMmMax(mode);
  const thicknessMin = mode === '레미탈' ? 10 : THICKNESS_MM_MIN;

  function addRoom() {
    patch({ preciseRooms: [...rooms, { name: `구역${rooms.length + 1}`, areaSqm: 0 }] });
  }

  function updateRoom(i: number, v: Partial<MortarPreciseRoom>) {
    patch({ preciseRooms: rooms.map((r, j) => (j === i ? { ...r, ...v } : r)) });
  }

  function removeRoom(i: number) {
    patch({ preciseRooms: rooms.filter((_, j) => j !== i) });
  }

  /**
   * 두께를 바꿀 때 — 셀프레벨링 모드에서 지금 고른 제품이 새 두께를 못 다루면
   * 그 두께에 맞는 제품으로 자동 전환한다(맞는 제품이 없으면 선택을 풀어 기본 계수로).
   */
  function handleThicknessChange(mm: number | '') {
    if (mm === '') {
      patch({ thicknessMm: undefined });
      return;
    }
    if (mode === '셀프레벨링' && selectedProduct && !productCoversThickness(selectedProduct, mm)) {
      const rec = recommendSelfLevelProduct(mm, products);
      patch({ thicknessMm: mm, productCode: rec?.code });
      return;
    }
    patch({ thicknessMm: mm });
  }

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
    // 2026-09-15 디자인 통일 지시: 카드 속 카드 금지 — 테두리 카드는 결과 카드 하나에만
    <div className="flex flex-col gap-4">
      <h2 className="text-[17px] font-bold text-foreground">실측</h2>

      {/* 1. 두께 — mm 숫자 입력(모바일 숫자 키패드). 슬라이더 대신 직접 입력으로 바꿨다 */}
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold text-foreground">두께</span>
        <span className="text-[13px] text-v1-text-disabled">{thicknessMin}~{thicknessMax}mm</span>
      </div>
      <NumberField
        value={form.thicknessMm ?? ''}
        onChange={handleThicknessChange}
        suffix="mm"
        placeholder={`${thicknessMin}~${thicknessMax}`}
        aria-label="두께(mm)"
        min={thicknessMin}
        max={thicknessMax}
        className="w-full"
      />
      {quick?.standardRangeNote && <p className="text-[13px] text-v1-text-secondary">{quick.standardRangeNote}</p>}

      {/* 2. 실별 면적 — 여러 구역을 더해 합계로 계산한다 */}
      <div className="flex flex-col gap-2 pt-2">
        <span className="text-[15px] font-semibold text-foreground">실별 면적</span>
        {rooms.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={r.name}
              onChange={(e) => updateRoom(i, { name: e.target.value })}
              aria-label={`구역 ${i + 1} 이름`}
              className="w-20 h-11 rounded-[4px] border border-v1-line-3 px-2 text-[14px] text-foreground"
            />
            <NumberField
              className="flex-1 min-w-0"
              aria-label={`구역 ${i + 1} 면적`}
              suffix="㎡"
              value={r.areaSqm || ''}
              onChange={(v) => updateRoom(i, { areaSqm: v === '' ? 0 : v })}
            />
            <button
              type="button"
              onClick={() => removeRoom(i)}
              aria-label={`구역 ${i + 1} 삭제`}
              className="w-11 h-11 flex-none text-v1-text-secondary"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRoom}
          className="h-11 rounded-[4px] border border-dashed border-v1-line-3 text-[15px] text-v1-text-secondary"
        >
          + 구역 추가
        </button>
      </div>

      {/* 3. 공법(레미탈 전용) — 기본은 용도가 정하고, 여기서 직접 바꿀 수 있다 */}
      {mode === '레미탈' && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">공법</span>
            <div className="flex gap-2">
              <Chip shape="square" selected={effectiveMethod === '손미장'} onClick={() => patch({ method: '손미장' })}>
                손미장
              </Chip>
              <Chip shape="square" selected={effectiveMethod === '장비타설'} onClick={() => patch({ method: '장비타설' })}>
                장비 타설
              </Chip>
            </div>
          </div>
          <p className="text-[13px] text-v1-text-disabled">{METHOD_CAPTION}</p>
        </div>
      )}

      {/* 4. 로스율 — 칩이 4개라 360px에서 라벨과 한 줄에 다 안 들어가면 라벨 글자가 한 글자씩
          세로로 깨지는 문제가 있었다(현장 검수 지적) — 라벨은 줄바꿈 금지로 고정하고,
          칩 묶음은 통째로 다음 줄로 넘어가게 한다(글자 단위가 아니라 칩 단위로 줄바꿈) */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 pt-1">
        <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">로스율</span>
        <div className="flex flex-wrap gap-2 justify-end">
          {LOSS_CHIPS.map((p) => (
            <Chip key={p} selected={lossPct === p} onClick={() => patch({ lossRate: p / 100 })}>
              {p}%
            </Chip>
          ))}
        </div>
      </div>

      {/* 5. 배합비(레미탈 전용) — 현장 배합 대안 계산에만 쓴다 */}
      {mode === '레미탈' && (
        <div className="flex items-center justify-between pt-1">
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

      {/* 5-B. 운송·하차 — 배송비 직접 입력 + 지게차 하차비 옵션(06_미장.md §11-2) */}
      <div className="flex flex-col gap-1 pt-1">
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
        <p className="text-[13px] text-v1-text-disabled tabular-nums">
          팔레트 50포 단위·지역별로 달라요
          {/* 2026-09-15 검사관 지적: NumberField는 입력칸 자체에 천단위 콤마를 안 보여준다
              (지우면 커서가 튀는 부작용이 있어 입력칸 자체는 안 건드리고) 보조 캡션으로
              "30,000원"처럼 콤마 찍힌 값을 옆에 보여준다. */}
          {isPositive(form.deliveryFeeWon) ? ` · ${formatNum(form.deliveryFeeWon)}원` : ''}
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

      {/* 5-C. 양중 — 사용자 직접 입력 + 참고값 채우기(06_미장.md §11-3) */}
      <div className="flex flex-col gap-1 pt-1">
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
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-v1-text-disabled tabular-nums">
            소운반 100m 기준 양중공 2명 · 표준품셈 보통인부 노임 기준
            {isPositive(form.liftingFeeWon) ? ` · ${formatNum(form.liftingFeeWon)}원` : ''}
          </p>
          <button
            type="button"
            disabled={!result}
            onClick={() => result && patch({ liftingFeeWon: result.liftingReferenceWon })}
            className="text-[13px] font-semibold text-brown disabled:text-v1-text-disabled disabled:cursor-not-allowed"
          >
            참고값 채우기
          </button>
        </div>
      </div>

      {/* 6. 옵션 — 와이어메시(레미탈 전용)·프라이머 */}
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

      {/* 7. 제품 선택 — 06_미장.md에 있는 제조사 목록만(직접 입력 없음). 포장 kg를 항상 적는다 */}
      <div className="flex flex-col pt-1">
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
