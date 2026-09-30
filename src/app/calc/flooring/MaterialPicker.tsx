// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 바닥재 카드 (종류 + 제품 고르기)
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9장 — 도배 PaperPicker.tsx가 3-11절대로 이미
// 만든 방식을 그대로 옮겨 왔다. 이 파일이 하는 일:
//   1단계 — 바닥재 종류(마루/장판/데코타일) 세그먼트.
//   2단계 — 바닥재 제품. 기본 드롭다운을 버리고 "제품 고르기" 버튼 + 목록 시트
//   (ProductSheet)로 바꿨다. 시트 맨 위 "아직 안 정했어요"를 골라도 이 단계는 완료된다
//   (그 종류 노출 제품 전체 범위로 계산 — 계산 담당이 서버에서 처리). 마지막 줄
//   "직접 입력"은 목록에 없는 바닥재를 직접 적는 자리(도배와 같은 방식 — [적용]을 눌러야
//   반영된다. 타이핑 도중 폼에 반영되면 2단계가 곧장 완료 처리돼 시트가 사라지는 도배의
//   치명 결함을 되풀이하지 않는다).
//
//   마루·데코타일은 박스형(박스당 가격·박스당 ㎡·장 폭·장 길이), 장판은 롤형(m당 가격·
//   롤 폭)이라 직접 입력 칸이 종류에 따라 다르다 — 이 구분은 예전 드롭다운 버전 그대로다.
//
//   상태는 이 컴포넌트가 갖지 않는다(시트 열림 여부·직접 입력 칸의 글자만 화면 전용으로
//   들고 있고, 바깥 productCode·product 값이 바뀌면 그 값에 맞춰 다시 채운다).
//
// 작성일: 2026년 09월 10일
// 목록 시트로 교체(도배 방식 그대로 이식): 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Segment from '@/components/v1/Segment';
import NumberField from '@/components/v1/NumberField';
import { IconChevronRight } from '@/components/v1/icons';
import type { FlooringDirectProduct, FlooringKind, FlooringProductOption } from '@/lib/v1/flooringQuery';
import { isShowableFlooringProduct } from '@/lib/v1/flooringProductOptions';
import ProductSheet, { PRODUCT_SHEET_CUSTOM, PRODUCT_SHEET_UNDECIDED } from '../_components/flow/ProductSheet';
import type { PickerItem } from '../_components/flow/types';

/** 직접 입력 칸 전부(박스형·롤형 칸을 한 번에 들고 있는다)의 화면 값 — 빈 칸을 허용해야 해서 number | '' 로 든다 */
type CustomFields = {
  pricePerBox: number | '';
  sqmPerBox: number | '';
  widthMm: number | '';
  lengthMm: number | '';
  pricePerM: number | '';
  rollWidthM: number | '';
};

/**
 * 서버(route.ts의 parseProduct)가 실제로 받아 주는 범위와 반드시 같은 값이어야 한다.
 * 서버 전용 파일은 클라이언트 번들에 섞이면 안 되므로(단가 로직 유출 금지) 숫자만
 * 따로 복사해서 화면 쪽 검사에 쓴다 — src/app/api/calc/flooring/route.ts의 parseProduct
 * 함수(pricePerBox·sqmPerBox·widthMm·lengthMm·pricePerM·rollWidthM) 값이 바뀌면 여기도
 * 같이 고칠 것(도배 PaperPicker.tsx의 CUSTOM_PRODUCT_LIMITS와 같은 이유).
 */
const CUSTOM_PRODUCT_LIMITS = {
  pricePerBox: { min: 1000, max: 5000000, unit: '원' },
  sqmPerBox: { min: 0.1, max: 50, unit: '㎡' },
  widthMm: { min: 30, max: 4000, unit: 'mm' },
  lengthMm: { min: 30, max: 4000, unit: 'mm' },
  pricePerM: { min: 1000, max: 1000000, unit: '원' },
  rollWidthM: { min: 0.5, max: 5, unit: 'm' },
} as const;

/** 값이 하나라도 범위를 벗어나면 짧은 안내 문구를(마침표 없이) 돌려주고, 안 벗어나면 undefined */
function customRangeError(value: number | '', limit: { min: number; max: number; unit: string }): string | undefined {
  if (value === '') return undefined; // 아직 안 적은 칸은 범위 오류가 아니라 "안 채움"이므로 메시지를 안 보인다
  if (value < limit.min) return `${limit.min.toLocaleString('ko-KR')}${limit.unit} 이상`;
  if (value > limit.max) return `${limit.max.toLocaleString('ko-KR')}${limit.unit} 이하`;
  return undefined;
}

export interface MaterialPickerProps {
  /**
   * 이 카드에서 어느 부분만 그릴지 — "종류"와 "제품"이 서로 다른 단계(StepRow)에 들어간다.
   *   'kind'    — 종류(마루/장판/데코타일) 세그먼트만.
   *   'product' — 종류를 고른 뒤 나오는 "제품 고르기" 버튼 + 목록 시트만.
   */
  part: 'kind' | 'product';

  /** 바닥재 종류. undefined면 아직 안 고른 상태 */
  kind: FlooringKind | undefined;
  onKindChange: (v: FlooringKind | undefined) => void;

  /** 제품 마스터에서 고른 제품 코드. 고르면 그 제품 규격·가격으로 계산한다 */
  productCode: string | undefined;
  onProductCodeChange: (v: string | undefined) => void;

  /** page.tsx가 서버 제품 마스터에서 골라 내려준 목록 */
  products: FlooringProductOption[];

  /** 직접 입력한 바닥재 */
  product?: FlooringDirectProduct;
  onProductChange?: (v: FlooringDirectProduct | undefined) => void;

  /**
   * 2단계를 사용자가 실제로 손댔는지(제품 고르기 버튼에 "제품 고르기" 대신 고른 값을
   * 보여줄지 판단하는 데 쓴다). 아직 한 번도 안 눌렀으면 false.
   */
  touched?: boolean;

  /**
   * 제품 목록 시트 열림 여부 — 지휘관 지시(2026-09-27): 이 상태는 이 부품 안에 두지
   * 않고 맨 위(FlooringCalculator)가 들고 있다가 내려준다. 이 부품(part==='product')은
   * "모드 카드로 돌아가면 사라지는" 자리라, 여기 상태를 두면 뒤로 가기 스택이 쥔
   * onReopen 클로저가 사라진 컴포넌트 인스턴스를 가리키게 돼(도배에서 실제로 난 결함),
   * 앞으로 가도 시트가 안 열리는 사고가 난다. FlooringCalculator는 모드 카드 화면에서도
   * 계속 마운트된 채라 그 자리에 상태를 두면 이 문제가 안 생긴다.
   */
  sheetOpen: boolean;
  onSheetOpenChange: (v: boolean) => void;
}

/** 박스형은 "박스당 가격"이 판매가. 화면 표기 "4.4만/박스" */
function formatBoxPrice(won: number): string {
  const man = Math.round((won / 10000) * 10) / 10;
  const text = Number.isInteger(man) ? String(man) : man.toFixed(1);
  return `${text}만/박스`;
}

/** 롤형(장판)은 "m당 가격"이 판매가. 화면 표기 "1.2만/m" */
function formatRollPrice(won: number): string {
  const man = Math.round((won / 10000) * 10) / 10;
  const text = Number.isInteger(man) ? String(man) : man.toFixed(1);
  return `${text}만/m`;
}

/** 종류에 맞는 판매가 표기 문자열 */
function formatPrice(p: FlooringProductOption): string {
  return p.saleUnit === '박스' ? formatBoxPrice(p.price as number) : formatRollPrice(p.price as number);
}

/** 만 단위 숫자 하나를 문자열로("2.6" 또는 "3") — formatPriceRange 전용 도우미 */
function manText(won: number): string {
  const man = Math.round((won / 10000) * 10) / 10;
  return Number.isInteger(man) ? String(man) : man.toFixed(1);
}

/**
 * "아직 안 정했어요" 줄에 붙일 가격대 — "1.2만~4.4만/박스"(최저=최고면 하나만).
 * 이미 화면에 내려온 제품 목록의 값만 쓰고, 서버는 새로 안 부른다(도배와 같은 규칙).
 */
function formatPriceRange(minWon: number, maxWon: number, saleUnit: '박스' | 'm'): string {
  const min = manText(minWon);
  const max = manText(maxWon);
  const suffix = saleUnit === '박스' ? '만/박스' : '만/m';
  return min === max ? `${min}${suffix}` : `${min}만~${max}${suffix}`;
}

/** 바깥에서 받은 직접 입력 값 → 화면 칸 전부(빈 값은 '') */
function toFields(product: FlooringDirectProduct | undefined): CustomFields {
  return {
    pricePerBox: product?.pricePerBox ?? '',
    sqmPerBox: product?.sqmPerBox ?? '',
    widthMm: product?.widthMm ?? '',
    lengthMm: product?.lengthMm ?? '',
    pricePerM: product?.pricePerM ?? '',
    rollWidthM: product?.rollWidthM ?? '',
  };
}

export default function MaterialPicker({
  part,
  kind,
  onKindChange,
  productCode,
  onProductCodeChange,
  products,
  product,
  onProductChange,
  touched = false,
  sheetOpen,
  onSheetOpenChange,
}: MaterialPickerProps) {
  // "직접 입력" 줄을 눌러서 그 아래 입력 폼을 펼쳐 둔 상태인지 — 값이 있으면 처음부터 펼친 채 시작한다.
  const [customFormOpen, setCustomFormOpen] = useState(product !== undefined);
  // 직접 입력 칸에 적히는 값(화면 전용)
  const [custom, setCustom] = useState<CustomFields>(() => toFields(product));
  // 바깥 product가 바뀐 걸 알아채려고 직전 값을 같이 기억해 둔다
  const [lastProduct, setLastProduct] = useState<FlooringDirectProduct | undefined>(product);

  // 바깥에서 직접 입력 값이 바뀌면(예: 종류를 바꿔 부모가 product를 지웠을 때) 화면 칸도 맞춘다
  if (product !== lastProduct) {
    setLastProduct(product);
    setCustom(toFields(product));
    if (product === undefined) setCustomFormOpen(false);
  }

  /**
   * 직접 입력 칸이 바뀔 때마다 부른다.
   *
   * 도배 PaperPicker.tsx의 치명 결함 수리와 같은 이유 — 타이핑 중에는 화면 전용 임시
   * 상태(custom)만 바꾸고, 폼에 반영하지도 계산을 다시 부르지도 않는다. 오직 "적용"
   * 버튼을 눌러야만(commitCustom) 실제로 반영된다(안 그러면 마지막 칸을 채우는 순간
   * 2단계가 곧장 완료 처리 → 접힘 → 시트가 그 안에 있었으면 같이 사라지는 사고가 난다).
   */
  function updateCustom(p: Partial<CustomFields>) {
    setCustom((prev) => ({ ...prev, ...p }));
  }

  // 칸별 범위 오류 문구 — 값이 서버가 거절할 범위면 칸 아래에 짧게 보인다. 종류에 안 맞는
  // 칸(예: 장판인데 pricePerBox)은 애초에 화면에 안 그리므로 여기선 전부 계산해 둬도 안전하다.
  const priceBoxError = customRangeError(custom.pricePerBox, CUSTOM_PRODUCT_LIMITS.pricePerBox);
  const sqmPerBoxError = customRangeError(custom.sqmPerBox, CUSTOM_PRODUCT_LIMITS.sqmPerBox);
  const widthError = customRangeError(custom.widthMm, CUSTOM_PRODUCT_LIMITS.widthMm);
  const lengthError = customRangeError(custom.lengthMm, CUSTOM_PRODUCT_LIMITS.lengthMm);
  const priceMError = customRangeError(custom.pricePerM, CUSTOM_PRODUCT_LIMITS.pricePerM);
  const rollWidthError = customRangeError(custom.rollWidthM, CUSTOM_PRODUCT_LIMITS.rollWidthM);

  /**
   * 지금 임시 입력값(custom)이 실제로 쓸 수 있는 값인지 — "적용" 버튼 활성화 판정.
   * 종류에 따라 꼭 필요한 칸이 다르다 — 장판(롤형)은 m당 가격·롤 폭, 마루·데코타일
   * (박스형)은 박스당 가격·박스당 ㎡가 필수(장 폭·장 길이는 선택 칸, 서버도 optional).
   */
  const customValid =
    kind === '장판'
      ? custom.pricePerM !== '' && custom.rollWidthM !== '' && !priceMError && !rollWidthError
      : custom.pricePerBox !== '' &&
        custom.sqmPerBox !== '' &&
        !priceBoxError &&
        !sqmPerBoxError &&
        !widthError &&
        !lengthError;

  /**
   * "적용" 버튼을 눌렀을 때만 부른다 — 이 순간에만 폼에 실제로 반영되고(onProductChange),
   * 그 결과로 2단계가 완료 처리되며(부르는 쪽 FlooringCalculator가 touch(1)을 건다),
   * 시트도 닫힌다.
   */
  function commitCustom() {
    if (!customValid || !onProductChange || !kind) return;
    const made: FlooringDirectProduct =
      kind === '장판'
        ? { pricePerM: custom.pricePerM as number, rollWidthM: custom.rollWidthM as number }
        : {
            pricePerBox: custom.pricePerBox as number,
            sqmPerBox: custom.sqmPerBox as number,
            widthMm: custom.widthMm === '' ? undefined : custom.widthMm,
            lengthMm: custom.lengthMm === '' ? undefined : custom.lengthMm,
          };
    setLastProduct(made);
    onProductChange(made);
    onSheetOpenChange(false);
  }

  /**
   * 시트에서 한 줄을 고르면 전부 이 함수로 온다.
   * "직접 입력"만 예외 — 그 자리에서 바로 완료 처리하지 않고 입력 폼만 펼친다(필수 칸을
   * 다 채우고 [적용]을 눌러야 진짜 값이 생긴다).
   */
  function onSheetSelect(code: string) {
    if (code === PRODUCT_SHEET_CUSTOM) {
      setCustomFormOpen(true);
      return;
    }
    if (code === PRODUCT_SHEET_UNDECIDED) {
      // "아직 안 정했어요" — 목록 선택·직접 입력 둘 다 지운다. 종류 전체 범위로 계산되고 단계는 완료된다
      setCustomFormOpen(false);
      setLastProduct(undefined);
      onProductChange?.(undefined);
      setCustom(toFields(undefined));
      onProductCodeChange(undefined);
      onSheetOpenChange(false);
      return;
    }
    // 목록에서 실제 제품 하나를 골랐다 — 직접 입력은 지운다
    setCustomFormOpen(false);
    setLastProduct(undefined);
    onProductChange?.(undefined);
    setCustom(toFields(undefined));
    onProductCodeChange(code);
    onSheetOpenChange(false);
  }

  if (part === 'kind') {
    return (
      // 종류 — 기본 미선택. 고르기 전엔 아무 탭도 활성화하지 않는다
      <Segment
        options={[
          { value: '마루', label: '마루' },
          { value: '장판', label: '장판' },
          { value: '데코타일', label: '데코타일' },
        ]}
        value={kind}
        onChange={onKindChange}
        ariaLabel="자재"
      />
    );
  }

  // part === 'product' — 종류를 아직 안 골랐으면 그릴 게 없다(방어적 처리)
  if (!kind) return null;

  // 고른 종류 중 손님에게 보여도 되는 제품만 남긴다 — 서버 "종류 전체 범위" 계산과 같은
  // 제품 집합이어야 한다(isShowableFlooringProduct, flooringProductOptions.ts 참고).
  const list = products
    .filter((p) => p.kind === kind && isShowableFlooringProduct(p))
    .sort((a, b) => a.brand.localeCompare(b.brand, 'en') || (a.price as number) - (b.price as number));

  // 2026-09-27 저녁 지휘관 3차 검수 지적 9번: 이름+규격을 한 줄에 붙이니 이름이 길 때
  // 가격표와 겹쳐 보였다("동화자연마루 나투스진 소폭 퓨어/어반 98×815 7.5만/박스").
  // 이름은 title(한 줄 말줄임, ProductSheet가 이미 truncate 처리한다)로, 규격(98×815
  // 같은 숫자 꼬리)은 subtitle(아랫줄 t-sub)로 내린다. 정렬 기준(브랜드 가나다 → 같은
  // 브랜드 안 가격 낮은 순)은 이미 위 list 정렬과 같다.
  const items: PickerItem[] = list.map((p) => ({
    code: p.code,
    title: `${p.brand} ${p.name}`,
    subtitle: p.variant || undefined,
    priceLabel: formatPrice(p),
  }));

  // "아직 안 정했어요" 줄 오른쪽에 붙일 그 종류 전체 가격대 — 이미 화면에 내려온 제품
  // 목록(list)의 최저~최고가만 쓴다(서버를 새로 부르지 않는다, 도배와 같은 규칙)
  const undecidedPriceLabel =
    list.length > 0
      ? formatPriceRange(
          Math.min(...list.map((p) => p.price as number)),
          Math.max(...list.map((p) => p.price as number)),
          list[0].saleUnit,
        )
      : undefined;

  // 시트 안에서 강조 표시할 줄
  const selectedCode = customFormOpen
    ? PRODUCT_SHEET_CUSTOM
    : productCode
      ? productCode
      : touched
        ? PRODUCT_SHEET_UNDECIDED
        : undefined;

  // 트리거 버튼에 보여줄 글자
  const selectedProduct = productCode ? list.find((p) => p.code === productCode) : undefined;
  const triggerLabel = selectedProduct
    ? `${selectedProduct.brand} ${selectedProduct.name}`
    : product !== undefined
      ? '직접 입력'
      : touched
        ? '아직 안 정했어요'
        : '제품 고르기';

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onSheetOpenChange(true)}
        className="w-full h-12 flex items-center justify-between rounded-[8px] border border-line bg-surface px-4 text-left"
      >
        <span className="t-body text-ink truncate">{triggerLabel}</span>
        <IconChevronRight className="text-ink-2 flex-none" />
      </button>

      {/* 뒤로·앞으로 가기 감시는 이 부품이 안 한다 — 계산기 맨 위(FlooringCalculator)가
          useSheetBackNav로 직접 한다(모드 카드로 돌아가면 이 부품 자체가 사라지므로,
          여기서 감시하면 죽은 인스턴스를 가리키는 사고가 난다). 이 부품은 열림 여부만
          받아 그리는 순수 표시 전용이다. */}
      <ProductSheet
        open={sheetOpen}
        onClose={() => onSheetOpenChange(false)}
        title="바닥재 제품"
        items={items}
        selectedCode={selectedCode}
        onSelect={onSheetSelect}
        undecidedPriceLabel={undecidedPriceLabel}
        customForm={
          kind === '장판' ? (
            <>
              {/* 롤형(장판) — m당 가격·롤 폭 두 칸만 */}
              <span className="t-sub text-ink-2">m당 가격</span>
              <NumberField
                aria-label="m당 가격"
                suffix="원"
                placeholder="18000"
                value={custom.pricePerM}
                onChange={(v) => updateCustom({ pricePerM: v })}
              />
              {priceMError && <span className="t-sub text-danger -mt-1">{priceMError}</span>}
              <span className="t-sub text-ink-2 pt-1">롤 폭</span>
              <NumberField
                aria-label="롤 폭"
                suffix="m"
                placeholder="1.8"
                value={custom.rollWidthM}
                onChange={(v) => updateCustom({ rollWidthM: v })}
              />
              {rollWidthError && <span className="t-sub text-danger -mt-1">{rollWidthError}</span>}
              <button
                type="button"
                disabled={!customValid}
                onClick={commitCustom}
                className="h-11 mt-1 rounded-[8px] bg-accent text-white t-body font-semibold disabled:opacity-40"
              >
                적용
              </button>
            </>
          ) : (
            <>
              {/* 박스형(마루·데코타일) — 박스당 가격·박스당 ㎡가 필수, 장 폭·장 길이는 선택 */}
              <span className="t-sub text-ink-2">박스당 가격</span>
              <NumberField
                aria-label="박스당 가격"
                suffix="원"
                placeholder="39000"
                value={custom.pricePerBox}
                onChange={(v) => updateCustom({ pricePerBox: v })}
              />
              {priceBoxError && <span className="t-sub text-danger -mt-1">{priceBoxError}</span>}
              <span className="t-sub text-ink-2 pt-1">박스당 ㎡</span>
              <NumberField
                aria-label="박스당 ㎡"
                suffix="㎡"
                placeholder="1.5"
                value={custom.sqmPerBox}
                onChange={(v) => updateCustom({ sqmPerBox: v })}
              />
              {sqmPerBoxError && <span className="t-sub text-danger -mt-1">{sqmPerBoxError}</span>}
              <div className="flex gap-2 t-sub text-ink-2 pt-1">
                <span className="flex-1 min-w-0">장 폭(선택)</span>
                <span className="flex-1 min-w-0">장 길이(선택)</span>
              </div>
              <div className="flex gap-2">
                <NumberField
                  className="flex-1 min-w-0"
                  aria-label="장 폭"
                  suffix="mm"
                  placeholder="148"
                  value={custom.widthMm}
                  onChange={(v) => updateCustom({ widthMm: v })}
                />
                <NumberField
                  className="flex-1 min-w-0"
                  aria-label="장 길이"
                  suffix="mm"
                  placeholder="1818"
                  value={custom.lengthMm}
                  onChange={(v) => updateCustom({ lengthMm: v })}
                />
              </div>
              {(widthError || lengthError) && (
                <div className="flex gap-2 t-sub text-danger -mt-1">
                  <span className="flex-1 min-w-0">{widthError}</span>
                  <span className="flex-1 min-w-0">{lengthError}</span>
                </div>
              )}
              <button
                type="button"
                disabled={!customValid}
                onClick={commitCustom}
                className="h-11 mt-1 rounded-[8px] bg-accent text-white t-body font-semibold disabled:opacity-40"
              >
                적용
              </button>
            </>
          )
        }
      />
    </div>
  );
}
