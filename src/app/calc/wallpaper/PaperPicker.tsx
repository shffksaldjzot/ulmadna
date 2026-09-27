// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 벽지 카드 (종류 + 제품 고르기)
//
// 이 파일이 하는 일:
//   1단계 — 벽지 종류(합지/실크) 세그먼트.
//   2단계 — 벽지 제품. 2026-09-27 지시서(3-11절)로 기본 드롭다운을 버리고 "제품 고르기"
//   버튼 + 목록 시트(ProductSheet)로 바꿨다. 시트 맨 위 "아직 안 정했어요"를 골라도
//   이 단계는 완료된다(그 종류 노출 제품 전체 범위로 계산 — 계산 담당이 서버에서 처리).
//   마지막 줄 "직접 입력"은 목록에 없는 벽지를 직접 적는 자리(기존 기능 그대로 연결).
//
//   상태는 이 컴포넌트가 갖지 않는다(시트 열림 여부·직접 입력 칸의 글자만 화면 전용으로
//   들고 있고, 바깥 productCode·product 값이 바뀌면 그 값에 맞춰 다시 채운다).
//
// 작성일: 2026년 09월 09일
// 재배치: 2026년 09월 09일 (벽지 최우선 A안)
// 목록 시트로 교체: 2026년 09월 27일 (지시서 3-11절 — 단계 흐름 개선)
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Segment from '@/components/v1/Segment';
import NumberField from '@/components/v1/NumberField';
import { IconChevronRight } from '@/components/v1/icons';
import type { WallpaperProductOption } from '@/lib/v1/wallpaperQuery';
import { isShowableWallpaperProduct } from '@/lib/v1/wallpaperProductOptions';
import ProductSheet, { PRODUCT_SHEET_CUSTOM, PRODUCT_SHEET_UNDECIDED } from '../_components/flow/ProductSheet';
import type { PickerItem } from '../_components/flow/types';

/** 직접 입력한 벽지 한 개의 모양 (폼 상태 product 칸과 같은 모양) */
type CustomProduct = { rollPrice: number; widthCm: number; lengthM: number; repeatCm?: number };

/** 직접 입력 칸 네 개의 화면 값 (빈 칸을 허용해야 해서 number | '' 로 든다) */
type CustomFields = {
  rollPrice: number | '';
  widthCm: number | '';
  lengthM: number | '';
  repeatCm: number | '';
};

export interface PaperPickerProps {
  /**
   * 이 카드에서 어느 부분만 그릴지 — "종류"와 "제품"이 서로 다른 단계(StepRow)에 들어간다.
   *   'type'    — 종류(합지/실크) 세그먼트만.
   *   'product' — 종류를 고른 뒤 나오는 "제품 고르기" 버튼 + 목록 시트만.
   */
  part: 'type' | 'product';

  /** 벽지 종류. undefined면 아직 안 고른 상태 */
  paperType: '합지' | '실크' | undefined;
  onPaperTypeChange: (v: '합지' | '실크' | undefined) => void;

  /** 제품 마스터에서 고른 제품 코드. 고르면 그 제품 규격·가격으로 계산한다 */
  productCode: string | undefined;
  onProductCodeChange: (v: string | undefined) => void;

  /** page.tsx가 서버 제품 마스터에서 골라 내려준 목록 (규격·가격 미확인인 제품은 null 칸 포함) */
  products: WallpaperProductOption[];

  /** 직접 입력한 벽지 (롤당 가격·폭·길이·무늬 반복) */
  product?: CustomProduct;
  onProductChange?: (v: CustomProduct | undefined) => void;

  /**
   * 2단계를 사용자가 실제로 손댔는지(제품 고르기 버튼에 "제품 고르기" 대신 고른 값을
   * 보여줄지 판단하는 데 쓴다). 아직 한 번도 안 눌렀으면 false.
   */
  touched?: boolean;
}

/** 롤당 가격(원) → 화면 표기 "4.4만/롤". 만 단위 소수 첫째 자리까지, .0이면 떼고 보여 준다 */
function formatRollPrice(won: number): string {
  const man = Math.round((won / 10000) * 10) / 10;
  const text = Number.isInteger(man) ? String(man) : man.toFixed(1);
  return `${text}만/롤`;
}

/** 만 단위 숫자 하나를 문자열로("2.6" 또는 "3") — formatRollPriceRange 전용 도우미 */
function manText(won: number): string {
  const man = Math.round((won / 10000) * 10) / 10;
  return Number.isInteger(man) ? String(man) : man.toFixed(1);
}

/**
 * "아직 안 정했어요" 줄에 붙일 가격대 — "0.4만~2.6만/롤"(최저=최고면 "2.6만/롤" 하나만).
 * 이미 화면에 내려온 제품 목록의 값만 쓰고, 서버는 새로 안 부른다(2026-09-27 검수 지적 11번).
 */
function formatRollPriceRange(minWon: number, maxWon: number): string {
  const min = manText(minWon);
  const max = manText(maxWon);
  return min === max ? `${min}만/롤` : `${min}만~${max}만/롤`;
}

/** 바깥에서 받은 직접 입력 값 → 화면 칸 네 개 */
function toFields(product: CustomProduct | undefined): CustomFields {
  return {
    rollPrice: product?.rollPrice ?? '',
    widthCm: product?.widthCm ?? '',
    lengthM: product?.lengthM ?? '',
    repeatCm: product?.repeatCm ?? '',
  };
}

export default function PaperPicker({
  part,
  paperType,
  onPaperTypeChange,
  productCode,
  onProductCodeChange,
  products,
  product,
  onProductChange,
  touched = false,
}: PaperPickerProps) {
  // 목록 시트 열림 여부 — 이 카드가 직접 들고 있는 유일한 상태
  const [sheetOpen, setSheetOpen] = useState(false);
  // "직접 입력" 줄을 눌러서 그 아래 입력 폼을 펼쳐 둔 상태인지 — 이미 직접 입력한 값이
  // 있으면 처음부터 펼친 채로 시작한다. 이 상태만으로는 아직 단계를 완료 처리하지 않는다
  // (세 칸을 다 채워야 진짜 "손댔다"고 본다 — 그래야 값도 없이 다음 단계로 훌쩍 넘어가지 않는다)
  const [customFormOpen, setCustomFormOpen] = useState(product !== undefined);
  // 직접 입력 칸에 적히는 값(화면 전용)
  const [custom, setCustom] = useState<CustomFields>(() => toFields(product));
  // 바깥 product가 바뀐 걸 알아채려고 직전 값을 같이 기억해 둔다
  const [lastProduct, setLastProduct] = useState<CustomProduct | undefined>(product);

  // 바깥에서 직접 입력 값이 바뀌면(예: 벽지 종류를 바꿔 종류가 지웠을 때) 화면 칸도 맞춘다
  if (product !== lastProduct) {
    setLastProduct(product);
    setCustom(toFields(product));
    // 값이 통째로 지워졌으면(다른 데서 초기화된 것) 펼쳐 둘 이유도 없다
    if (product === undefined) setCustomFormOpen(false);
  }

  /**
   * 직접 입력 칸이 바뀔 때마다 부른다.
   * 가격·폭·길이 세 칸이 다 차야 계산에 쓸 수 있으므로, 하나라도 비면 undefined로 지운다.
   */
  function updateCustom(p: Partial<CustomFields>) {
    const next = { ...custom, ...p };
    setCustom(next);
    if (!onProductChange) return;
    if (next.rollPrice !== '' && next.widthCm !== '' && next.lengthM !== '') {
      const made: CustomProduct = {
        rollPrice: next.rollPrice,
        widthCm: next.widthCm,
        lengthM: next.lengthM,
        repeatCm: next.repeatCm === '' ? undefined : next.repeatCm,
      };
      setLastProduct(made);
      onProductChange(made);
    } else {
      setLastProduct(undefined);
      onProductChange(undefined);
    }
  }

  /**
   * 시트에서 한 줄을 고르면 전부 이 함수로 온다.
   * "직접 입력"만 예외 — 그 자리에서 바로 완료 처리하지 않고 입력 폼만 펼친다(3-11절:
   * 세 칸을 다 채워야 진짜 값이 생기므로, 줄을 누른 순간이 아니라 다 채웠을 때 완료된다).
   * 나머지 두 줄("아직 안 정했어요"·목록 제품)은 누르는 즉시 시트가 닫히고 단계가 완료된다.
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
      setSheetOpen(false);
      return;
    }
    // 목록에서 실제 제품 하나를 골랐다 — 직접 입력은 지운다
    setCustomFormOpen(false);
    setLastProduct(undefined);
    onProductChange?.(undefined);
    setCustom(toFields(undefined));
    onProductCodeChange(code);
    setSheetOpen(false);
  }

  if (part === 'type') {
    return (
      // 종류 — 기본 미선택. 고르기 전엔 아무 탭도 활성화하지 않는다
      <Segment
        options={[
          { value: '합지', label: '합지' },
          { value: '실크', label: '실크' },
        ]}
        value={paperType}
        onChange={onPaperTypeChange}
      />
    );
  }

  // part === 'product' — 종류를 아직 안 골랐으면 그릴 게 없다(방어적 처리)
  if (!paperType) return null;

  // 고른 종류 중 손님에게 보여도 되는 제품만 남긴다(계산 담당의 isShowableWallpaperProduct와
  // 같은 규칙 — 목록과 서버 "종류 전체 범위" 계산이 같은 제품 집합을 봐야 한다)
  // 2026-09-27 검수 지적 10번: 방 전용 소폭(53cm) 제품이 광폭 제품 사이에 브랜드순으로
  // 섞여 있어서 헷갈렸다 — 광폭(거실·일반용)을 먼저, 소폭(방 전용)은 뒤로 묶는다. 각 묶음
  // 안에서는 원래 정렬(브랜드순 → 같은 브랜드면 싼 것부터)을 그대로 유지한다.
  const list = products
    .filter((p) => p.kind === paperType && isShowableWallpaperProduct(p))
    .sort((a, b) => {
      const aNarrow = (a.widthCm ?? 0) > 0 && (a.widthCm as number) <= 60 ? 1 : 0;
      const bNarrow = (b.widthCm ?? 0) > 0 && (b.widthCm as number) <= 60 ? 1 : 0;
      if (aNarrow !== bNarrow) return aNarrow - bNarrow;
      return a.brand.localeCompare(b.brand, 'en') || (a.price as number) - (b.price as number);
    });

  const items: PickerItem[] = list.map((p) => ({
    code: p.code,
    title: `${p.brand} ${p.name}`,
    priceLabel: formatRollPrice(p.price as number),
  }));

  // "아직 안 정했어요" 줄 오른쪽에 붙일 그 종류 전체 가격대 — 이미 화면에 내려온 제품
  // 목록(list)의 최저~최고가만 쓴다(서버를 새로 부르지 않는다, 검수 지적 11번)
  const undecidedPriceLabel =
    list.length > 0
      ? formatRollPriceRange(
          Math.min(...list.map((p) => p.price as number)),
          Math.max(...list.map((p) => p.price as number)),
        )
      : undefined;

  // 시트 안에서 강조 표시할 줄 — 직접 입력 폼이 펼쳐져 있으면(아직 값을 다 안 채웠어도) 그 줄을 강조한다
  const selectedCode = customFormOpen
    ? PRODUCT_SHEET_CUSTOM
    : productCode
      ? productCode
      : touched
        ? PRODUCT_SHEET_UNDECIDED
        : undefined;

  // 트리거 버튼에 보여줄 글자 — 아직 한 번도 손 안 댔으면 "제품 고르기", 손댔으면 실제로 값이
  // 갖춰진 것만 보여준다(직접 입력 폼을 펼치기만 하고 값을 안 채웠으면 아직 "제품 고르기"인 채로 둔다)
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
        onClick={() => setSheetOpen(true)}
        className="w-full h-12 flex items-center justify-between rounded-[8px] border border-line bg-surface px-4 text-left"
      >
        <span className="t-body text-ink truncate">{triggerLabel}</span>
        <IconChevronRight className="text-ink-2 flex-none" />
      </button>

      <ProductSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="벽지 제품"
        items={items}
        selectedCode={selectedCode}
        onSelect={onSheetSelect}
        undecidedPriceLabel={undecidedPriceLabel}
        customForm={
          <>
            <span className="t-sub text-ink-2">롤당 가격</span>
            <NumberField
              aria-label="롤당 가격"
              suffix="원"
              placeholder="44000"
              value={custom.rollPrice}
              onChange={(v) => updateCustom({ rollPrice: v })}
            />
            <div className="flex gap-2 t-sub text-ink-2 pt-1">
              <span className="flex-1 min-w-0">폭</span>
              <span className="flex-1 min-w-0">길이</span>
            </div>
            <div className="flex gap-2">
              <NumberField
                className="flex-1 min-w-0"
                aria-label="벽지 폭"
                suffix="cm"
                placeholder="106"
                value={custom.widthCm}
                onChange={(v) => updateCustom({ widthCm: v })}
              />
              <NumberField
                className="flex-1 min-w-0"
                aria-label="롤 길이"
                suffix="m"
                placeholder="15.6"
                value={custom.lengthM}
                onChange={(v) => updateCustom({ lengthM: v })}
              />
            </div>
            <span className="t-sub text-ink-2 pt-1">무늬 반복(선택)</span>
            <NumberField
              aria-label="무늬 반복"
              suffix="cm"
              placeholder="선택"
              value={custom.repeatCm}
              onChange={(v) => updateCustom({ repeatCm: v })}
            />
            {/* 셋 다 채워지면 자동으로 계산에 반영된다 — 직접 입력을 마쳤으면 시트를 닫는다 */}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="h-11 mt-1 rounded-[8px] bg-accent text-white t-body font-semibold"
            >
              닫기
            </button>
          </>
        }
      />
    </div>
  );
}
