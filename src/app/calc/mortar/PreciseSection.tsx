// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "정확하게 계산하기" 카드
//
// 두께 직접 입력, 실별 면적 여러 개, 공법 토글(레미탈 전용), 로스율 조정,
// 옵션(와이어메시·프라이머), 제품 선택을 담당한다. 값이 바뀌는 즉시 자동으로 계산되고,
// 결과는 ResultPanel이 그린다.
//
// 운반(층수·엘리베이터) 가산은 06_미장.md에 근거 수치가 없어 옵션 자체를 넣지 않는다
// (지시서 원칙 — 근거 없는 항목은 만들지 말고 숨긴다).
//
// 2026-09-14 검사관 지적 반영:
//   - 공법(장비 타설/손미장) 토글 추가 — 기본은 용도가 정하지만(방통 전체만 장비 타설)
//     여기서 사용자가 직접 바꿀 수 있다.
//   - 계산 훅은 MortarCalculator 한 곳에서만 부르고 이 컴포넌트는 결과를 props로만 받는다.
//   - 셀프레벨링 제품을 고른 상태에서 두께를 그 제품 범위 밖으로 옮기면, 그 두께를 다루는
//     제품으로 자동 전환한다("추천 제품 자동 전환"). 반대로 범위 밖의 제품을 고르면 두께를
//     그 제품 범위 안으로 당겨 온다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 14일(검사관 1라운드)
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
import { productCoversThickness, recommendSelfLevelProduct } from '@/lib/v1/mortarProductOptions';
import type { MortarCalcResultDTO, MortarRange } from '@/lib/v1/useMortarCalc';
import { USAGE_PRESET } from '@/lib/v1/mortarPresets';

export interface PreciseSectionProps {
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  products: MortarProductOption[];
  result: MortarCalcResultDTO | null;
  range: MortarRange | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
}

/** 로스율 조정 칩(%) */
const LOSS_CHIPS: readonly number[] = [0, 5, 10, 15];

/** 두께 조정 슬라이더 범위(mm) — 06_미장.md에 나온 용도별 두께 범위를 전부 포괄하는 값 */
const THICKNESS_MIN_MM = 3;
// 2026-09-15 검사관 지적: 06_미장.md 용도별 두께 범위(최대 방통 50mm)를 벗어나는 슬라이더
// 상한(60)은 근거가 없어 50으로 좁혔다. 서버 API 절대 상한(100mm)과는 별개 — 이건 UX 범위다.
const THICKNESS_MAX_MM = 50;

export default function PreciseSection({ form, patch, products, result, range, loading, error, stale }: PreciseSectionProps) {
  const mode = form.mode ?? '레미탈';
  const rooms = form.preciseRooms ?? [];
  const lossPct = Math.round((form.lossRate ?? 0.05) * 100);
  const dim = loading || stale;

  const modeProducts = products.filter((p) => p.mode === mode);
  // 지금 고른 공법 — 명시적으로 안 바꿨으면 용도 기본값을 그대로 보여준다(레미탈 전용)
  const effectiveMethod = form.method ?? (form.usage ? USAGE_PRESET[form.usage].defaultMethod : '손미장');
  // 지금 고른 셀프레벨링 제품(있으면) — 두께 범위 캡션·자동 전환에 쓴다
  const selectedProduct = form.productCode ? modeProducts.find((p) => p.code === form.productCode) : undefined;

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
  function handleThicknessChange(mm: number) {
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

      {/* 1. 두께 — mm 직접 입력(슬라이더 겸용) */}
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold text-foreground">두께</span>
        <span className="text-[16px] text-brown font-semibold tabular-nums">{form.thicknessMm ?? 0}mm</span>
      </div>
      <input
        type="range"
        min={THICKNESS_MIN_MM}
        max={THICKNESS_MAX_MM}
        step={1}
        value={form.thicknessMm ?? THICKNESS_MIN_MM}
        onChange={(e) => handleThicknessChange(Number(e.target.value))}
        aria-label="두께(mm)"
        className="w-full accent-brown"
      />

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

      {/* 7. 제품 선택 — 06_미장.md에 있는 제조사 목록만(직접 입력 없음) */}
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
                {p.brand} {p.name} · {p.minThicknessMm}~{p.maxThicknessMm}mm
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <IconChevronDown className="text-v1-text-label" />
          </span>
        </div>
        {/* 선택한 제품의 권장 두께 범위를 캡션으로 항상 보여준다(두께를 벗어나면 위에서 자동으로 맞춰 준다) */}
        {selectedProduct && (
          <p className="text-[14px] text-v1-text-disabled pt-1">
            권장 두께 {selectedProduct.minThicknessMm}~{selectedProduct.maxThicknessMm}mm
          </p>
        )}
      </div>

      {/* 8. 즉답 큰 숫자 */}
      {error ? (
        <p className="text-[16px] text-foreground pt-2">계산에 실패했어요</p>
      ) : !range || !result ? (
        <p className="text-[16px] text-v1-text-secondary pt-2">면적을 넣으면 나와요</p>
      ) : (
        <>
          <div
            className={
              'text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] pt-2 ' +
              `whitespace-nowrap transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`
            }
          >
            {formatNum(result.quantity.bags)}포
          </div>
          <p className="text-[16px] text-foreground tabular-nums">{formatManRange(range.min, range.max)}</p>
        </>
      )}
    </Card>
  );
}
