// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 오케스트레이터 (클라이언트)
//
// 설계 정본 0-C절 "한 번에 하나" 절충안의 뼈대:
//   상단 즉답(QuickAnswer, 평수만 넣어도 바로 범위) + "정확히 계산하기" 펼침
//   정밀 폼(PreciseSection) + 벽지 선택(PaperPicker) + 결과 패널(ResultPanel).
//   레이아웃은 모바일 세로 1열, PC(lg)는 왼쪽 입력(480~560px 고정) + 오른쪽 결과(sticky).
//
// 이 파일이 폼 상태를 한 곳에서만 들고 있고, 자식은 전부 "값 + 바꾸는 함수"만 받는다
// (자식이 직접 상태를 갖지 않음 — B·C 지시서가 자식 내부를 채울 때 이 계약을 그대로 쓴다).
//
// QuickAnswer·PreciseSection·PaperPicker·ResultPanel은 지금 최소 렌더 뼈대만 있고,
// 실제 UI는 이어지는 지시서(B: 즉답·결과 / C: 정밀 폼)가 채운다.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import {
  DEFAULT_WALLPAPER_FORM,
  decodeWallpaperForm,
  type WallpaperFormState,
  type WallpaperProductOption,
} from '@/lib/v1/wallpaperQuery';
import { useWallpaperCalc } from '@/lib/v1/useWallpaperCalc';
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

  // 공유 링크(?d=...)로 들어온 경우 이전 조건을 복원하고, 없으면 기본값(34평 3베이 실크)
  const initial = useMemo<WallpaperFormState>(
    () => decodeWallpaperForm(searchParams.get('d')) ?? DEFAULT_WALLPAPER_FORM,
    [searchParams],
  );

  // 폼 상태는 이 컴포넌트 한 곳에서만 들고 있는다. 자식은 값과 onChange만 받는다.
  const [form, setForm] = useState<WallpaperFormState>(initial);
  // "정확히 계산하기" 펼침 여부 — 열려 있어도 값이 비어 있으면 훅이 즉답 평수로 계산한다
  const [preciseOpen, setPreciseOpen] = useState(false);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<WallpaperFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  const { result, range, loading, error, stale } = useWallpaperCalc(form, products);

  return (
    <>
      <TopNav title="도배 계산기" backHref="/v1" />

      {/* 모바일: 세로 1열. PC(lg): 왼쪽 입력 480~560px 고정 + 오른쪽 결과 */}
      <div className="px-4 py-4 pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력 */}
        <div className="flex flex-col gap-6">
          <QuickAnswer
            pyeong={form.pyeong ?? ''}
            onPyeongChange={(v) => patch({ pyeong: v === '' ? undefined : v })}
            bay={form.bay ?? 3}
            onBayChange={(v) => patch({ bay: v })}
            range={range}
            loading={loading}
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
          />

          <PaperPicker
            paperType={form.paperType}
            onPaperTypeChange={(v) => patch({ paperType: v })}
            productCode={form.productCode}
            onProductCodeChange={(v) => patch({ productCode: v })}
            products={products}
          />
        </div>

        {/* 오른쪽 — 결과. PC는 스크롤해도 따라오게 sticky */}
        <div className="lg:sticky lg:top-4">
          <ResultPanel result={result} range={range} loading={loading} error={error} stale={stale} />
        </div>
      </div>
    </>
  );
}
