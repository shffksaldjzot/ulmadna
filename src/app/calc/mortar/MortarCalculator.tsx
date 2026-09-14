// ──────────────────────────────────────────────
// v1 허브 — 미장(레미탈·셀프레벨링) 계산기 오케스트레이터 (클라이언트)
// 도배·바닥재 Calculator.tsx를 그대로 본떠 만들었다.
//
//   맨 위 [레미탈·몰탈 | 셀프레벨링] 모드 토글(URL 쿼리 유지).
//   그 아래 [간단하게 계산하기 | 정확하게 계산하기] 세그먼트 + 캡션 1줄.
//   카드 1(모드에 따라 QuickAnswer 또는 PreciseSection 중 하나만) — 면적·두께·옵션.
//   오른쪽(PC)·아래(모바일)에 결과 패널, 모바일엔 하단 고정 요약 바.
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Button from '@/components/v1/Button';
import Segment from '@/components/v1/Segment';
import {
  DEFAULT_MORTAR_FORM,
  decodeMortarForm,
  type MortarFormState,
  type MortarMode,
} from '@/lib/v1/mortarQuery';
import type { MortarProductOption } from '@/lib/v1/mortarProductOptions';
import { useMortarCalc } from '@/lib/v1/useMortarCalc';
import { formatManRange, formatNum } from '@/lib/v1/money';
import { sanitizeMortarFormState } from '@/lib/v1/mortarEngineInput';
import { USAGE_PRESET, SELF_LEVEL_USAGE_PRESET } from '@/lib/v1/mortarPresets';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import ResultPanel from './ResultPanel';

interface MortarCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: MortarProductOption[];
}

/** 모드 토글 옵션 — 값은 폼 상태 mode와 그대로 맞춘다 */
const MODE_OPTIONS = [
  { value: '레미탈' as const, label: '레미탈·몰탈' },
  { value: '셀프레벨링' as const, label: '셀프레벨링' },
];

/** 화면 모드 세그먼트 옵션 */
const VIEW_OPTIONS = [
  { value: 'simple' as const, label: '간단하게 계산하기' },
  { value: 'precise' as const, label: '정확하게 계산하기' },
];

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

  /**
   * 모드(레미탈/셀프레벨링)가 바뀌는 유일한 통로. 모드만 바꾸고 이전에 고른 제품·용도를
   * 안 지우면 화면엔 새 모드가 선택된 것처럼 보여도 계산은 옛 제품 규격으로 되는 버그가
   * 된다(도배 setPaperType과 같은 이유).
   */
  function setMode(v: MortarMode) {
    patch({
      mode: v,
      productCode: undefined,
      product: undefined,
      // 두께는 모드별 대표 용도 기본값으로 다시 채운다 — 하드코딩하지 않고 프리셋 표
      // (mortarPresets.ts)에서 그대로 읽는다(2026-09-15 검사관 지적: 값이 두 곳에 있으면
      // 한쪽만 고쳤을 때 어긋난다).
      thicknessMm: v === '레미탈' ? USAGE_PRESET['방통전체'].defaultMm : SELF_LEVEL_USAGE_PRESET['마루장판전'].defaultMm,
      usage: v === '레미탈' ? '방통전체' : undefined,
      selfLevelUsage: v === '셀프레벨링' ? '마루장판전' : undefined,
      wireMesh: false,
    });
  }

  const mode = form.mode ?? '레미탈';
  const view = form.view ?? 'simple';
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

      <div className="px-4 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          {/* 모드 토글 — 레미탈·몰탈 / 셀프레벨링. 화면 맨 위 + 캡션 1줄(설명글 최소화 원칙) */}
          <div className="flex flex-col gap-2">
            <Segment options={MODE_OPTIONS} value={mode} onChange={setMode} />
            <p className="text-[14px] text-v1-text-secondary">
              {mode === '레미탈' ? '시멘트 기반 몰탈, 흙손으로 바르거나 펌프로 타설해요' : '부어서 저절로 평평해지는 수평몰탈이에요'}
            </p>
          </div>

          {/* 화면 모드 세그먼트 — 카드 바깥. 캡션 1줄만(설명글 최소화 원칙) */}
          <div className="flex flex-col gap-2">
            <Segment options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} />
            <p className="text-[14px] text-v1-text-secondary">
              {view === 'simple' ? '면적과 용도만으로 바로 나와요' : '실측·배합·제품까지 반영해요'}
            </p>
          </div>

          {/* 카드 — 모드에 따라 하나만 그린다. 훅은 이 컴포넌트 한 곳에서만 불러 자식에는
              결과(props)만 내려준다(2026-09-14 검사관 지적 — API 중복 호출 방지) */}
          {view === 'simple' ? (
            <QuickAnswer
              form={form}
              patch={patch}
              result={result}
              range={range}
              loading={loading}
              error={error}
              stale={stale}
            />
          ) : (
            <PreciseSection
              form={form}
              patch={patch}
              products={products}
              result={result}
              range={range}
              loading={loading}
              error={error}
              stale={stale}
            />
          )}
        </div>

        {/* 오른쪽 — 결과 */}
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
          />
        </div>
      </div>

      {/* 모바일 하단 고정 요약 바 */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-v1-line flex items-center justify-between px-4 lg:hidden z-40">
        {result && range ? (
          <span className="text-[16px] font-semibold text-brown tabular-nums">
            {formatNum(result.quantity.bags)}포 · {formatManRange(range.min, range.max)}
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
