// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 오케스트레이터 (클라이언트)
//
// 2026-09-09 화면 재배치(벽지 최우선 A안):
//   맨 위에 [간단하게 계산하기 | 정확하게 계산하기] 세그먼트(form.view) + 캡션 1줄.
//   카드 1(항상 첫 번째, 두 모드 공통) — 벽지(PaperPicker): 종류부터 고른다.
//   카드 2(모드에 따라 QuickAnswer 또는 PreciseSection 중 하나만) — 평형 즉답 / 실측.
//   오른쪽(PC)·아래(모바일)에 결과 패널, 모바일엔 하단 고정 요약 바.
//
// 2026-09-16 튜토리얼식 단계 안내 도입:
//   처음 들어오면(공유 링크가 아니면) ModePicker로 "간단/정확"부터 하나만 고르게 하고,
//   고르기 전엔 그 아래 아무것도 안 보여준다(결과 패널·하단 바까지 전부 숨김).
//   고른 뒤에는 벽지 종류 → 벽지 제품 → 면적(또는 실측) 3단계를 StepFlow로 순서대로
//   열어 보여준다 — 카드(PaperPicker·QuickAnswer 등) 자체는 그대로 두고 배치만 바꿨다.
//   공유 링크(?d=)로 들어오면 모드 선택을 건너뛰고 바로 이 3단계 화면으로 연다(전부
//   완료 상태로 보인다).
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다
// (자식이 직접 상태를 갖지 않는다).
//
// 작성일: 2026년 09월 08일
// 2026년 09월 09일: B·C 지시서 완료 배선(lengthOpenings·product 포함)
// 재배치: 2026년 09월 09일 (벽지 최우선 A안 — 벽지 카드 1번 고정, 모드 세그먼트 도입)
// 튜토리얼식 단계 안내: 2026년 09월 16일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
// GA4 — 계산기 화면 진입 이벤트(마운트 1번만)
import { track } from '@/lib/analytics';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import PaperPicker from './PaperPicker';
import ConditionChips from './ConditionChips';
import ResultPanel from './ResultPanel';
import StepFlow from '../_components/StepFlow';
import { useStepFlow } from '../_components/useStepFlow';
import ModePicker, { type CalcViewMode } from '../_components/ModePicker';

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

  // 튜토리얼식 단계 안내: 공유 링크로 들어왔으면 모드 선택 화면을 건너뛰고 바로 3단계
  // 화면(전부 완료 상태)을 연다. 아니면 ModePicker에서 하나를 고를 때까지 아무것도 안 보여준다.
  const hasSharedLink = !!searchParams.get('d');
  const [userPickedMode, setUserPickedMode] = useState(false);
  const modeChosen = hasSharedLink || userPickedMode;

  // 폼이 바뀔 때마다 하나씩 올라가는 숫자 — useStepFlow가 "방금 사용자가 뭔가 골랐다"를
  // 알아채는 데 쓴다("바꾸기"로 다시 연 단계에서 값을 바꾸면 원래 흐름으로 돌아가게 하는 용도)
  const [formVersion, setFormVersion] = useState(0);

  // GA4 — 도배 계산기 화면에 들어왔다는 이벤트를 딱 1번만 보낸다(마운트 시점)
  useEffect(() => {
    track('calc_view', { process: 'wallpaper' });
  }, []);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<WallpaperFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
    setFormVersion((v) => v + 1);
  }

  /**
   * 벽지 종류가 바뀌는 유일한 통로. 종류만 바꾸고 이전에 고른 제품(productCode·product)을
   * 안 지우면 화면엔 새 종류가 선택된 것처럼 보여도 계산은 옛 제품 규격·가격으로 되는
   * 치명 버그였다(검사관 지적 1번). 벽지 카드(PaperPicker)는 이 함수 하나만 쓴다.
   * touch(0): 종류 칩을 실제로 눌렀다는 표시 — 기본값(미선택)엔 해당 없지만 일관성을 위해 둔다.
   */
  function setPaperType(v: '합지' | '실크' | undefined) {
    patch({ paperType: v, productCode: undefined, product: undefined });
    touch(0);
  }

  const view = form.view ?? 'simple';
  const { result, range, loading, error, stale } = useWallpaperCalc(form, products);

  // 결과가 없을 때(!result) 즉답 자리·결과 패널·모바일 하단 바가 다 같이 쓰는 한 줄.
  // 원인 우선순위: 벽지 종류 미선택 > (간단 모드) 제품 미선택 > (모드별) 평형 없음 / 치수 없음.
  // 2026-09-09 형아 지시: 간단하게 계산하기는 제품을 골라야 금액이 나온다.
  const hasProduct = !!form.productCode || !!form.product;
  const emptyMessage = !form.paperType
    ? '벽지를 고르면 바로 나와요'
    : view === 'precise'
      ? '치수를 넣으면 나와요'
      : !hasProduct
        ? '벽지 제품을 고르면 바로 나와요'
        : '평형을 고르면 바로 나와요';

  // ── 튜토리얼식 단계 안내: 3단계(종류 → 제품 → 면적/실측) 값 유효 여부(dataComplete) ──
  // 2단계(제품)는 "간단하게"만 필수다(위 emptyMessage와 같은 규칙) — "정확하게"는 제품을
  // 안 골라도 종류 평균가로 계산되므로, 종류만 고르면 이 단계도 값은 유효한 것으로 본다.
  // 2026-09-16 보완: 이건 "값이 있는지"만 볼 뿐 — 기본값 때문에 저절로 완료되지 않도록
  // useStepFlow 안에서 touched(실제로 손댔는지)와 함께 봐서 진짜 완료(completeFlags)를 가린다.
  const step0DataComplete = !!form.paperType;
  const step1DataComplete = step0DataComplete && (view === 'precise' || hasProduct);
  const step2DataComplete = !!result;
  // 공유 링크(?d=)로 들어온 경우만 처음부터 전부 "손댄 것"으로 본다(요구사항 — 그 외엔
  // 기본값이 있어도 사용자가 실제로 탭/입력해야 그 단계가 완료로 접힌다)
  const { activeIndex, allDone, completeFlags, reopen, touch } = useStepFlow(
    [step0DataComplete, step1DataComplete, step2DataComplete],
    formVersion,
    hasSharedLink,
  );
  const [step0Complete, step1Complete, step2Complete] = completeFlags;

  // 2단계(제품) 완료 요약 한 줄 — "합지 · GNI 개나리 스토리" 형태
  const selectedProductOption = form.productCode ? products.find((p) => p.code === form.productCode) : undefined;
  const productLabel = selectedProductOption
    ? `${selectedProductOption.brand} ${selectedProductOption.name}`
    : form.product
      ? '직접 입력'
      : '제품 선택 안 함';
  const step1Summary = `${form.paperType} · ${productLabel}`;

  // 단계별 안내 한 줄 — StepFlow caption과 하단 고정 바("N/3 · 안내")가 같은 문구를 쓴다
  const stepCaptions = [
    '벽지를 고르세요',
    '벽지 제품을 고르세요',
    view === 'simple' ? '면적을 넣으면 나와요' : '치수를 넣으면 나와요',
  ];
  /** 폼 상태를 바꾸면서 동시에 "면적/실측 단계를 손댔다"고 표시하는 도우미(3단계 전용) */
  function patchAreaStep(p: Partial<WallpaperFormState>) {
    patch(p);
    touch(2);
  }

  // "N/3 · 안내" — 하단 고정 바와 (완료 전) 결과 패널 자리가 같이 쓰는 문구
  const progressText = `${Math.min(activeIndex + 1, stepCaptions.length)}/${stepCaptions.length} · ${
    stepCaptions[Math.min(activeIndex, stepCaptions.length - 1)]
  }`;

  /** 모바일 하단 요약 바 "결과 보기" — 결과 패널로 부드럽게 스크롤 */
  function scrollToResult() {
    track('calc_cta_click', { process: 'wallpaper', target: 'result_view' });
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 첫 화면 — 아직 모드를 안 골랐으면 질문 하나만 보여준다(결과 패널·하단 바 전부 숨김)
  if (!modeChosen) {
    return (
      <>
        <TopNav title="도배 계산기" backHref="/calc" as="p" />
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
      <TopNav title="도배 계산기" backHref="/calc" as="p" />

      {/* 모바일: 세로 1열(모드 세그먼트→벽지→평형/실측→결과), 하단 고정 요약 바만큼 pb-20으로 여백.
          PC(lg): 왼쪽 입력 480~560px 고정 + 오른쪽 결과 sticky */}
      {/* 좌우 여백을 공용 Container(px-5/lg:px-8)와 동일하게 맞춰 헤더 로고와 x축을 일치시킨다 */}
      <div className="px-5 lg:px-8 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          {/* 모드 세그먼트 — 카드 바깥, 화면 맨 위. 언제든 전환 가능(전환 시 단계는 새 값
              기준으로 다시 계산된다). 캡션 1줄만(설명글 최소화 원칙) */}
          <div className="flex flex-col gap-2">
            <Segment options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} />
            <p className="text-[14px] text-v1-text-secondary">
              {view === 'simple' ? '벽지 제품과 평형만으로 바로 나와요' : '실측과 벽지 제품까지 반영해요'}
            </p>
          </div>

          {/* 1단계 — 벽지 종류 */}
          <StepFlow
            index={0}
            activeIndex={activeIndex}
            title="벽지 종류"
            caption={stepCaptions[0]}
            summary={form.paperType}
            complete={step0Complete}
            onReopen={() => reopen(0)}
          >
            <PaperPicker
              part="type"
              paperType={form.paperType}
              onPaperTypeChange={setPaperType}
              productCode={form.productCode}
              onProductCodeChange={(v) => patch({ productCode: v })}
              products={products}
              product={form.product}
              onProductChange={(v) => patch({ product: v })}
            />
          </StepFlow>

          {/* 2단계 — 벽지 제품 (+ 범위(벽·천장) 칩, 2026-09-09 형아 지시대로 제품 바로 아래) */}
          <StepFlow
            index={1}
            activeIndex={activeIndex}
            title="벽지 제품"
            caption={stepCaptions[1]}
            summary={step1Summary}
            complete={step1Complete}
            onReopen={() => reopen(1)}
          >
            <PaperPicker
              part="product"
              paperType={form.paperType}
              onPaperTypeChange={setPaperType}
              productCode={form.productCode}
              onProductCodeChange={(v) => {
                patch({ productCode: v });
                touch(1);
              }}
              products={products}
              // 목록에 없는 벽지를 직접 입력(롤당 가격·폭·길이·무늬 반복)
              product={form.product}
              onProductChange={(v) => {
                patch({ product: v });
                touch(1);
              }}
            />
            {/* 정확하게 모드는 제품을 안 골라도 종류 평균가로 계산되므로, 굳이 안 골라도
                넘어갈 수 있게 짧은 안내 + 건너뛰기 링크를 둔다(간단 모드는 제품이 필수라 없음) */}
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
            <ConditionChips target={form.target ?? 'both'} onTargetChange={(v) => patch({ target: v })} />
          </StepFlow>

          {/* 3단계 — 면적(간단) 또는 실측(정확). 값을 계속 조정하는 단계라 끝나도 접히지
              않는다(keepOpen) — 결과는 옆/아래 ResultPanel이 보여준다 */}
          <StepFlow
            index={2}
            activeIndex={activeIndex}
            title={view === 'simple' ? '면적' : '실측'}
            caption={stepCaptions[2]}
            complete={step2Complete}
            keepOpen
          >
            {view === 'simple' ? (
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
            ) : (
              <PreciseSection
                entry={form.entry ?? 'room'}
                onEntryChange={(v) => patchAreaStep({ entry: v })}
                unit={form.unit ?? 'm'}
                onUnitChange={(v) => patchAreaStep({ unit: v })}
                target={form.target ?? 'both'}
                heightM={form.heightM ?? ''}
                onHeightChange={(v) => patchAreaStep({ heightM: v === '' ? undefined : v })}
                rooms={form.preciseRooms ?? []}
                onRoomsChange={(v) => patchAreaStep({ preciseRooms: v })}
                wallLength={form.wallLength ?? ''}
                onWallLengthChange={(v) => patchAreaStep({ wallLength: v === '' ? undefined : v })}
                directCeilingSqm={form.directCeilingSqm ?? ''}
                onDirectCeilingSqmChange={(v) => patchAreaStep({ directCeilingSqm: v === '' ? undefined : v })}
                // 벽 길이 모드에서 빼는 문·창 목록 — 훅(toEngineInput)이 면적으로 환산해 벽 면적에서 뺀다
                lengthOpenings={form.lengthOpenings ?? []}
                onLengthOpeningsChange={(v) => patchAreaStep({ lengthOpenings: v })}
              />
            )}
          </StepFlow>
        </div>

        {/* 오른쪽 — 결과. PC는 스크롤해도 따라오게 sticky, 화면보다 길면 패널 안에서만 스크롤.
            scroll-mt-16: "결과 보기"로 스크롤했을 때 위 고정 내비(TopNav)에 안 가리게 여유를 둔다.
            lg:top-[84px]: PC 전역 헤더(TopNav 64px≈65px) + 여백 16px만큼 내려서 붙인다.
            max-h도 그만큼 빼서 화면 밖으로 안 넘친다 */}
        <div
          ref={resultRef}
          className="scroll-mt-16 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto"
        >
          {/* 2026-09-16 보완: 3단계를 다 "손대서" 끝내기 전엔(allDone) 기본값으로 이미 계산된
              결과가 있어도 보여주지 않는다 — result·range·error를 통째로 비워서 ResultPanel이
              항상 "빈 상태"(placeholder) 가지를 타게 하고, 그 자리엔 "N/3 · 안내"만 보여준다.
              PC(lg)에서도 이 패널이 결과 자리라 같은 원칙이 적용된다. */}
          <ResultPanel
            result={allDone ? result : null}
            range={allDone ? range : null}
            loading={loading}
            error={allDone ? error : null}
            stale={stale}
            form={form}
            emptyMessage={allDone ? emptyMessage : progressText}
            onRemoveOldChange={(v) => patch({ removeOld: v })}
          />
        </div>
      </div>

      {/* 모바일 하단 고정 요약 바 — PC(lg)에서는 숨긴다.
          2026-09-16 보완: 3단계를 다 "손대서" 끝내기 전엔(allDone) 결과가 이미 계산돼
          있어도 숫자 대신 "N/3 · 안내"로 지금 할 일을 짚어준다 — 기본값 때문에 결과부터
          먼저 보이는 걸 막는다. 다 끝난 뒤에만 지금처럼 숫자 미리보기로 바뀐다. */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-v1-line flex items-center justify-between px-4 lg:hidden z-40">
        {allDone && result && range ? (
          <span className="text-[16px] font-semibold text-brown tabular-nums">
            {formatNum(result.quantity.rolls)}롤 · {formatManRange(range.min, range.max)}
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
