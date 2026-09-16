// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 오케스트레이터 (클라이언트)
// 도배 WallpaperCalculator.tsx를 그대로 본떠 만들었다.
//
//   맨 위에 [간단하게 계산하기 | 정확하게 계산하기] 세그먼트(form.view) + 캡션 1줄.
//   카드 1(항상 첫 번째, 두 모드 공통) — 바닥재(MaterialPicker): 종류부터 고른다.
//   카드 2(모드에 따라 QuickAnswer 또는 PreciseSection 중 하나만) — 평형 즉답 / 실측.
//   오른쪽(PC)·아래(모바일)에 결과 패널, 모바일엔 하단 고정 요약 바.
//
// 2026-09-16 튜토리얼식 단계 안내 도입 — 도배와 같은 방식(WallpaperCalculator 참고):
//   처음 들어오면 ModePicker로 모드부터 고르게 하고, 고른 뒤엔 자재 → 제품 → 면적/범위
//   3단계를 StepFlow로 순서대로 연다. 공유 링크(?d=)면 모드 선택을 건너뛴다.
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다
// (자식이 직접 상태를 갖지 않는다).
//
// 작성일: 2026년 09월 10일
// 튜토리얼식 단계 안내: 2026년 09월 16일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
// GA4 — 계산기 화면 진입 이벤트(마운트 1번만)
import { track } from '@/lib/analytics';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import MaterialPicker from './MaterialPicker';
import ScopeChips from './ScopeChips';
import ResultPanel from './ResultPanel';
import StepFlow from '../_components/StepFlow';
import { useStepFlow } from '../_components/useStepFlow';
import ModePicker, { type CalcViewMode } from '../_components/ModePicker';

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

  // 튜토리얼식 단계 안내 — 공유 링크면 모드 선택 화면을 건너뛴다(도배와 같은 규칙)
  const hasSharedLink = !!searchParams.get('d');
  const [userPickedMode, setUserPickedMode] = useState(false);
  const modeChosen = hasSharedLink || userPickedMode;

  // 폼이 바뀔 때마다 하나씩 올라가는 숫자 — useStepFlow가 "방금 뭔가 골랐다"를 알아채는 용도
  const [formVersion, setFormVersion] = useState(0);

  // GA4 — 바닥재 계산기 화면에 들어왔다는 이벤트를 딱 1번만 보낸다(마운트 시점)
  useEffect(() => {
    track('calc_view', { process: 'flooring' });
  }, []);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<FlooringFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
    setFormVersion((v) => v + 1);
  }

  /**
   * 바닥재 종류가 바뀌는 유일한 통로. 종류만 바꾸고 이전에 고른 제품(productCode·product)을
   * 안 지우면 화면엔 새 종류가 선택된 것처럼 보여도 계산은 옛 제품 규격·가격으로 되는 버그가
   * 된다(도배 setPaperType과 같은 이유). 바닥재 카드(MaterialPicker)는 이 함수 하나만 쓴다.
   */
  function setKind(v: FlooringKind | undefined) {
    patch({ kind: v, productCode: undefined, product: undefined });
    touch(0);
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

  // ── 튜토리얼식 단계 안내: 3단계(자재 → 제품 → 면적/범위) 값 유효 여부(dataComplete) ──
  // 도배와 같은 규칙 — 제품 단계는 "간단하게"만 필수(정확하게는 종류만 고르면 값은 유효한 것으로 본다).
  // 2026-09-16 보완: 기본값 때문에 저절로 완료되지 않도록 useStepFlow가 touched와 함께 가린다.
  const step0DataComplete = !!form.kind;
  const step1DataComplete = step0DataComplete && (view === 'precise' || hasProduct);
  const step2DataComplete = !!result;
  const { activeIndex, allDone, completeFlags, reopen, touch } = useStepFlow(
    [step0DataComplete, step1DataComplete, step2DataComplete],
    formVersion,
    hasSharedLink,
  );
  const [step0Complete, step1Complete, step2Complete] = completeFlags;

  // 2단계(제품) 완료 요약 한 줄
  const selectedProductOption = form.productCode ? products.find((p) => p.code === form.productCode) : undefined;
  const productLabel = selectedProductOption
    ? `${selectedProductOption.brand} ${selectedProductOption.name}`
    : form.product
      ? '직접 입력'
      : '제품 선택 안 함';
  const step1Summary = `${form.kind} · ${productLabel}`;

  // 단계별 안내 한 줄 — StepFlow caption과 하단 고정 바("N/3 · 안내")가 같은 문구를 쓴다
  const stepCaptions = [
    '바닥재를 고르세요',
    '바닥재 제품을 고르세요',
    view === 'simple' ? '면적을 넣으면 나와요' : '치수를 넣으면 나와요',
  ];
  /** 폼 상태를 바꾸면서 동시에 "면적/실측 단계를 손댔다"고 표시하는 도우미(3단계 전용) */
  function patchAreaStep(p: Partial<FlooringFormState>) {
    patch(p);
    touch(2);
  }

  // "N/3 · 안내" — 하단 고정 바와 (완료 전) 결과 패널 자리가 같이 쓰는 문구
  const progressText = `${Math.min(activeIndex + 1, stepCaptions.length)}/${stepCaptions.length} · ${
    stepCaptions[Math.min(activeIndex, stepCaptions.length - 1)]
  }`;

  /** 모바일 하단 요약 바 "결과 보기" — 결과 패널로 부드럽게 스크롤 */
  function scrollToResult() {
    track('calc_cta_click', { process: 'flooring', target: 'result_view' });
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 첫 화면 — 아직 모드를 안 골랐으면 질문 하나만 보여준다(결과 패널·하단 바 전부 숨김)
  if (!modeChosen) {
    return (
      <>
        <TopNav title="바닥재 계산기" backHref="/calc" as="p" />
        <div className="px-5 lg:px-8 max-w-[1120px] mx-auto">
          <ModePicker
            onPick={(v: CalcViewMode) => {
              patch({ view: v });
              setUserPickedMode(true);
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {/* as="p": 검색엔진용 진짜 h1은 page.tsx(서버)에 sr-only로 따로 있어서, 여긴 h1 중복 방지로 p 태그 */}
      <TopNav title="바닥재 계산기" backHref="/calc" as="p" />

      {/* 모바일: 세로 1열(모드 세그먼트→바닥재→평형/실측→결과), 하단 고정 요약 바만큼 pb-20으로 여백.
          PC(lg): 왼쪽 입력 480~560px 고정 + 오른쪽 결과 sticky */}
      {/* 좌우 여백을 공용 Container(px-5/lg:px-8)와 동일하게 맞춰 헤더 로고와 x축을 일치시킨다 */}
      <div className="px-5 lg:px-8 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          {/* 모드 세그먼트 — 카드 바깥, 화면 맨 위. 캡션 1줄만(설명글 최소화 원칙) */}
          <div className="flex flex-col gap-2">
            <Segment options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} />
            <p className="text-[14px] text-v1-text-secondary">
              {view === 'simple' ? '제품과 평형만으로 바로 나와요' : '실측과 제품까지 반영해요'}
            </p>
          </div>

          {/* 1단계 — 자재 */}
          <StepFlow
            index={0}
            activeIndex={activeIndex}
            title="자재"
            caption={stepCaptions[0]}
            summary={form.kind}
            complete={step0Complete}
            onReopen={() => reopen(0)}
          >
            <MaterialPicker
              part="kind"
              kind={form.kind}
              onKindChange={setKind}
              productCode={form.productCode}
              onProductCodeChange={(v) => patch({ productCode: v })}
              products={products}
              product={form.product}
              onProductChange={(v) => patch({ product: v })}
            />
          </StepFlow>

          {/* 2단계 — 제품 */}
          <StepFlow
            index={1}
            activeIndex={activeIndex}
            title="제품"
            caption={stepCaptions[1]}
            summary={step1Summary}
            complete={step1Complete}
            onReopen={() => reopen(1)}
          >
            <MaterialPicker
              part="product"
              kind={form.kind}
              onKindChange={setKind}
              productCode={form.productCode}
              onProductCodeChange={(v) => {
                patch({ productCode: v });
                touch(1);
              }}
              products={products}
              product={form.product}
              onProductChange={(v) => {
                patch({ product: v });
                touch(1);
              }}
            />
            {/* 정확하게 모드는 제품을 안 골라도 종류 평균가로 계산되므로 건너뛸 수 있게 둔다
                (간단 모드는 제품이 필수라 없음) */}
            {view === 'precise' && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-v1-text-secondary">제품은 안 골라도 돼요</span>
                <button
                  type="button"
                  onClick={() => touch(1)}
                  className="text-[13px] font-semibold text-brown underline underline-offset-4"
                >
                  건너뛰기
                </button>
              </div>
            )}
          </StepFlow>

          {/* 3단계 — 면적/범위(간단) 또는 실측(정확). keepOpen — 값을 계속 조정하는 단계라
              끝나도 접지 않는다. 범위 칩(전체/방만/거실주방)은 간단 모드일 때만, 면적 옆에 둔다
              (검사관 1라운드 지적 1번: 실측 모드는 범위 칩이 뜻이 없다). */}
          <StepFlow
            index={2}
            activeIndex={activeIndex}
            title={view === 'simple' ? '면적' : '실측'}
            caption={stepCaptions[2]}
            complete={step2Complete}
            keepOpen
          >
            {view === 'simple' ? (
              <>
                <QuickAnswer
                  pyeong={form.pyeong ?? ''}
                  onPyeongChange={(v) => patchAreaStep({ pyeong: v === '' ? undefined : v })}
                  areaUnit={form.areaUnit ?? '평'}
                  onAreaUnitChange={(v) => patchAreaStep({ areaUnit: v })}
                  exclusiveSqm={form.exclusiveSqm ?? ''}
                  onExclusiveSqmChange={(v) => patchAreaStep({ exclusiveSqm: v === '' ? undefined : v })}
                  bay={form.bay ?? 3}
                  onBayChange={(v) => patchAreaStep({ bay: v })}
                />
                <ScopeChips scope={form.scope ?? '전체'} onScopeChange={(v) => patchAreaStep({ scope: v })} />
              </>
            ) : (
              <PreciseSection
                unit={form.unit ?? 'm'}
                onUnitChange={(v) => patchAreaStep({ unit: v })}
                rooms={form.preciseRooms ?? []}
                onRoomsChange={(v) => patchAreaStep({ preciseRooms: v })}
              />
            )}
          </StepFlow>
        </div>

        {/* 오른쪽 — 결과. PC는 스크롤해도 따라오게 sticky, 화면보다 길면 패널 안에서만 스크롤 */}
        <div
          ref={resultRef}
          className="scroll-mt-16 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto"
        >
          {/* 2026-09-16 보완: 3단계를 다 "손대서" 끝내기 전엔(allDone) 기본값으로 이미 계산된
              결과가 있어도 보여주지 않는다 — PC 결과 패널 자리엔 "N/3 · 안내"만 나온다. */}
          <ResultPanel
            result={allDone ? result : null}
            range={allDone ? range : null}
            loading={loading}
            error={allDone ? error : null}
            stale={stale}
            form={form}
            emptyMessage={allDone ? emptyMessage : progressText}
            onRemoveOldChange={(v) => patch({ removeOld: v })}
            onBaseboardChange={(v) => patch({ baseboard: v })}
          />
        </div>
      </div>

      {/* 모바일 하단 고정 요약 바 — PC(lg)에서는 숨긴다.
          2026-09-16 보완: 3단계를 다 "손대서" 끝내기 전엔(allDone) 숫자 대신 "N/3 · 안내"로
          지금 할 일을 짚어준다(기본값 때문에 결과부터 보이는 걸 막는다). */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-v1-line flex items-center justify-between px-4 lg:hidden z-40">
        {allDone && result && range ? (
          <span className="text-[16px] font-semibold text-brown tabular-nums">
            {formatNum(result.quantity.units)}
            {result.quantity.unit === '박스' ? '박스' : 'm'} · {formatManRange(range.min, range.max)}
          </span>
        ) : (
          <span className="text-[14px] text-v1-text-secondary">{progressText}</span>
        )}
        {/* 2026-09-16 형아 피드백: 칩·세그먼트는 다 줄였지만 이 버튼만은 44px를 유지한다(누르는
            자리라 너무 작아지면 안 됨) */}
        <Button variant="primary" className="!h-11 !px-4 !text-[14px]" onClick={scrollToResult}>
          결과 보기
        </Button>
      </div>
    </>
  );
}
