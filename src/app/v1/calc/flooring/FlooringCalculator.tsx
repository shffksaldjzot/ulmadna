// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 오케스트레이터 (클라이언트)
// 도배 WallpaperCalculator.tsx를 그대로 본떠 만들었다.
//
//   맨 위에 [간단하게 계산하기 | 정확하게 계산하기] 세그먼트(form.view) + 캡션 1줄.
//   카드 1(항상 첫 번째, 두 모드 공통) — 바닥재(MaterialPicker): 종류부터 고른다.
//   카드 2(모드에 따라 QuickAnswer 또는 PreciseSection 중 하나만) — 평형 즉답 / 실측.
//   오른쪽(PC)·아래(모바일)에 결과 패널, 모바일엔 하단 고정 요약 바.
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다
// (자식이 직접 상태를 갖지 않는다).
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Button from '@/components/v1/Button';
import Segment from '@/components/v1/Segment';
import {
  DEFAULT_FLOORING_FORM,
  decodeFlooringForm,
  type FlooringFormState,
  type FlooringKind,
  type FlooringProductOption,
} from '@/lib/v1/flooringQuery';
import { useFlooringCalc } from '@/lib/v1/useFlooringCalc';
import { formatManRange, formatNum } from '@/lib/v1/money';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import MaterialPicker from './MaterialPicker';
import ScopeChips from './ScopeChips';
import ResultPanel from './ResultPanel';

interface FlooringCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: FlooringProductOption[];
}

/** 화면 모드 세그먼트 옵션 — 값은 폼 상태 view와 그대로 맞춘다 */
const VIEW_OPTIONS = [
  { value: 'simple' as const, label: '간단하게 계산하기' },
  { value: 'precise' as const, label: '정확하게 계산하기' },
];

export default function FlooringCalculator({ products }: FlooringCalculatorProps) {
  const searchParams = useSearchParams();

  // 공유 링크(?d=...)로 들어온 경우 이전 조건을 복원하고, 없으면 즉답 기본값
  const initial = useMemo<FlooringFormState>(
    () => decodeFlooringForm(searchParams.get('d')) ?? DEFAULT_FLOORING_FORM,
    [searchParams],
  );

  // 폼 상태는 이 컴포넌트 한 곳에서만 들고 있는다. 자식은 값과 onChange만 받는다.
  const [form, setForm] = useState<FlooringFormState>(initial);
  // 모바일 하단 고정 요약 바의 "결과 보기"가 스크롤해서 이동할 대상
  const resultRef = useRef<HTMLDivElement>(null);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<FlooringFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  /**
   * 바닥재 종류가 바뀌는 유일한 통로. 종류만 바꾸고 이전에 고른 제품(productCode·product)을
   * 안 지우면 화면엔 새 종류가 선택된 것처럼 보여도 계산은 옛 제품 규격·가격으로 되는 버그가
   * 된다(도배 setPaperType과 같은 이유). 바닥재 카드(MaterialPicker)는 이 함수 하나만 쓴다.
   */
  function setKind(v: FlooringKind | undefined) {
    patch({ kind: v, productCode: undefined, product: undefined });
  }

  const view = form.view ?? 'simple';
  const { result, range, loading, error, stale } = useFlooringCalc(form, products);

  // 결과가 없을 때(!result) 즉답 자리·결과 패널·모바일 하단 바가 다 같이 쓰는 한 줄.
  // 원인 우선순위: 종류 미선택 > (간단 모드) 제품 미선택 > (모드별) 평형 없음 / 치수 없음.
  const hasProduct = !!form.productCode || !!form.product;
  const emptyMessage = !form.kind
    ? '바닥재를 고르면 바로 나와요'
    : view === 'precise'
      ? '치수를 넣으면 나와요'
      : !hasProduct
        ? '제품을 고르면 바로 나와요'
        : '평형을 고르면 바로 나와요';

  /** 모바일 하단 요약 바 "결과 보기" — 결과 패널로 부드럽게 스크롤 */
  function scrollToResult() {
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <TopNav title="바닥재 계산기" backHref="/v1" />

      {/* 모바일: 세로 1열(모드 세그먼트→바닥재→평형/실측→결과), 하단 고정 요약 바만큼 pb-20으로 여백.
          PC(lg): 왼쪽 입력 480~560px 고정 + 오른쪽 결과 sticky */}
      <div className="px-4 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          {/* 모드 세그먼트 — 카드 바깥, 화면 맨 위. 캡션 1줄만(설명글 최소화 원칙) */}
          <div className="flex flex-col gap-2">
            <Segment options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} />
            <p className="text-[14px] text-v1-text-secondary">
              {view === 'simple' ? '제품과 평형만으로 바로 나와요' : '실측과 제품까지 반영해요'}
            </p>
          </div>

          {/* 카드 1 — 바닥재. 두 모드 공통, 항상 첫 번째 */}
          <MaterialPicker
            kind={form.kind}
            onKindChange={setKind}
            productCode={form.productCode}
            onProductCodeChange={(v) => patch({ productCode: v })}
            products={products}
            product={form.product}
            onProductChange={(v) => patch({ product: v })}
            // 검사관 1라운드 지적 1번: 정확(실측) 모드는 방을 직접 골라 넣은 것이라 범위 칩
            // (전체/방만/거실주방)이 뜻이 없다 — 엔진도 실측이면 scope를 전체로 고정하니
            // 화면도 간단 모드일 때만 이 칩을 보여준다.
            footer={
              view === 'simple' ? (
                <ScopeChips scope={form.scope ?? '전체'} onScopeChange={(v) => patch({ scope: v })} />
              ) : undefined
            }
          />

          {/* 카드 2 — 모드에 따라 하나만 그린다 */}
          {view === 'simple' ? (
            <QuickAnswer
              pyeong={form.pyeong ?? ''}
              onPyeongChange={(v) => patch({ pyeong: v === '' ? undefined : v })}
              bay={form.bay ?? 3}
              onBayChange={(v) => patch({ bay: v })}
              range={range}
              loading={loading}
              error={error}
              stale={stale}
              kind={form.kind}
              result={result}
              emptyMessage={emptyMessage}
            />
          ) : (
            <PreciseSection
              unit={form.unit ?? 'm'}
              onUnitChange={(v) => patch({ unit: v })}
              rooms={form.preciseRooms ?? []}
              onRoomsChange={(v) => patch({ preciseRooms: v })}
            />
          )}
        </div>

        {/* 오른쪽 — 결과. PC는 스크롤해도 따라오게 sticky, 화면보다 길면 패널 안에서만 스크롤 */}
        <div
          ref={resultRef}
          className="scroll-mt-16 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto"
        >
          <ResultPanel
            result={result}
            range={range}
            loading={loading}
            error={error}
            stale={stale}
            form={form}
            emptyMessage={emptyMessage}
            onRemoveOldChange={(v) => patch({ removeOld: v })}
            onBaseboardChange={(v) => patch({ baseboard: v })}
          />
        </div>
      </div>

      {/* 모바일 하단 고정 요약 바 — PC(lg)에서는 숨긴다 */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-v1-line flex items-center justify-between px-4 lg:hidden z-40">
        {result && range ? (
          <span className="text-[16px] font-semibold text-brown tabular-nums">
            {formatNum(result.quantity.units)}
            {result.quantity.unit === '박스' ? '박스' : 'm'} · {formatManRange(range.min, range.max)}
          </span>
        ) : (
          <span className="text-[14px] text-v1-text-secondary">{emptyMessage}</span>
        )}
        <Button variant="primary" className="!h-9 !px-4 !text-[14px]" onClick={scrollToResult}>
          결과 보기
        </Button>
      </div>
    </>
  );
}
