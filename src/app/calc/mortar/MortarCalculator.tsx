// ──────────────────────────────────────────────
// v1 허브 — 미장(레미탈·셀프레벨링) 계산기 오케스트레이터 (클라이언트)
// 도배·바닥재 Calculator.tsx를 그대로 본떠 만들었다.
//
//   맨 위 [간단하게 계산하기 | 정확하게 계산하기] 세그먼트 + 캡션 1줄.
//   그 아래 용도 칩 한 줄(방통 전체 · 확장부 바닥 · 욕실·현관 구배 · 마루 철거 후 보수 ·
//   셀프레벨링) — 예전엔 이 위에 [레미탈·몰탈 | 셀프레벨링] 모드 토글이 따로 한 줄 더
//   있었는데, 셀프레벨링을 용도 칩 하나로 흡수해 화면 맨 위 토글 줄을 4줄→2줄로 줄였다
//   (2026-09-15 디자인 통일 지시). 셀프레벨링 칩을 고르면 예전 모드 토글과 똑같이
//   mode를 '셀프레벨링'으로 바꾸고 두께·제품·옵션을 그 모드 기본값으로 정리한다.
//   카드(모드에 따라 QuickAnswer 또는 PreciseSection 중 하나만) — 면적·두께·옵션.
//   오른쪽(PC)·아래(모바일)에 결과 패널, 모바일엔 하단 고정 요약 바.
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다.
//
// 2026-09-15 운영자 현장 기준 피드백(포수가 안 보이는 문제) — 훅을 두 개 쓴다:
//   useMortarQuickCalc  즉시 계산(서버 응답 없이 포수·체적·현장배합을 바로 계산)
//   useMortarCalc       서버 계산(비용·인건 — 400ms 디바운스 + API 호출)
// QuickAnswer·PreciseSection·ResultPanel은 quick(항상 있음)을 먼저 보여주고,
// result(서버, 늦게 올 수도·실패할 수도)가 오면 비용·인건만 덧붙인다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 피드백 — 즉답 분리)
// 화면 재배치(용도 칩으로 모드 흡수): 2026년 09월 15일 (디자인 통일 작업 B)
// ──────────────────────────────────────────────

'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Button from '@/components/v1/Button';
import Segment from '@/components/v1/Segment';
import Chip from '@/components/v1/Chip';
import {
  DEFAULT_MORTAR_FORM,
  decodeMortarForm,
  type MortarFormState,
  type MortarUsage,
} from '@/lib/v1/mortarQuery';
import type { MortarProductOption } from '@/lib/v1/mortarProductOptions';
import { useMortarCalc } from '@/lib/v1/useMortarCalc';
import { useMortarQuickCalc } from '@/lib/v1/useMortarQuickCalc';
import { formatManRange, formatNum } from '@/lib/v1/money';
import { sanitizeMortarFormState } from '@/lib/v1/mortarEngineInput';
import { USAGE_PRESET, USAGE_ORDER, SELF_LEVEL_USAGE_PRESET } from '@/lib/v1/mortarPresets';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import ResultPanel from './ResultPanel';

interface MortarCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: MortarProductOption[];
}

/** 화면 모드 세그먼트 옵션 */
const VIEW_OPTIONS = [
  { value: 'simple' as const, label: '간단하게 계산하기' },
  { value: 'precise' as const, label: '정확하게 계산하기' },
];

/**
 * 용도 칩 한 줄에 쓰는 값 — 레미탈 용도 4개 + 셀프레벨링(모드 자체를 대표하는 칩) 1개.
 * 2026-09-15 디자인 통일 지시: 예전엔 [레미탈·몰탈|셀프레벨링] 모드 토글이 용도 칩과
 * 별도 줄이었는데, 셀프레벨링을 이 칩 목록의 다섯 번째 항목으로 흡수했다.
 */
type TopUsage = MortarUsage | '셀프레벨링';
const TOP_USAGE_ORDER: TopUsage[] = [...USAGE_ORDER, '셀프레벨링'];

/** 용도 칩에 보여줄 라벨 */
function topUsageLabel(u: TopUsage): string {
  return u === '셀프레벨링' ? '셀프레벨링' : USAGE_PRESET[u].label;
}

/**
 * "공급 평형 → 전용 ㎡" 규칙을 쓰는 용도인지 — mortarEngineInput.ts의 SUPPLY_AREA_USAGES와
 * 같은 집합이다(화면 쪽은 export된 함수가 없어 여기서 값만 그대로 다시 적는다. 값 자체는
 * 단가가 아니라 "어떤 계산 규칙을 쓰느냐"라 두 번 적어도 어긋날 일이 없다).
 */
function isSupplyUsage(u: MortarUsage): boolean {
  return u === '방통전체' || u === '확장부바닥';
}

export default function MortarCalculator({ products }: MortarCalculatorProps) {
  const searchParams = useSearchParams();

  // 2026-09-15 검사관 지적: 공유 링크(?d=)로 들어온 값을 그대로 초기 상태로 쓰면 화면 입력칸에
  // 비정상 값(예: 1e22 → "1e+22" 지수 표기)이 그대로 찍힐 수 있다 — sanitizeMortarFormState로
  // 한 번 걸러서 화면에 보여줄 안전한 값으로 만든 뒤에만 상태로 쓴다.
  const initial = useMemo<MortarFormState>(
    () => sanitizeMortarFormState(decodeMortarForm(searchParams.get('d')) ?? DEFAULT_MORTAR_FORM),
    [searchParams],
  );

  const [form, setForm] = useState<MortarFormState>(initial);
  const resultRef = useRef<HTMLDivElement>(null);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<MortarFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  const mode = form.mode ?? '레미탈';
  const view = form.view ?? 'simple';
  // 지금 화면에서 선택된 것으로 보이는 용도 칩 — 모드가 셀프레벨링이면 그 칩, 아니면 레미탈 용도
  const currentTopUsage: TopUsage = mode === '셀프레벨링' ? '셀프레벨링' : (form.usage ?? '방통전체');

  /**
   * 용도 칩을 고르는 유일한 통로(도배 setPaperType과 같은 이유 — 모드·용도·두께·제품을
   * 한 번에 정리해야 옛 값이 남아 화면과 계산이 어긋나는 사고를 막는다).
   *
   * 34평 의미 통일(2026-09-15): 방통 전체·확장부 바닥(공급 평형 규칙)과 욕실·현관 구배·
   * 마루 철거 후 보수·셀프레벨링(작업 면적 그 자체) 사이를 넘나들 때는 두 규칙의 "평"이
   * 서로 다른 크기라(34평 = 전용 84㎡ vs 34평 = 순수 112㎡) 이전 면적 값을 그대로 두면
   * 엉뚱한 크기로 계산된다 — 그룹이 바뀔 때만 면적을 비우고 단위를 그 그룹 기본값으로 되돌린다.
   */
  function selectTopUsage(u: TopUsage) {
    const wasSupply = mode !== '셀프레벨링' && isSupplyUsage(form.usage ?? '방통전체');
    const willSupply = u !== '셀프레벨링' && isSupplyUsage(u);
    const crossing = wasSupply !== willSupply;
    const areaReset = crossing
      ? { area: undefined, rectWidth: undefined, rectDepth: undefined, areaUnit: (willSupply ? '평' : '㎡') as '평' | '㎡' }
      : {};

    if (u === '셀프레벨링') {
      const defaultUsage = '마루장판전' as const;
      patch({
        mode: '셀프레벨링',
        usage: undefined,
        selfLevelUsage: defaultUsage,
        thicknessMm: SELF_LEVEL_USAGE_PRESET[defaultUsage].defaultMm,
        productCode: undefined,
        product: undefined,
        method: undefined,
        wireMesh: false,
        ...areaReset,
      });
      return;
    }

    patch({
      mode: '레미탈',
      usage: u,
      selfLevelUsage: undefined,
      thicknessMm: USAGE_PRESET[u].defaultMm,
      productCode: undefined,
      product: undefined,
      method: undefined,
      ...areaReset,
    });
  }

  // 즉답 — 서버 없이 바로 계산되는 포수·체적·현장배합(항상 최신 폼 상태를 즉시 반영)
  const quick = useMortarQuickCalc(form, products);
  // 서버 — 비용·인건(디바운스 + API 호출, 늦게 오거나 실패할 수 있다)
  const { result, range, loading, error, stale } = useMortarCalc(form, products);

  const emptyMessage = view === 'precise' ? '면적을 넣으면 나와요' : '면적과 두께를 넣으면 바로 나와요';

  function scrollToResult() {
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      {/* 2026-09-14 검사관 지적: page.tsx(서버 컴포넌트)에 검색엔진용 진짜 h1을 따로 심어서
          이 자리의 제목 줄과 h1이 겹친다 — as="p"로 그려서 페이지 h1이 1개만 남게 한다.
          모바일 상단바 제목은 짧게 "레미탈 계산기"만(긴 SEO 문구는 page.tsx의 sr-only h1이 맡는다) */}
      <TopNav title="레미탈 계산기" backHref="/calc" as="p" />

      {/* 좌우 여백을 공용 Container(px-5/lg:px-8)와 동일하게 맞춰 헤더 로고와 x축을 일치시킨다 */}
      <div className="px-5 lg:px-8 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          {/* 화면 모드 세그먼트 — 카드 바깥. 캡션 1줄만(설명글 최소화 원칙) */}
          <div className="flex flex-col gap-2">
            <Segment options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} />
            <p className="text-[13px] text-v1-text-secondary">
              {view === 'simple' ? '면적과 용도만으로 바로 나와요' : '실측·배합·제품까지 반영해요'}
            </p>
          </div>

          {/* 용도 — 두께 기본값을 같이 채우고, 셀프레벨링 칩은 모드 자체를 바꾼다.
              2026-09-15 디자인 통일 지시로 예전 [레미탈·몰탈|셀프레벨링] 모드 토글을
              이 칩 한 줄로 합쳤다(첫 화면 토글 4줄 → [간단|정확] + 용도 칩 2줄로 축소). */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[17px] font-bold text-foreground">용도</h2>
            <div className="flex flex-wrap gap-2">
              {TOP_USAGE_ORDER.map((u) => (
                <Chip key={u} selected={currentTopUsage === u} onClick={() => selectTopUsage(u)}>
                  {topUsageLabel(u)}
                </Chip>
              ))}
            </div>
          </div>

          {/* 카드 — 모드에 따라 하나만 그린다. 훅은 이 컴포넌트 한 곳에서만 불러 자식에는
              결과(props)만 내려준다(2026-09-14 검사관 지적 — API 중복 호출 방지) */}
          {view === 'simple' ? (
            <QuickAnswer
              form={form}
              patch={patch}
              quick={quick}
            />
          ) : (
            <PreciseSection
              form={form}
              patch={patch}
              products={products}
              quick={quick}
              result={result}
            />
          )}
        </div>

        {/* 오른쪽 — 결과 */}
        <div
          ref={resultRef}
          className="scroll-mt-16 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto"
        >
          <ResultPanel
            quick={quick}
            result={result}
            range={range}
            loading={loading}
            error={error}
            stale={stale}
            form={form}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>

      {/* 모바일 하단 고정 요약 바 — 포수는 quick(즉시)로, 금액은 서버가 왔을 때만 붙인다 */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-v1-line flex items-center justify-between px-4 lg:hidden z-40">
        {quick ? (
          <span className="text-[16px] font-semibold text-brown tabular-nums">
            {quick.bagKg}kg × {formatNum(quick.bags)}포
            {result && range ? ` · ${formatManRange(range.min, range.max)}` : ''}
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
