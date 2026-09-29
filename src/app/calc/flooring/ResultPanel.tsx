// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 결과 패널
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9장 — 도배 ResultPanel.tsx(1차 작업)가 이미
// 적용한 순서·규칙을 그대로 옮겨 왔다(3-13절):
//   1. 금액 범위(가장 큰 숫자) + "추정" 표시 + 중간값 한 줄
//   2. 수량 한 줄 — 제품 미정(assumed에 'product')이면 수량도 범위로 보여준다(unitsRange)
//   3. 면적·가정 한 줄(있을 때만) — "34평 · 84㎡ · 제품 미정" 또는 "34평 가정 · 제품 미정" 등
//   4. 기준 줄
//   5. 실별 보기(접힘) · 부자재 · 구성 보기(접힘)
//   6. 공유·문의
//
// 공유 버튼 규칙(도배와 같음): 3단계(자재·제품·면적)가 전부 완료됐고, 'area'·'measuring'
// 가정이 안 남아 있을 때만 보인다. 베이·범위 조정 칩과 "제품 미정"은 공유를 막지 않는다.
//
// 만 원 미만 구성 항목 표기는 공용 costLineFormat.ts(원래 도배 전용이었으나 9장 작업으로
// _components/로 옮김)를 그대로 쓴다 — "× 0만" 같은 문구가 안 남게 원 단위로 보여준다.
//
// 작성일: 2026년 09월 10일
// 카드 통합 + 빈 상태 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// 결과 카드 순서 재배치 + 좁혀가기 연동(도배 방식 이식): 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Toggle from '@/components/v1/Toggle';
import Button from '@/components/v1/Button';
import Disclaimer from '@/components/v1/Disclaimer';
import Toast, { showToast } from '@/components/v1/Toast';
import CalcContactCta from '../_components/CalcContactCta';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { type FlooringFormState, encodeFlooringForm } from '@/lib/v1/flooringQuery';
import { trimFormForShare, describeAreaPair, type FlooringAssumption } from '@/lib/v1/flooringEngineInput';
import type { FlooringCalcResultDTO, FlooringRange } from '@/lib/v1/useFlooringCalc';
import { describeFlooringAreaAssumptionLine } from '../_components/assumptionText';
import { formatCostLineAmount, formatUnitsRangeText } from '../_components/costLineFormat';
import { dimTransitionStyle } from '../_components/dimTransition';
// GA4 — 결과 노출/구성 보기 펼침/공유 버튼 클릭 이벤트
import { track } from '@/lib/analytics';

export interface ResultPanelProps {
  /** 마지막 성공 결과 (물량·부자재·비용 구성 전부 포함) */
  result: FlooringCalcResultDTO | null;
  /** 결과 화면 큰 숫자에 쓰는 금액 범위(= result.cost.min~max) */
  range: FlooringRange | null;
  loading: boolean;
  error: string | null;
  /** true면 지금 보이는 값이 최신 입력 이전 값이라는 뜻(깜빡임 방지용 표시) */
  stale: boolean;
  /** 지금 보이는 result가 어떤 값을 가정해서 계산됐는지 */
  assumed: FlooringAssumption[];
  /** 3단계(자재·제품·면적/실측)가 전부 "손대서" 끝났는지 — 공유 버튼 노출 판정에 쓴다 */
  allDone: boolean;
  /** "결과 공유" 버튼이 링크를 만들 때 쓰는 현재 폼 상태 */
  form: FlooringFormState;
  /** 구성 보기의 "기존 바닥재 철거" 토글 */
  onRemoveOldChange: (v: boolean) => void;
  /** 구성 보기의 "걸레받이 교체" 토글 */
  onBaseboardChange: (v: boolean) => void;
}

export default function ResultPanel({
  result,
  range,
  loading,
  error,
  stale,
  assumed,
  allDone,
  form,
  onRemoveOldChange,
  onBaseboardChange,
}: ResultPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  // GA4 — 결과 카드가 실제로 화면에 보였을 때(result가 새로 생길 때마다) 1번 기록
  useEffect(() => {
    if (result) track('calc_result_view', { process: 'flooring' });
  }, [result]);

  // 3-13절: 첫 단계(자재)를 고르기 전에는 통째로 안 그린다. 자재는 골랐는데 계산 자체가
  // 실패했으면(드묾) 짧은 실패 문구만 보여준다.
  if (!result) {
    if (error) return <p className="t-body text-ink">계산에 실패했어요</p>;
    return null;
  }

  const { quantity, submaterials, cost } = result;
  const unitLabel = quantity.unit === '박스' ? '박스' : 'm';

  // 큰 숫자는 훅이 계산해 준 범위(범위가 없으면 이 결과 자체의 min~max)를 쓴다.
  const bigRange = range ?? { min: cost.min, max: cost.max };

  // 로딩 중이거나 이전 값을 보여주는 중이거나, 방금 계산이 실패해 예전 값을 그대로 보여주는
  // 중이면 카드 전체를 옅게 한다(도배와 같은 깜빡임 방지 규칙)
  const dim = loading || stale || !!error;

  // 간단(평형/㎡) 모드일 때만 "34평 · 84㎡" 병기가 뜻이 있다
  const areaPairText = quantity.inputMode === '평형' ? describeAreaPair(form) : null;
  const areaAssumptionLine = describeFlooringAreaAssumptionLine(areaPairText, assumed);

  // 도배와 같은 규칙: 공유는 3단계가 전부 끝났고, 'area'·'measuring' 가정이 안 남아
  // 있을 때만 보인다. 베이·범위 조정 칩과 "제품 미정"은 공유를 막지 않는다.
  const canShare = allDone && !assumed.includes('area') && !assumed.includes('measuring');

  /** "결과 공유" — 모바일은 공유 시트가 있으면 그것부터, 아니면 링크 복사 */
  async function handleShare() {
    track('calc_cta_click', { process: 'flooring', target: 'share' });
    const url = `${window.location.origin}/calc/flooring/result?d=${encodeFlooringForm(trimFormForShare(form))}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: '얼마드나 바닥재 계산 결과', url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(setToast, '링크를 복사했어요');
    } catch {
      showToast(setToast, '복사에 실패했어요');
    }
  }

  return (
    <>
      {error && <p className="text-[13px] text-danger mb-2">마지막 계산에 실패해 이전 값이에요</p>}
      {/* 2026-09-29 지적 3번: 흐려질 땐 즉시, 또렷해질 때만 150ms(dimTransitionStyle) */}
      <Card className={`transition-opacity ${dim ? 'opacity-60' : ''}`} style={dimTransitionStyle(dim)}>
        {/* 1. 금액 범위 + 중간값 + "추정" 표시 */}
        <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
          {formatManRange(bigRange.min, bigRange.max)}
        </div>
        <p className="t-body font-semibold text-ink-2 tabular-nums flex items-center gap-2">
          중간 {toMan(cost.mid).toLocaleString('ko-KR')}만원
          {cost.mode === '산식' && (
            <span className="text-[13px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
              추정
            </span>
          )}
        </p>

        {/* 2. 수량 한 줄 — 제품 미정이면 범위로("19~46박스"), 최소=최대면 하나만.
            2026-09-27 저녁 지휘관 3차 검수 지적 8번: 면적은 정수로("68.1㎡" → "68㎡"),
            장 수 앞의 "총"은 뺀다("총 816장" → "816장"). */}
        <p className="t-body text-ink tabular-nums pt-2 border-t border-v1-line-2 flex flex-wrap gap-x-1">
          {[
            formatUnitsRangeText(quantity.units, quantity.unitsRange, unitLabel),
            `바닥 ${Math.round(quantity.floorSqm)}㎡`,
            ...(quantity.pieces != null ? [`${formatNum(quantity.pieces)}장`] : []),
          ].map((chunk, i, arr) => (
            <span key={i} className="whitespace-nowrap">
              {chunk}
              {i < arr.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>
        {/* 3. 면적·가정 한 줄 */}
        {areaAssumptionLine && <p className="t-sub text-ink-2 tabular-nums">{areaAssumptionLine}</p>}

        {/* 4. 기준 줄 */}
        <p className="t-body text-ink tabular-nums">{cost.basisLine}</p>

        <Collapsible title="실별 보기">
          <div className="flex flex-col">
            {quantity.byRoom.map((r, i) => (
              <div
                key={r.key}
                className={`h-11 flex items-center justify-between ${
                  i === quantity.byRoom.length - 1 ? '' : 'border-b border-v1-line-2'
                }`}
              >
                <span className="text-[15px] text-foreground">{r.name}</span>
                <span className="text-[15px] text-v1-text-secondary tabular-nums">
                  {formatNum(r.units)}
                  {unitLabel}{' '}
                  <span className="text-[13px] text-v1-text-disabled">{formatNum(r.floorSqm)}㎡</span>
                </span>
              </div>
            ))}
          </div>
        </Collapsible>

        {/* 5. 부자재 */}
        <h2 className="text-[17px] font-bold text-foreground border-t border-v1-line-2 pt-3 mt-1">부자재</h2>
        <div className="flex flex-col">
          {submaterials.map((s, i) => (
            <div key={s.key} className={`py-[10px] ${i === submaterials.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-foreground">{s.name}</span>
                <span className="text-[15px] text-foreground tabular-nums">
                  {formatNum(s.qty)}
                  {s.unit}
                </span>
              </div>
              <p className="text-[13px] text-v1-text-disabled tabular-nums">
                {s.basis}
                {s.grade === 'C' && !s.basis.includes('추정') ? ' · 추정' : ''}
              </p>
            </div>
          ))}
        </div>

        {/* 구성 보기 — 기본으로 전부 펼쳐 보여준다. 견적은 전부 구축 기준이라 맨 위에
            토글 2개(기존 바닥재 철거 · 걸레받이 교체)를 두고 사용자가 보고 판단한다. */}
        <Collapsible title="구성 보기" defaultOpen onOpen={() => track('calc_detail_open', { process: 'flooring' })}>
          <div className="flex flex-col">
            <div className="py-[10px] border-b border-v1-line-2 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-[2px] min-w-0">
                <span className="text-[15px] text-foreground">기존 바닥재 철거</span>
                <span className="text-[13px] text-v1-text-disabled">구축 기준 견적 · 끄면 철거비를 뺍니다</span>
              </div>
              <Toggle
                checked={form.removeOld ?? true}
                onChange={onRemoveOldChange}
                label="기존 바닥재 철거 포함"
                className="flex-none"
              />
            </div>
            <div className="py-[10px] border-b border-v1-line-2 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-[2px] min-w-0">
                <span className="text-[15px] text-foreground">걸레받이 교체</span>
                <span className="text-[13px] text-v1-text-disabled">끄면 걸레받이 비용을 뺍니다</span>
              </div>
              <Toggle
                checked={form.baseboard ?? true}
                onChange={onBaseboardChange}
                label="걸레받이 교체 포함"
                className="flex-none"
              />
            </div>
            {cost.breakdown.map((line, i) => (
              <div key={line.key} className={`py-[10px] ${i === cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] text-foreground min-w-0 truncate">{line.name}</span>
                  <span className="text-[15px] text-foreground tabular-nums whitespace-nowrap flex-none">
                    {formatCostLineAmount(line)}
                  </span>
                </div>
                <p className="text-[13px] text-v1-text-disabled tabular-nums">{line.note}</p>
              </div>
            ))}
            <p className="text-[13px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
          </div>
        </Collapsible>
      </Card>

      {/* 6. 공유·문의 — 가정값이 남아 있으면(3단계를 다 안 끝냈으면) 공유는 숨긴다 */}
      <div className="flex flex-col gap-4 mt-4">
        {canShare && (
          <Button variant="secondary" fullWidth onClick={handleShare}>
            결과 공유
          </Button>
        )}
        <CalcContactCta />
        <Disclaimer />
      </div>
      <Toast message={toast} />
    </>
  );
}
