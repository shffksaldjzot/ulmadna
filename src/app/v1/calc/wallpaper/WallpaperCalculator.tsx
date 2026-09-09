// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 오케스트레이터 (클라이언트)
//
// 2026-09-09 화면 재배치(벽지 최우선 A안):
//   맨 위에 [간단하게 계산하기 | 정확하게 계산하기] 세그먼트(form.view) + 캡션 1줄.
//   카드 1(항상 첫 번째, 두 모드 공통) — 벽지(PaperPicker): 종류부터 고른다.
//   카드 2(모드에 따라 QuickAnswer 또는 PreciseSection 중 하나만) — 평형 즉답 / 실측.
//   오른쪽(PC)·아래(모바일)에 결과 패널, 모바일엔 하단 고정 요약 바.
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다
// (자식이 직접 상태를 갖지 않는다).
//
// 작성일: 2026년 09월 08일
// 2026년 09월 09일: B·C 지시서 완료 배선(lengthOpenings·product 포함)
// 재배치: 2026년 09월 09일 (벽지 최우선 A안 — 벽지 카드 1번 고정, 모드 세그먼트 도입)
// ──────────────────────────────────────────────

'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Button from '@/components/v1/Button';
import Segment from '@/components/v1/Segment';
import {
  DEFAULT_CALC_FORM,
  decodeWallpaperForm,
  type WallpaperFormState,
  type WallpaperProductOption,
} from '@/lib/v1/wallpaperQuery';
import { useWallpaperCalc } from '@/lib/v1/useWallpaperCalc';
import { formatManRange, formatNum } from '@/lib/v1/money';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import PaperPicker from './PaperPicker';
import ConditionChips from './ConditionChips';
import ResultPanel from './ResultPanel';

interface WallpaperCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: WallpaperProductOption[];
}

/** 화면 모드 세그먼트 옵션 — 값은 폼 상태 view와 그대로 맞춘다 */
const VIEW_OPTIONS = [
  { value: 'simple' as const, label: '간단하게 계산하기' },
  { value: 'precise' as const, label: '정확하게 계산하기' },
];

export default function WallpaperCalculator({ products }: WallpaperCalculatorProps) {
  const searchParams = useSearchParams();

  // 공유 링크(?d=...)로 들어온 경우 이전 조건을 복원하고, 없으면 즉답 기본값(간단 모드, 34평 3베이, 벽지 미선택)
  const initial = useMemo<WallpaperFormState>(
    () => decodeWallpaperForm(searchParams.get('d')) ?? DEFAULT_CALC_FORM,
    [searchParams],
  );

  // 폼 상태는 이 컴포넌트 한 곳에서만 들고 있는다. 자식은 값과 onChange만 받는다.
  const [form, setForm] = useState<WallpaperFormState>(initial);
  // 모바일 하단 고정 요약 바의 "결과 보기"가 스크롤해서 이동할 대상
  const resultRef = useRef<HTMLDivElement>(null);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<WallpaperFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  /**
   * 벽지 종류가 바뀌는 유일한 통로. 종류만 바꾸고 이전에 고른 제품(productCode·product)을
   * 안 지우면 화면엔 새 종류가 선택된 것처럼 보여도 계산은 옛 제품 규격·가격으로 되는
   * 치명 버그였다(검사관 지적 1번). 벽지 카드(PaperPicker)는 이 함수 하나만 쓴다.
   */
  function setPaperType(v: '합지' | '실크' | undefined) {
    patch({ paperType: v, productCode: undefined, product: undefined });
  }

  const view = form.view ?? 'simple';
  const { result, range, loading, error, stale } = useWallpaperCalc(form, products);

  // 결과가 없을 때(!result) 즉답 자리·결과 패널·모바일 하단 바가 다 같이 쓰는 한 줄.
  // 원인 우선순위: 벽지 종류 미선택 > (모드별) 평형 없음 / 치수 없음.
  const emptyMessage = !form.paperType
    ? '벽지를 고르면 바로 나와요'
    : view === 'precise'
      ? '치수를 넣으면 나와요'
      : '평형을 고르면 바로 나와요';

  /** 모바일 하단 요약 바 "결과 보기" — 결과 패널로 부드럽게 스크롤 */
  function scrollToResult() {
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <TopNav title="도배 계산기" backHref="/v1" />

      {/* 모바일: 세로 1열(모드 세그먼트→벽지→평형/실측→결과), 하단 고정 요약 바만큼 pb-20으로 여백.
          PC(lg): 왼쪽 입력 480~560px 고정 + 오른쪽 결과 sticky */}
      <div className="px-4 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          {/* 모드 세그먼트 — 카드 바깥, 화면 맨 위. 캡션 1줄만(설명글 최소화 원칙) */}
          <div className="flex flex-col gap-2">
            <Segment options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} />
            <p className="text-[14px] text-v1-text-secondary">
              {view === 'simple' ? '벽지와 평형만으로 바로 나와요' : '실측과 벽지 제품까지 반영해요'}
            </p>
          </div>

          {/* 카드 1 — 벽지. 두 모드 공통, 항상 첫 번째 */}
          <PaperPicker
            paperType={form.paperType}
            onPaperTypeChange={setPaperType}
            productCode={form.productCode}
            onProductCodeChange={(v) => patch({ productCode: v })}
            products={products}
            // 목록에 없는 벽지를 직접 입력(롤당 가격·폭·길이·무늬 반복)
            product={form.product}
            onProductChange={(v) => patch({ product: v })}
            // 범위(벽·천장) 칩은 벽지 선택 바로 아래(2026-09-09 형아 지시)
            footer={<ConditionChips target={form.target ?? 'both'} onTargetChange={(v) => patch({ target: v })} />}
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
              target={form.target ?? 'both'}
              paperType={form.paperType}
              result={result}
              emptyMessage={emptyMessage}
            />
          ) : (
            <PreciseSection
              entry={form.entry ?? 'room'}
              onEntryChange={(v) => patch({ entry: v })}
              unit={form.unit ?? 'm'}
              onUnitChange={(v) => patch({ unit: v })}
              target={form.target ?? 'both'}
              heightM={form.heightM ?? ''}
              onHeightChange={(v) => patch({ heightM: v === '' ? undefined : v })}
              rooms={form.preciseRooms ?? []}
              onRoomsChange={(v) => patch({ preciseRooms: v })}
              wallLength={form.wallLength ?? ''}
              onWallLengthChange={(v) => patch({ wallLength: v === '' ? undefined : v })}
              directCeilingSqm={form.directCeilingSqm ?? ''}
              onDirectCeilingSqmChange={(v) => patch({ directCeilingSqm: v === '' ? undefined : v })}
              // 벽 길이 모드에서 빼는 문·창 목록 — 훅(toEngineInput)이 면적으로 환산해 벽 면적에서 뺀다
              lengthOpenings={form.lengthOpenings ?? []}
              onLengthOpeningsChange={(v) => patch({ lengthOpenings: v })}
            />
          )}
        </div>

        {/* 오른쪽 — 결과. PC는 스크롤해도 따라오게 sticky, 화면보다 길면 패널 안에서만 스크롤.
            scroll-mt-16: "결과 보기"로 스크롤했을 때 위 고정 내비(TopNav)에 안 가리게 여유를 둔다.
            lg:top-[84px]: PC 전역 헤더(TopNav 64px≈65px) + 여백 16px만큼 내려서 붙인다.
            max-h도 그만큼 빼서 화면 밖으로 안 넘친다 */}
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
          />
        </div>
      </div>

      {/* 모바일 하단 고정 요약 바 — PC(lg)에서는 숨긴다 */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-v1-line flex items-center justify-between px-4 lg:hidden z-40">
        {result && range ? (
          <span className="text-[16px] font-semibold text-brown tabular-nums">
            {formatNum(result.quantity.rolls)}롤 · {formatManRange(range.min, range.max)}
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
