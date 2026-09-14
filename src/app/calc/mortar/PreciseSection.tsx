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
// 2026-09-15 형아 피드백 2라운드:
//   - 두께 슬라이더를 없애고 mm 숫자 입력으로 바꿨다(모바일 숫자 키패드, 스텝 5).
//     레미탈은 10~150mm(현장에서 방통이 50~150mm까지 흔하다), 셀프레벨링은 1~50mm.
//   - 06_미장.md 표준 범위(레미탈 10~50mm)를 넘으면 계산은 그대로 하되 캡션 1줄을 띄운다.
//   - 제품 선택 칸에 포장 kg를 반드시 적는다("삼표 SP몰탈 일반미장용 · 40kg · 10~50mm").
//   - 즉답 큰 숫자를 "레미탈 40kg × 65포" 형태로, 제품명·주문 수량 캡션을 같이 보여준다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(형아 피드백 2라운드)
// ──────────────────────────────────────────────

'use client';

import Card from '@/components/v1/Card';
import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import Toggle from '@/components/v1/Toggle';
import { IconChevronDown } from '@/components/v1/icons';
import { formatManRange, formatNum } from '@/lib/v1/money';
import type { MortarFormState, MortarPreciseRoom } from '@/lib/v1/mortarQuery';
import type { MortarProductOption } from '@/lib/v1/mortarProductOptions';
import { productCoversThickness, recommendSelfLevelProduct, formatMortarProductLabel } from '@/lib/v1/mortarProductOptions';
import type { MortarCalcResultDTO, MortarRange } from '@/lib/v1/useMortarCalc';
import type { MortarQuickResult } from '@/lib/v1/useMortarQuickCalc';
import { USAGE_PRESET, THICKNESS_MM_MIN, thicknessMmMax } from '@/lib/v1/mortarPresets';

export interface PreciseSectionProps {
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  products: MortarProductOption[];
  /** 즉시 계산 결과(서버 응답 없이도 항상 있음) — 포수·체적은 여기서만 가져온다 */
  quick: MortarQuickResult | null;
  /** 서버 계산 결과(비용·인건). 늦게 오거나 없을 수 있다 */
  result: MortarCalcResultDTO | null;
  range: MortarRange | null;
  /** 서버 계산 실패 메시지. 있으면 비용 자리에 "비용은 잠시 후 다시"만 보여준다 */
  error: string | null;
}

/** 로스율 조정 칩(%) */
const LOSS_CHIPS: readonly number[] = [0, 5, 10, 15];

export default function PreciseSection({ form, patch, products, quick, result, range, error }: PreciseSectionProps) {
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
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">실측</h2>

      {/* 1. 두께 — mm 숫자 입력(모바일 숫자 키패드). 슬라이더 대신 직접 입력으로 바꿨다 */}
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold text-foreground">두께</span>
        <span className="text-[14px] text-v1-text-disabled">{thicknessMin}~{thicknessMax}mm</span>
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
      {quick?.standardRangeNote && <p className="text-[14px] text-v1-text-secondary">{quick.standardRangeNote}</p>}

      {/* 2. 실별 면적 — 여러 구역을 더해 합계로 계산한다 */}
      <div className="flex flex-col gap-2 pt-2">
        <span className="text-[16px] font-semibold text-foreground">실별 면적</span>
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
          className="h-11 rounded-[4px] border border-dashed border-v1-line-3 text-[16px] text-v1-text-secondary"
        >
          + 구역 추가
        </button>
      </div>

      {/* 3. 공법(레미탈 전용) — 기본은 용도가 정하고, 여기서 직접 바꿀 수 있다 */}
      {mode === '레미탈' && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-semibold text-foreground">공법</span>
            <div className="flex gap-2">
              <Chip shape="square" selected={effectiveMethod === '손미장'} onClick={() => patch({ method: '손미장' })}>
                손미장
              </Chip>
              <Chip shape="square" selected={effectiveMethod === '장비타설'} onClick={() => patch({ method: '장비타설' })}>
                장비 타설
              </Chip>
            </div>
          </div>
          <p className="text-[14px] text-v1-text-disabled">장비 타설은 방통처럼 바닥 전체를 펌프로 붓는 공사예요</p>
        </div>
      )}

      {/* 4. 로스율 */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[16px] font-semibold text-foreground">로스율</span>
        <div className="flex gap-2">
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
          <span className="text-[16px] font-semibold text-foreground">배합비</span>
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

      {/* 6. 옵션 — 와이어메시(레미탈 전용)·프라이머 */}
      {mode === '레미탈' && (
        <div className="flex items-center justify-between py-2 border-t border-v1-line-2">
          <span className="text-[16px] text-foreground">와이어메시</span>
          <Toggle checked={form.wireMesh ?? false} onChange={(v) => patch({ wireMesh: v })} label="와이어메시 포함" />
        </div>
      )}
      <div className="flex items-center justify-between py-2 border-t border-v1-line-2">
        <span className="text-[16px] text-foreground">프라이머</span>
        <Toggle
          checked={form.primer ?? mode === '셀프레벨링'}
          onChange={(v) => patch({ primer: v })}
          label="프라이머 포함"
        />
      </div>

      {/* 7. 제품 선택 — 06_미장.md에 있는 제조사 목록만(직접 입력 없음). 포장 kg를 항상 적는다 */}
      <div className="flex flex-col pt-1">
        <label className="text-[14px] text-v1-text-label pb-1" htmlFor="mortar-product-select">
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

      {/* 8. 즉답 큰 숫자 — "레미탈 40kg × 65포" 형태. quick으로 서버 응답 없이 바로 나온다 */}
      {!quick ? (
        <p className="text-[16px] text-v1-text-secondary pt-2">면적을 넣으면 나와요</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1 flex-wrap pt-2">
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
            result && range && <p className="text-[16px] text-foreground tabular-nums">{formatManRange(range.min, range.max)}</p>
          )}
        </>
      )}
    </Card>
  );
}
