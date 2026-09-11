// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 바닥재 카드 (종류 + 제품 고르기)
//
// 이 파일이 하는 일 (도배 PaperPicker.tsx를 그대로 본떠 만듦):
//   화면 맨 위 1번 카드 — 바닥재 종류(마루/장판/데코타일)부터 고른다. 종류를 고르면
//   그 아래 제품 목록이 나온다. 한 줄을 누르면 그 제품의 규격·판매가로 계산하고, 같은
//   줄을 다시 누르면 선택이 풀린다(종류 평균가로 돌아간다). 마지막 줄 "직접 입력"은
//   목록에 없는 바닥재를 직접 적는 자리다. 목록 제품과 직접 입력은 둘 중 하나만 살아 있다.
//
//   마루·데코타일은 박스형(박스당 가격·박스당 ㎡·장 폭·장 길이), 장판은 롤형(m당 가격·롤 폭)
//   이라 직접 입력 칸이 종류에 따라 다르다.
//
//   종류를 안 골라도 이 카드는 항상 그려진다(세그먼트를 보여줘야 하니까). 규격·가격이
//   확인된 제품만 보여 준다 — 조사가 덜 끝났거나 "확인 필요"가 붙은 제품은 목록에서 뺀다.
//
//   상태는 이 컴포넌트가 갖지 않는다(직접 입력 칸의 글자만 화면 전용으로 들고 있고,
//   바깥 product 값이 바뀌면 그 값에 맞춰 다시 채운다).
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

'use client';

import { useState, type ReactNode } from 'react';
import Card from '@/components/v1/Card';
import Segment from '@/components/v1/Segment';
import NumberField from '@/components/v1/NumberField';
import { IconChevronDown } from '@/components/v1/icons';
import type { FlooringDirectProduct, FlooringKind, FlooringProductOption } from '@/lib/v1/flooringQuery';

/** 드롭다운에서 "직접 입력" 줄의 값 (제품 코드와 겹치지 않는 문자열) */
const CUSTOM_VALUE = '__custom__';

/** 직접 입력 칸 전부(박스형·롤형 칸을 한 번에 들고 있는다)의 화면 값 — 빈 칸을 허용해야 해서 number | '' 로 든다 */
type CustomFields = {
  pricePerBox: number | '';
  sqmPerBox: number | '';
  widthMm: number | '';
  lengthMm: number | '';
  pricePerM: number | '';
  rollWidthM: number | '';
};

export interface MaterialPickerProps {
  /** 바닥재 종류. undefined면 아직 안 고른 상태 — 이때는 세그먼트만 보이고 제품 목록은 비운다 */
  kind: FlooringKind | undefined;
  onKindChange: (v: FlooringKind | undefined) => void;

  /** 제품 마스터에서 고른 제품 코드. 고르면 그 제품 규격·가격으로 계산한다 */
  productCode: string | undefined;
  onProductCodeChange: (v: string | undefined) => void;

  /** page.tsx가 서버 제품 마스터에서 골라 내려준 목록 (규격·가격 미확인인 제품은 null 칸 포함) */
  products: FlooringProductOption[];

  /** 직접 입력한 바닥재 */
  product?: FlooringDirectProduct;
  onProductChange?: (v: FlooringDirectProduct | undefined) => void;
  /** 카드 맨 아래에 붙일 것 — 범위(전체/방만/거실주방) 칩 */
  footer?: ReactNode;
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

/**
 * 손님에게 보여도 되는 제품인지.
 * 박스형은 가격·박스당 ㎡가, 롤형은 가격·롤 폭이 전부 조사돼 있어야 계산에 쓸 수 있다.
 * (검사관 1라운드 지적 11번: "확인 필요" 판정은 toFlooringProductOptions가 usable로 이미
 *  걸러서 여기 도착하는 목록엔 그런 항목이 없다 — 죽은 코드라 지웠다)
 */
function isShowable(p: FlooringProductOption): boolean {
  if (p.price == null) return false;
  if (p.saleUnit === '박스') return p.sqmPerBox != null;
  return p.rollWidthM != null;
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
  kind,
  onKindChange,
  productCode,
  onProductCodeChange,
  products,
  product,
  onProductChange,
  footer,
}: MaterialPickerProps) {
  // 직접 입력 칸 펼침 여부 — 이미 직접 입력한 값이 있으면 펼친 채로 시작한다
  const [customOpen, setCustomOpen] = useState(product !== undefined);
  // 직접 입력 칸에 적히는 값(화면 전용)
  const [custom, setCustom] = useState<CustomFields>(() => toFields(product));
  // 바깥 product가 바뀐 걸 알아채려고 직전 값을 같이 기억해 둔다
  const [lastProduct, setLastProduct] = useState<FlooringDirectProduct | undefined>(product);

  // 바깥에서 직접 입력 값이 바뀌면(예: 종류를 바꿔 부모가 product를 지웠을 때) 화면 칸도 맞춘다
  if (product !== lastProduct) {
    setLastProduct(product);
    setCustom(toFields(product));
    if (product === undefined) setCustomOpen(false);
  }

  /**
   * 직접 입력 칸이 바뀔 때마다 부른다. 종류(kind)에 따라 필요한 칸이 다르다 —
   * 장판(롤형)은 m당 가격·롤 폭, 마루·데코타일(박스형)은 박스당 가격·박스당 ㎡가
   * 다 차야 계산에 쓸 수 있으므로, 하나라도 비면 undefined로 지운다.
   */
  function updateCustom(p: Partial<CustomFields>) {
    const next = { ...custom, ...p };
    setCustom(next);
    if (!onProductChange || !kind) return;

    if (kind === '장판') {
      if (next.pricePerM !== '' && next.rollWidthM !== '') {
        const made: FlooringDirectProduct = { pricePerM: next.pricePerM, rollWidthM: next.rollWidthM };
        setLastProduct(made);
        onProductChange(made);
        return;
      }
    } else if (next.pricePerBox !== '' && next.sqmPerBox !== '') {
      const made: FlooringDirectProduct = {
        pricePerBox: next.pricePerBox,
        sqmPerBox: next.sqmPerBox,
        widthMm: next.widthMm === '' ? undefined : next.widthMm,
        lengthMm: next.lengthMm === '' ? undefined : next.lengthMm,
      };
      setLastProduct(made);
      onProductChange(made);
      return;
    }
    setLastProduct(undefined);
    onProductChange(undefined);
  }

  /**
   * 드롭다운에서 고른 값 하나로 세 가지 상태를 정리한다(둘 중 하나만 살아 있다는 규칙 유지).
   *   ''            → 제품 안 고름: 목록 선택·직접 입력 둘 다 지운다 → 종류 평균가
   *   CUSTOM_VALUE  → 직접 입력 펼침
   *   제품 코드     → 그 제품: 직접 입력은 접고 지운다
   */
  function onSelect(value: string) {
    if (value === CUSTOM_VALUE) {
      setCustomOpen(true);
      onProductCodeChange(undefined);
      updateCustom({});
      return;
    }
    setCustomOpen(false);
    setLastProduct(undefined);
    onProductChange?.(undefined);
    onProductCodeChange(value === '' ? undefined : value);
  }

  // 고른 종류 중 손님에게 보여도 되는 제품만 남긴다(종류를 안 골랐으면 빈 목록)
  // 정렬은 브랜드순 → 같은 브랜드 안에서는 싼 것부터 (도배와 같은 규칙)
  const list = kind
    ? products
        .filter((p) => p.kind === kind && isShowable(p))
        .sort((a, b) => a.brand.localeCompare(b.brand, 'en') || (a.price as number) - (b.price as number))
    : [];

  return (
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">바닥재</h2>

      {/* 종류 — 기본 미선택. 고르기 전엔 아무 탭도 활성화하지 않는다 */}
      <Segment
        options={[
          { value: '마루', label: '마루' },
          { value: '장판', label: '장판' },
          { value: '데코타일', label: '데코타일' },
        ]}
        value={kind}
        onChange={onKindChange}
      />

      {/* 종류를 안 골랐으면 제품 선택 자리를 비워 둔다(안내문 없이 — 설명글 최소화 원칙) */}
      {kind && (
      <div className="flex flex-col pt-3">
        {/* 제품 드롭다운 — 첫 줄(빈 값) = 제품 안 고름 → 종류 평균가로 계산.
            마지막 줄 "직접 입력" = 아래 입력칸 펼침. */}
        <label className="text-[14px] text-v1-text-label pb-1" htmlFor="flooring-product-select">
          바닥재 제품
        </label>
        <div className="relative">
          <select
            id="flooring-product-select"
            aria-label="바닥재 제품"
            value={customOpen ? CUSTOM_VALUE : (productCode ?? '')}
            onChange={(e) => onSelect(e.target.value)}
            className={
              'w-full h-11 appearance-none rounded-lg border border-v1-line-2 bg-white pl-3 pr-10 ' +
              'text-[16px] text-foreground focus:outline-none focus:border-brown'
            }
          >
            <option value="">제품 선택</option>
            {list.map((p) => (
              <option key={p.code} value={p.code}>
                {/* 검사관 1라운드 지적 6번: 같은 브랜드+라인 제품이 여러 규격으로 있으면
                    (NOX 오키드3000 2줄, 현대 골드타일마스터·클래식 2줄씩) 이름만으론 구분이
                    안 됐다 — variant(sku 또는 규격)를 이름 뒤에 붙여 구분한다 */}
                {p.brand} {p.name}
                {p.variant ? ` ${p.variant}` : ''} · {formatPrice(p)}
              </option>
            ))}
            <option value={CUSTOM_VALUE}>직접 입력</option>
          </select>
          {/* 오른쪽 화살표 — 브라우저 기본 화살표는 appearance-none 으로 감추고 우리 아이콘을 얹는다 */}
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <IconChevronDown className="text-v1-text-label" />
          </span>
        </div>

        {customOpen && kind === '장판' && (
          <div className="flex flex-col gap-2 pt-3 pl-3">
            {/* 롤형(장판) — m당 가격·롤 폭 두 칸만 */}
            <span className="text-[14px] text-v1-text-label">m당 가격</span>
            <NumberField
              aria-label="m당 가격"
              suffix="원"
              placeholder="18000"
              value={custom.pricePerM}
              onChange={(v) => updateCustom({ pricePerM: v })}
            />
            <span className="text-[14px] text-v1-text-label pt-1">롤 폭</span>
            <NumberField
              aria-label="롤 폭"
              suffix="m"
              placeholder="1.8"
              value={custom.rollWidthM}
              onChange={(v) => updateCustom({ rollWidthM: v })}
            />
          </div>
        )}

        {customOpen && kind !== '장판' && (
          <div className="flex flex-col gap-2 pt-3 pl-3">
            {/* 박스형(마루·데코타일) — 박스당 가격은 자릿수가 길어 한 줄을 통째로 쓴다 */}
            <span className="text-[14px] text-v1-text-label">박스당 가격</span>
            <NumberField
              aria-label="박스당 가격"
              suffix="원"
              placeholder="39000"
              value={custom.pricePerBox}
              onChange={(v) => updateCustom({ pricePerBox: v })}
            />
            <span className="text-[14px] text-v1-text-label pt-1">박스당 ㎡</span>
            <NumberField
              aria-label="박스당 ㎡"
              suffix="㎡"
              placeholder="1.5"
              value={custom.sqmPerBox}
              onChange={(v) => updateCustom({ sqmPerBox: v })}
            />

            {/* 장 폭·장 길이는 짧은 숫자라 한 줄에 2칸 */}
            <div className="flex gap-2 text-[14px] text-v1-text-label pt-1">
              <span className="flex-1 min-w-0">장 폭</span>
              <span className="flex-1 min-w-0">장 길이</span>
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
          </div>
        )}
      </div>
      )}
      {/* 범위(전체/방만/거실주방) 칩 — 종류를 고른 뒤에만 보인다 */}
      {kind && footer}
    </Card>
  );
}
