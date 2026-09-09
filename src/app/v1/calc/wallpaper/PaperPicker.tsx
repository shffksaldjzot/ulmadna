// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 벽지 제품 고르기
//
// 이 파일이 하는 일:
//   즉답 블록에서 벽지 종류(합지/실크)를 이미 골랐을 때만 나타나서, 그 종류의 제품을 고르게 한다.
//   한 줄을 누르면 그 제품의 규격·판매가로 계산하고, 같은 줄을 다시 누르면 선택이 풀린다
//   (종류 평균가로 돌아간다). 마지막 줄 "직접 입력"은 목록에 없는 벽지를 직접 적는 자리다.
//   목록 제품과 직접 입력은 둘 중 하나만 살아 있다.
//
//   2026년 09월 09일 검수 반영:
//     · 종류 세그먼트(아직 몰라요/합지/실크) 삭제 — 즉답 블록 칩과 중복이라 한 곳에서만 고른다.
//       종류를 안 골랐으면 이 카드 자체를 그리지 않는다.
//     · 규격·가격이 확인된 제품만 보여 준다. 조사가 덜 끝났거나 "확인 필요"가 붙은 제품은
//       목록에서 아예 뺀다("조사 중"·"확인 중" 같은 미완성 흔적을 손님에게 보이지 않는다).
//
//   상태는 이 컴포넌트가 갖지 않는다(직접 입력 칸의 글자만 화면 전용으로 들고 있고,
//   바깥 product 값이 바뀌면 그 값에 맞춰 다시 채운다).
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Card from '@/components/v1/Card';
import NumberField from '@/components/v1/NumberField';
import { IconChevronDown, IconChevronUp } from '@/components/v1/icons';
import type { WallpaperProductOption } from '@/lib/v1/wallpaperQuery';

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
  /** 벽지 종류. undefined면 아직 안 고른 상태 — 이때는 이 카드를 그리지 않는다 */
  paperType: '합지' | '실크' | undefined;
  onPaperTypeChange: (v: '합지' | '실크' | undefined) => void;

  /** 제품 마스터에서 고른 제품 코드. 고르면 그 제품 규격·가격으로 계산한다 */
  productCode: string | undefined;
  onProductCodeChange: (v: string | undefined) => void;

  /** page.tsx가 서버 제품 마스터에서 골라 내려준 목록 (규격·가격 미확인인 제품은 null 칸 포함) */
  products: WallpaperProductOption[];

  // ── 아래 두 칸은 새로 생긴 자리라 optional이다(배선 전에도 화면이 안 깨진다) ──
  /** 직접 입력한 벽지 (롤당 가격·폭·길이·무늬 반복) */
  product?: CustomProduct;
  onProductChange?: (v: CustomProduct | undefined) => void;
}

/** 롤당 가격(원) → 화면 표기 "4.4만/롤". 만 단위 소수 첫째 자리까지, .0이면 떼고 보여 준다 */
function formatRollPrice(won: number): string {
  const man = Math.round((won / 10000) * 10) / 10;
  const text = Number.isInteger(man) ? String(man) : man.toFixed(1);
  return `${text}만/롤`;
}

/**
 * 손님에게 보여도 되는 제품인지.
 * 가격·폭·롤 길이가 전부 조사돼 있어야 하고(계산에 써야 하니까),
 * 출처에 "확인 필요"가 붙은(=아직 검수 안 끝난) 제품은 목록에서 뺀다.
 */
function isShowable(p: WallpaperProductOption): boolean {
  if (p.price == null || p.widthCm == null || p.lengthM == null) return false;
  return !p.sourceLabel.includes('확인 필요');
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
  paperType,
  productCode,
  onProductCodeChange,
  products,
  product,
  onProductChange,
}: PaperPickerProps) {
  // 직접 입력 칸 펼침 여부 — 이미 직접 입력한 값이 있으면 펼친 채로 시작한다
  const [customOpen, setCustomOpen] = useState(product !== undefined);
  // 직접 입력 칸에 적히는 값(화면 전용)
  const [custom, setCustom] = useState<CustomFields>(() => toFields(product));
  // 바깥 product가 바뀐 걸 알아채려고 직전 값을 같이 기억해 둔다
  const [lastProduct, setLastProduct] = useState<CustomProduct | undefined>(product);

  // 바깥에서 직접 입력 값이 바뀌면(예: 벽지 종류를 바꿔 B가 product를 지웠을 때) 화면 칸도 맞춘다
  if (product !== lastProduct) {
    setLastProduct(product);
    setCustom(toFields(product));
    // 값이 통째로 지워졌으면 펼쳐 둘 이유도 없다
    if (product === undefined) setCustomOpen(false);
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

  /** 직접 입력 펼치기·접기 — 펼치면 목록 선택을 풀고, 접으면 직접 입력값을 지운다 */
  function toggleCustom() {
    if (customOpen) {
      setCustomOpen(false);
      setLastProduct(undefined);
      onProductChange?.(undefined);
      return;
    }
    setCustomOpen(true);
    onProductCodeChange(undefined);
    // 접었다 다시 펼쳤을 때 값이 이미 다 차 있으면 그대로 다시 반영한다
    updateCustom({});
  }

  /** 목록 제품 고르기 — 직접 입력은 접고 지운다(둘 중 하나만 살아 있다) */
  function pickProduct(code: string) {
    setCustomOpen(false);
    setLastProduct(undefined);
    onProductChange?.(undefined);
    onProductCodeChange(productCode === code ? undefined : code);
  }

  // 종류를 아직 안 골랐으면(즉답에서 "아직 몰라요") 이 카드는 통째로 안 보인다
  if (paperType === undefined) return null;

  // 고른 종류 중 손님에게 보여도 되는 제품만 남긴다
  const list = products.filter((p) => p.kind === paperType && isShowable(p));

  return (
    <Card>
      <h2 className="text-[20px] font-bold text-foreground">벽지 제품</h2>

      <div className="flex flex-col">
        {list.map((p) => {
          const selected = productCode === p.code;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => pickProduct(p.code)}
              aria-pressed={selected}
              className={
                'w-full text-left flex items-stretch gap-3 border-t border-v1-line-2 ' +
                'transition-colors duration-150 ' +
                (selected ? 'bg-v1-card-soft' : '')
              }
            >
              {/* 고른 줄 표시 — 왼쪽 브라운 세로선 3px */}
              <span className={`w-[3px] flex-none ${selected ? 'bg-brown' : 'bg-transparent'}`} />

              <span className="flex-1 min-w-0 flex items-start justify-between gap-3 py-3 pr-1">
                <span className="flex flex-col gap-1 min-w-0">
                  <span className="text-[16px] text-foreground">
                    {p.brand} {p.name}
                  </span>
                  <span className="text-[14px] text-v1-text-disabled">{p.sourceLabel}</span>
                </span>

                <span className="text-[16px] text-foreground tabular-nums flex-none">
                  {formatRollPrice(p.price as number)}
                </span>
              </span>
            </button>
          );
        })}

        {/* 마지막 줄 — 목록에 없는 벽지를 직접 적는다 */}
        <button
          type="button"
          onClick={toggleCustom}
          aria-expanded={customOpen}
          className={
            'w-full text-left flex items-stretch gap-3 border-t border-v1-line-2 ' +
            'transition-colors duration-150 ' +
            (customOpen ? 'bg-v1-card-soft' : '')
          }
        >
          {/* 펼친 동안은 목록 선택과 같은 방식으로 왼쪽 세로선을 세운다 */}
          <span className={`w-[3px] flex-none ${customOpen ? 'bg-brown' : 'bg-transparent'}`} />
          <span className="flex-1 min-w-0 flex items-center justify-between gap-3 min-h-11 py-3 pr-1">
            <span className="text-[16px] text-foreground">직접 입력</span>
            {customOpen ? (
              <IconChevronUp className="text-v1-text-label" />
            ) : (
              <IconChevronDown className="text-v1-text-label" />
            )}
          </span>
        </button>

        {customOpen && (
          <div className="flex flex-col gap-2 pt-3 pl-3">
            {/* 가격은 자릿수가 길어 한 줄을 통째로 쓴다(좁은 폰에서 숫자가 잘리지 않게) */}
            <span className="text-[14px] text-v1-text-label">롤당 가격</span>
            <NumberField
              aria-label="롤당 가격"
              suffix="원"
              placeholder="44000"
              value={custom.rollPrice}
              onChange={(v) => updateCustom({ rollPrice: v })}
            />

            {/* 폭·길이는 짧은 숫자라 한 줄에 2칸 */}
            <div className="flex gap-2 text-[14px] text-v1-text-label pt-1">
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

            {/* 무늬 반복은 선택 — 비워 두면 무지로 본다 */}
            <span className="text-[14px] text-v1-text-label pt-1">무늬 반복</span>
            <NumberField
              aria-label="무늬 반복"
              suffix="cm"
              placeholder="선택"
              value={custom.repeatCm}
              onChange={(v) => updateCustom({ repeatCm: v })}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
