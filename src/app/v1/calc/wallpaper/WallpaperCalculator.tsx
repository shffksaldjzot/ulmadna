// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 오케스트레이터 (클라이언트)
//
// 설계 정본 0-C절 "한 번에 하나" 절충안의 뼈대:
//   상단 즉답(QuickAnswer, 평수만 넣어도 바로 범위) + "정확히 계산하기" 펼침
//   정밀 폼(PreciseSection) + 벽지 선택(PaperPicker) + 결과 패널(ResultPanel).
//   레이아웃은 모바일 세로 1열, PC(lg)는 왼쪽 입력(480~560px 고정) + 오른쪽 결과(sticky).
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다
// (자식이 직접 상태를 갖지 않는다).
//
// QuickAnswer·PreciseSection·PaperPicker·ResultPanel 전부 채워졌고, 이 파일이 배선까지 마쳤다.
//
// 작성일: 2026년 09월 08일
// 2026년 09월 09일: B·C 지시서 완료 배선(lengthOpenings·product 포함)
// ──────────────────────────────────────────────

'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Button from '@/components/v1/Button';
import {
  DEFAULT_CALC_FORM,
  decodeWallpaperForm,
  type WallpaperFormState,
  type WallpaperProductOption,
} from '@/lib/v1/wallpaperQuery';
import { useWallpaperCalc } from '@/lib/v1/useWallpaperCalc';
import { describePreciseInput } from '@/lib/v1/wallpaperEngineInput';
import { formatManRange, formatNum } from '@/lib/v1/money';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import PaperPicker from './PaperPicker';
import ResultPanel from './ResultPanel';

interface WallpaperCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: WallpaperProductOption[];
}

export default function WallpaperCalculator({ products }: WallpaperCalculatorProps) {
  const searchParams = useSearchParams();

  // 공유 링크(?d=...)로 들어온 경우 이전 조건을 복원하고, 없으면 즉답 기본값(34평 3베이, 벽지 미선택)
  const initial = useMemo<WallpaperFormState>(
    () => decodeWallpaperForm(searchParams.get('d')) ?? DEFAULT_CALC_FORM,
    [searchParams],
  );

  // 폼 상태는 이 컴포넌트 한 곳에서만 들고 있는다. 자식은 값과 onChange만 받는다.
  const [form, setForm] = useState<WallpaperFormState>(initial);
  // "정확히 계산하기" 펼침 여부 — 열려 있어도 값이 비어 있으면 훅이 즉답 평수로 계산한다
  const [preciseOpen, setPreciseOpen] = useState(false);
  // 모바일 하단 고정 요약 바의 "결과 보기"가 스크롤해서 이동할 대상
  const resultRef = useRef<HTMLDivElement>(null);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<WallpaperFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  /**
   * 벽지 종류가 바뀌는 유일한 통로. 종류만 바꾸고 이전에 고른 제품(productCode·product)을
   * 안 지우면 화면엔 새 종류가 선택된 것처럼 보여도 계산은 옛 제품 규격·가격으로 되는
   * 치명 버그였다(검사관 지적 1번). QuickAnswer·PaperPicker 둘 다 이 함수 하나만 쓴다.
   */
  function setPaperType(v: '합지' | '실크' | undefined) {
    patch({ paperType: v, productCode: undefined, product: undefined });
  }

  const { result, range, loading, error, stale } = useWallpaperCalc(form, products);

  // 정밀 폼(방별 실측 또는 벽 길이)이 지금 유효한지 하나로 판정한다. 유효하면 평형·베이
  // 칩을 잠근다(정밀 폼이 우선이라 눌러도 소용없는 죽은 버튼이 되기 때문 — 검사관 지적 N2).
  // QuickAnswer·PreciseSection·result 요약줄이 전부 이 함수 하나로 판정해 어긋나지 않는다.
  const precise = describePreciseInput(form);

  /** 모바일 하단 요약 바 "결과 보기" — 결과 패널로 부드럽게 스크롤 */
  function scrollToResult() {
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <TopNav title="도배 계산기" backHref="/v1" />

      {/* 모바일: 세로 1열(QuickAnswer→PreciseSection→PaperPicker→ResultPanel), 하단 고정 요약 바만큼 pb-20으로 여백.
          PC(lg): 왼쪽 입력 480~560px 고정 + 오른쪽 결과 sticky */}
      <div className="px-4 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          <QuickAnswer
            pyeong={form.pyeong ?? ''}
            onPyeongChange={(v) => patch({ pyeong: v === '' ? undefined : v })}
            bay={form.bay ?? 3}
            onBayChange={(v) => patch({ bay: v })}
            range={range}
            loading={loading}
            error={error}
            stale={stale}
            target={form.target === 'wall' ? 'wall' : 'both'}
            onTargetChange={(v) => patch({ target: v })}
            paperType={form.paperType}
            onPaperTypeChange={setPaperType}
            region={form.region}
            onRegionChange={(v) => patch({ region: v })}
            isOld={form.isOld ?? false}
            onIsOldChange={(v) => patch({ isOld: v })}
            result={result}
            precise={precise}
          />

          <PreciseSection
            open={preciseOpen}
            onToggleOpen={() => setPreciseOpen((v) => !v)}
            entry={form.entry ?? 'room'}
            onEntryChange={(v) => patch({ entry: v })}
            unit={form.unit ?? 'm'}
            onUnitChange={(v) => patch({ unit: v })}
            target={form.target ?? 'both'}
            onTargetChange={(v) => patch({ target: v })}
            heightM={form.heightM ?? ''}
            onHeightChange={(v) => patch({ heightM: v === '' ? undefined : v })}
            rooms={form.preciseRooms ?? []}
            onRoomsChange={(v) => patch({ preciseRooms: v })}
            wallLength={form.wallLength ?? ''}
            onWallLengthChange={(v) => patch({ wallLength: v === '' ? undefined : v })}
            directCeilingSqm={form.directCeilingSqm ?? ''}
            onDirectCeilingSqmChange={(v) => patch({ directCeilingSqm: v === '' ? undefined : v })}
            region={form.region}
            onRegionChange={(v) => patch({ region: v })}
            // 벽 길이 모드에서 빼는 문·창 목록 — 훅(toEngineInput)이 면적으로 환산해 벽 면적에서 뺀다
            lengthOpenings={form.lengthOpenings ?? []}
            onLengthOpeningsChange={(v) => patch({ lengthOpenings: v })}
          />

          <PaperPicker
            paperType={form.paperType}
            onPaperTypeChange={setPaperType}
            productCode={form.productCode}
            onProductCodeChange={(v) => patch({ productCode: v })}
            products={products}
            // 목록에 없는 벽지를 직접 입력(롤당 가격·폭·길이·무늬 반복)
            product={form.product}
            onProductChange={(v) => patch({ product: v })}
          />
        </div>

        {/* 오른쪽 — 결과. PC는 스크롤해도 따라오게 sticky, 화면보다 길면 패널 안에서만 스크롤.
            scroll-mt-16: "결과 보기"로 스크롤했을 때 위 고정 내비(TopNav)에 안 가리게 여유를 둔다.
            lg:top-[81px]: PC 전역 헤더(TopNav 64px≈65px) + 여백 16px만큼 내려서 붙인다(검사관 지적 N5,
            전에 top-4=16px로만 둬서 패널 윗부분이 헤더에 가렸다). max-h도 그만큼 빼서 화면 밖으로 안 넘친다 */}
        <div
          ref={resultRef}
          className="scroll-mt-16 lg:sticky lg:top-[81px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto"
        >
          <ResultPanel
            result={result}
            range={range}
            loading={loading}
            error={error}
            stale={stale}
            form={form}
            products={products}
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
          <span />
        )}
        <Button variant="primary" className="!h-9 !px-4 !text-[14px]" onClick={scrollToResult}>
          결과 보기
        </Button>
      </div>
    </>
  );
}
