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
//   상태는 이 컴포넌트가 갖지 않는다(직접 입력 칸의 글자만 화면 전용으로 들고 있고,
//   바깥 productCode·product 값이 바뀌면 그 값에 맞춰 다시 채운다).
//
// 2026-09-27 검사관 7차 지적(치명) 수리 — "모드 카드에 다녀오면 시트 칸이 죽는다":
//   시트 열림 여부(sheetOpen)를 이 부품이 더 이상 안 갖는다. 모드 카드로 돌아가면 이
//   부품 자체가 통째로 사라지는데(리액트 언마운트), 그 안에 있던 시트 열림 상태와
//   뒤로 가기 감시 로직이 같이 사라지면서 "앞으로 가기로 시트 칸에 다시 왔는데 안
//   열림" 사고가 났었다. 이제 sheetOpen과 onSheetOpenChange를 부르는 쪽(계산기
//   최상위, 절대 언마운트되지 않는 WallpaperCalculator)에서 내려받는다 — 자세한 내용은
//   useSheetBackNav.ts 주석 참고.
//
// 작성일: 2026년 09월 09일
// 재배치: 2026년 09월 09일 (벽지 최우선 A안)
// 목록 시트로 교체: 2026년 09월 27일 (지시서 3-11절 — 단계 흐름 개선)
// 시트 열림 상태를 계산기 최상위로 올림(7차 검사 치명 수리): 2026년 09월 27일
// 합지/실크 선택 단계 없앰: 2026년 10월 29일 — 종류(합지/실크) 세그먼트 단계를 지우고,
//   목록 한 줄마다 이름 앞에 [합지]/[실크]를 붙여 한 목록에서 바로 고르게 했다(합지 먼저,
//   실크 다음 — 각 묶음 안의 원래 정렬은 그대로). 고른 제품의 종류가 그대로 엔진에 간다.
//   "아직 안 정했어요"는 종류마다 한 줄씩([합지]/[실크]) 두고, "직접 입력"은 입력 폼 안에서
//   종류를 고른다(시공비가 종류마다 달라 엔진이 종류를 꼭 알아야 하기 때문).
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

/**
 * 서버(route.ts의 parseProduct)가 실제로 받아 주는 범위와 반드시 같은 값이어야 한다.
 * 서버 전용 파일은 클라이언트 번들에 섞이면 안 되므로(단가 로직 유출 금지) 숫자만
 * 따로 복사해서 화면 쪽 검사에 쓴다 — route.ts:132-134 값이 바뀌면 여기도 같이 고칠 것.
 * 2026-09-27 배포 전 재검수 지적 4번: 이 범위 밖 값도 예전엔 [적용]이 눌려서, 서버가
 * 거절하면 "실패해 이전 값이에요"만 뜨고 왜 실패했는지 알 수 없었다 — 아예 화면에서 막는다.
 */
const CUSTOM_PRODUCT_LIMITS = {
  rollPrice: { min: 1000, max: 1000000, unit: '원' },
  widthCm: { min: 20, max: 400, unit: 'cm' },
  lengthM: { min: 1, max: 100, unit: 'm' },
  // 2026-09-27 지휘관 추가 지적: 무늬 반복(repeatCm)은 서버가 검사하는데(route.ts:135,
  // min 0 · max 200) 화면은 안 보고 있었다. 선택 칸이라 비워 두는 건 허용(min 0 자체는
  // "0 이상"이라 사실상 비워 두거나 0을 넣거나 다 통과 — 실제로 막을 값은 위쪽 200 초과뿐)
  repeatCm: { min: 0, max: 200, unit: 'cm' },
} as const;

/** 값이 하나라도 범위를 벗어나면 짧은 안내 문구를(마침표 없이) 돌려주고, 안 벗어나면 undefined */
function customRangeError(value: number | '', limit: { min: number; max: number; unit: string }): string | undefined {
  if (value === '') return undefined; // 아직 안 적은 칸은 범위 오류가 아니라 "안 채움"이므로 메시지를 안 보인다
  if (value < limit.min) return `${limit.min.toLocaleString('ko-KR')}${limit.unit} 이상`;
  if (value > limit.max) return `${limit.max.toLocaleString('ko-KR')}${limit.unit} 이하`;
  return undefined;
}

/** 벽지 종류 — 합지 또는 실크 */
type PaperKind = '합지' | '실크';

/** 목록에서 종류 묶음을 보여 주는 순서(합지 먼저, 실크 다음) */
const KIND_ORDER: PaperKind[] = ['합지', '실크'];

/**
 * "아직 안 정했어요" 줄의 코드 — 종류마다 한 줄이라 코드 뒤에 종류를 붙인다
 * (예: "__undecided__:합지"). 실제 제품 코드와 절대 안 겹친다.
 */
const UNDECIDED_PREFIX = `${PRODUCT_SHEET_UNDECIDED}:`;

/**
 * 시트에서 무언가를 골랐을 때 부르는 쪽(계산기 최상위)에 한 번에 넘기는 값.
 * 종류·제품 코드·직접 입력 값을 늘 같이 넘겨서, 종류와 제품이 서로 어긋날 틈을 없앤다.
 *   - 목록 제품:        { paperType: 그 제품 종류, productCode: 코드 }
 *   - 아직 안 정했어요: { paperType: 그 줄의 종류 } (그 종류 전체 범위로 계산)
 *   - 직접 입력:        { paperType: 폼에서 고른 종류, product: 입력값 }
 */
export interface PaperSelectionChange {
  paperType: PaperKind;
  productCode?: string;
  product?: CustomProduct;
}

export interface PaperPickerProps {
  /**
   * 제품 목록 시트가 열려 있는지 — 이제 계산기 최상위(WallpaperCalculator)가 갖고
   * 내려준다(7차 검사 치명 수리, 위 파일 머리말 참고).
   */
  sheetOpen: boolean;
  /** 시트 열림 상태를 바꿔 달라고 계산기 최상위에 요청한다(보통 setSheetOpen 그대로) */
  onSheetOpenChange: (open: boolean) => void;

  /** 지금 정해진 벽지 종류. undefined면 아직 아무것도 안 고른 상태 */
  paperType: PaperKind | undefined;

  /** 제품 마스터에서 고른 제품 코드. 고르면 그 제품 규격·가격으로 계산한다 */
  productCode: string | undefined;

  /** page.tsx가 서버 제품 마스터에서 골라 내려준 목록 (규격·가격 미확인인 제품은 null 칸 포함) */
  products: WallpaperProductOption[];

  /** 직접 입력한 벽지 (롤당 가격·폭·길이·무늬 반복) */
  product?: CustomProduct;

  /** 시트에서 한 줄을 고르거나 직접 입력을 [적용]했을 때 — 종류·제품을 한 번에 넘긴다 */
  onSelect: (v: PaperSelectionChange) => void;

  /**
   * 이 단계를 사용자가 실제로 손댔는지(버튼에 "제품 고르기" 대신 고른 값을
   * 보여줄지 판단하는 데 쓴다). 아직 한 번도 안 골랐으면 false.
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
  sheetOpen,
  onSheetOpenChange,
  paperType,
  productCode,
  products,
  product,
  onSelect,
  touched = false,
}: PaperPickerProps) {
  // "직접 입력" 폼 안에서 고르는 벽지 종류 — 이미 정해진 종류가 있으면 그걸로, 없으면 합지로 시작
  const [customKind, setCustomKind] = useState<PaperKind>(paperType ?? '합지');
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
   *
   * 2026-09-27 배포 전 검사관 지적 1번(치명) 수리: 예전엔 세 칸이 다 차는 "그 순간"
   * onProductChange(폼 반영)를 바로 불러서, 2단계가 곧장 완료 처리 → 접힘 → (시트가
   * 그 안에 있었을 때는) 시트까지 같이 사라지는 사고로 이어졌다. 이제 타이핑 중에는
   * 화면 전용 임시 상태(custom)만 바꾸고, 폼에 반영하지도 계산을 다시 부르지도 않는다
   * — 오직 "적용" 버튼을 눌러야만(commitCustom) 실제로 반영된다.
   */
  function updateCustom(p: Partial<CustomFields>) {
    setCustom((prev) => ({ ...prev, ...p }));
  }

  // 칸별 범위 오류 문구 — 값이 서버가 거절할 범위면 칸 아래에 짧게 보인다.
  // 무늬 반복(repeatCm)은 선택 칸이라 비워 두면(=아직 안 적음) 오류가 아니다.
  const priceError = customRangeError(custom.rollPrice, CUSTOM_PRODUCT_LIMITS.rollPrice);
  const widthError = customRangeError(custom.widthCm, CUSTOM_PRODUCT_LIMITS.widthCm);
  const lengthError = customRangeError(custom.lengthM, CUSTOM_PRODUCT_LIMITS.lengthM);
  const repeatError = customRangeError(custom.repeatCm, CUSTOM_PRODUCT_LIMITS.repeatCm);

  /**
   * 지금 임시 입력값(custom)이 실제로 쓸 수 있는 값인지 — "적용" 버튼 활성화 판정.
   * 2026-09-27 배포 전 재검수 지적 4번: 세 칸이 채워졌는지뿐 아니라, 서버가 받아 줄
   * 범위 안인지까지 같이 봐야 한다(안 그러면 가격 1원·폭 1cm 같은 값도 눌려 버린다).
   * 2026-09-27 지휘관 추가 지적: 무늬 반복도 범위(0~200cm) 밖이면 막아야 한다(선택
   * 칸이라 비워 두는 것 자체는 여전히 허용 — customRangeError가 빈 값을 오류로 안 본다).
   */
  const customValid =
    custom.rollPrice !== '' &&
    custom.widthCm !== '' &&
    custom.lengthM !== '' &&
    !priceError &&
    !widthError &&
    !lengthError &&
    !repeatError;

  /**
   * "적용" 버튼을 눌렀을 때만 부른다 — 이 순간에만 폼에 실제로 반영되고(onProductChange),
   * 그 결과로 2단계가 완료 처리되며(부르는 쪽 WallpaperCalculator가 touch(1)을 건다),
   * 시트도 닫힌다. 세 칸이 안 갖춰졌으면(customValid=false) 이 함수 자체가 안 불린다
   * (버튼이 disabled 상태이므로).
   */
  function commitCustom() {
    if (!customValid) return;
    const made: CustomProduct = {
      rollPrice: custom.rollPrice as number,
      widthCm: custom.widthCm as number,
      lengthM: custom.lengthM as number,
      repeatCm: custom.repeatCm === '' ? undefined : custom.repeatCm,
    };
    setLastProduct(made);
    // 직접 입력은 폼 안에서 고른 종류(customKind)로 계산한다 — 목록 선택(productCode)은 지운다
    onSelect({ paperType: customKind, product: made });
    onSheetOpenChange(false);
  }

  /**
   * 시트에서 한 줄을 고르면 전부 이 함수로 온다.
   * "직접 입력"만 예외 — 그 자리에서 바로 완료 처리하지 않고 입력 폼만 펼친다(3-11절:
   * 세 칸을 다 채워야 진짜 값이 생기므로, 줄을 누른 순간이 아니라 다 채웠을 때 완료된다).
   * 나머지 줄("[종류] 아직 안 정했어요"·목록 제품)은 누르는 즉시 시트가 닫히고 단계가 완료된다.
   */
  function onSheetSelect(code: string) {
    if (code === PRODUCT_SHEET_CUSTOM) {
      // 폼을 새로 펼칠 때 종류 칸을 지금 정해진 종류에 맞춰 둔다(이미 펼쳐져 있으면 손대지 않는다)
      if (!customFormOpen && paperType) setCustomKind(paperType);
      setCustomFormOpen(true);
      return;
    }
    // 여기부터는 직접 입력이 아니므로 직접 입력 화면 값은 비운다
    setCustomFormOpen(false);
    setLastProduct(undefined);
    setCustom(toFields(undefined));
    if (code.startsWith(UNDECIDED_PREFIX)) {
      // "[합지/실크] 아직 안 정했어요" — 그 종류만 정하고 제품은 비운다(그 종류 전체 범위로 계산)
      const kind = code.slice(UNDECIDED_PREFIX.length) as PaperKind;
      onSelect({ paperType: kind });
      onSheetOpenChange(false);
      return;
    }
    // 목록에서 실제 제품 하나를 골랐다 — 그 제품의 종류가 그대로 벽지 종류가 된다
    const picked = products.find((p) => p.code === code);
    if (!picked) return; // 목록에 없는 코드(일어나면 안 됨) — 아무것도 안 바꾼다
    onSelect({ paperType: picked.kind, productCode: code });
    onSheetOpenChange(false);
  }

  /**
   * 한 종류에서 손님에게 보여도 되는 제품만 골라 정렬한다(계산 담당의 isShowableWallpaperProduct와
   * 같은 규칙 — 목록과 서버 "종류 전체 범위" 계산이 같은 제품 집합을 봐야 한다).
   * 2026-09-27 검수 지적 10번: 방 전용 소폭(53cm) 제품이 광폭 제품 사이에 브랜드순으로
   * 섞여 있어서 헷갈렸다 — 광폭(거실·일반용)을 먼저, 소폭(방 전용)은 뒤로 묶는다. 각 묶음
   * 안에서는 원래 정렬(브랜드순 → 같은 브랜드면 싼 것부터)을 그대로 유지한다.
   */
  function listOf(kind: PaperKind) {
    return products
      .filter((p) => p.kind === kind && isShowableWallpaperProduct(p))
      .sort((a, b) => {
        const aNarrow = (a.widthCm ?? 0) > 0 && (a.widthCm as number) <= 60 ? 1 : 0;
        const bNarrow = (b.widthCm ?? 0) > 0 && (b.widthCm as number) <= 60 ? 1 : 0;
        if (aNarrow !== bNarrow) return aNarrow - bNarrow;
        return a.brand.localeCompare(b.brand, 'en') || (a.price as number) - (b.price as number);
      });
  }

  // 종류별 목록 — 합지 먼저, 실크 다음(KIND_ORDER)
  const listsByKind = KIND_ORDER.map((kind) => ({ kind, list: listOf(kind) }));

  // 맨 위 "[종류] 아직 안 정했어요" 줄들 — 오른쪽에 그 종류 전체 가격대(이미 화면에 내려온
  // 목록의 최저~최고가만 쓴다, 서버를 새로 부르지 않는다 — 검수 지적 11번)
  const undecidedItems: PickerItem[] = listsByKind.map(({ kind, list }) => ({
    code: `${UNDECIDED_PREFIX}${kind}`,
    title: `[${kind}] 아직 안 정했어요`,
    priceLabel:
      list.length > 0
        ? formatRollPriceRange(Math.min(...list.map((p) => p.price as number)), Math.max(...list.map((p) => p.price as number)))
        : undefined,
  }));

  // 실제 제품 줄들 — 이름 앞에 [합지]/[실크]를 붙인다
  const productItems: PickerItem[] = listsByKind.flatMap(({ kind, list }) =>
    list.map((p) => ({
      code: p.code,
      title: `[${kind}] ${p.brand} ${p.name}`,
      priceLabel: formatRollPrice(p.price as number),
    })),
  );

  const items: PickerItem[] = [...undecidedItems, ...productItems];

  // 시트 안에서 강조 표시할 줄 — 직접 입력 폼이 펼쳐져 있으면(아직 값을 다 안 채웠어도) 그 줄을 강조한다
  const selectedCode = customFormOpen
    ? PRODUCT_SHEET_CUSTOM
    : productCode
      ? productCode
      : touched && paperType && product === undefined
        ? `${UNDECIDED_PREFIX}${paperType}`
        : undefined;

  // 트리거 버튼에 보여줄 글자 — 아직 한 번도 손 안 댔으면 "제품 고르기", 손댔으면 실제로 값이
  // 갖춰진 것만 보여준다(직접 입력 폼을 펼치기만 하고 값을 안 채웠으면 아직 "제품 고르기"인 채로 둔다)
  const selectedProduct = productCode ? products.find((p) => p.code === productCode) : undefined;
  const triggerLabel = selectedProduct
    ? `[${selectedProduct.kind}] ${selectedProduct.brand} ${selectedProduct.name}`
    : product !== undefined && paperType
      ? `[${paperType}] 직접 입력`
      : touched && paperType
        ? `[${paperType}] 아직 안 정했어요`
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

      <ProductSheet
        open={sheetOpen}
        onClose={() => onSheetOpenChange(false)}
        title="벽지"
        items={items}
        selectedCode={selectedCode}
        onSelect={onSheetSelect}
        // "아직 안 정했어요"는 종류마다 한 줄씩 items 맨 위에 직접 넣었으므로 시트 기본 줄은 숨긴다
        hideUndecided
        customForm={
          <>
            {/* 직접 입력한 벽지의 종류 — 시공비가 종류마다 달라 엔진에 꼭 넘겨야 한다 */}
            <span className="t-sub text-ink-2">종류</span>
            <Segment
              options={[
                { value: '합지' as const, label: '합지' },
                { value: '실크' as const, label: '실크' },
              ]}
              value={customKind}
              onChange={(v) => setCustomKind(v)}
              ariaLabel="직접 입력 벽지 종류"
            />
            <span className="t-sub text-ink-2 pt-1">롤당 가격</span>
            <NumberField
              aria-label="롤당 가격"
              suffix="원"
              placeholder="44000"
              value={custom.rollPrice}
              onChange={(v) => updateCustom({ rollPrice: v })}
            />
            {/* 2026-09-27 재검수 지적 4번: 서버가 거절할 범위면 칸 바로 아래 한 줄로 알려 준다 */}
            {priceError && <span className="t-sub text-danger -mt-1">{priceError}</span>}
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
            {(widthError || lengthError) && (
              <div className="flex gap-2 t-sub text-danger -mt-1">
                <span className="flex-1 min-w-0">{widthError}</span>
                <span className="flex-1 min-w-0">{lengthError}</span>
              </div>
            )}
            <span className="t-sub text-ink-2 pt-1">무늬 반복(선택)</span>
            <NumberField
              aria-label="무늬 반복"
              suffix="cm"
              placeholder="선택"
              value={custom.repeatCm}
              onChange={(v) => updateCustom({ repeatCm: v })}
            />
            {/* 2026-09-27 지휘관 추가 지적: 무늬 반복도 서버 범위(0~200cm)를 벗어나면 알려준다.
                비워 두는 건 선택 칸이라 허용되고(오류 아님), 200 넘는 값만 걸린다 */}
            {repeatError && <span className="t-sub text-danger -mt-1">{repeatError}</span>}
            {/* 2026-09-27 검사관 지적 1번(치명) 수리: 타이핑 도중에는 아무 일도 안 일어나고,
                이 버튼을 눌러야만(commitCustom) 폼에 반영되고 단계가 완료되며 시트가 닫힌다.
                세 칸이 다 안 갖춰졌으면(customValid=false) 눌리지 않는다. */}
            <button
              type="button"
              disabled={!customValid}
              onClick={commitCustom}
              className="h-11 mt-1 rounded-[8px] bg-accent text-white t-body font-semibold disabled:opacity-40"
            >
              적용
            </button>
          </>
        }
      />
    </div>
  );
}
