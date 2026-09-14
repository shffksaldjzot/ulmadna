// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: 결과 패널 (도배·바닥재 ResultPanel.tsx를 그대로 본떠 만듦)
// 물량 먼저, 비용 다음. PC에서는 입력 오른쪽에 sticky로 붙는다.
//
// 도배·바닥재와 다른 점: 큰 숫자가 "N포"이고, 레미탈 모드에서는 그 아래 현장 배합
// (시멘트+모래) 대안이 참고용으로 붙는다. 인건은 품수만 보여주고 인건비 산식은 안 보여준다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Button from '@/components/v1/Button';
import Disclaimer from '@/components/v1/Disclaimer';
import Toast, { showToast } from '@/components/v1/Toast';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { type MortarFormState, encodeMortarForm } from '@/lib/v1/mortarQuery';
import { trimFormForShare } from '@/lib/v1/mortarEngineInput';
import type { MortarCalcResultDTO, MortarCostLine, MortarRange } from '@/lib/v1/useMortarCalc';

export interface ResultPanelProps {
  result: MortarCalcResultDTO | null;
  range: MortarRange | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  form: MortarFormState;
  emptyMessage: string;
}

/** 원 단위로 보여줘도 되는 단위 — 정수로 세는 항목만(도배·바닥재와 같은 규칙) */
const COUNT_UNITS = new Set(['포', '통', '개', '㎡']);

/** 비용 구성 한 줄을 "13포 × 0.7만 = 9만" 또는 범위 문자열로 만든다 */
function formatCostLineAmount(line: MortarCostLine): string {
  if (line.key === 'overhead') {
    return line.unitPriceMin === line.unitPriceMax
      ? `${line.unitPriceMin}%`
      : `${line.unitPriceMin}~${line.unitPriceMax}%`;
  }
  if (line.unitPriceMin === line.unitPriceMax) {
    if (COUNT_UNITS.has(line.unit) && line.amountMin < 100000) {
      return `${formatNum(line.qty)}${line.unit} × ${formatNum(line.unitPriceMin)}원 = ${formatNum(line.amountMin)}원`;
    }
    const manPrice = toMan(line.unitPriceMin);
    const manAmount = toMan(line.amountMin);
    if (manPrice === 0) {
      return manAmount === 0 ? '1만 미만' : `${manAmount}만`;
    }
    return `${formatNum(line.qty)}${line.unit} × ${manPrice}만 = ${manAmount}만`;
  }
  return formatManRange(line.amountMin, line.amountMax);
}

export default function ResultPanel({ result, range, loading, error, stale, form, emptyMessage }: ResultPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  if (!result) {
    return (
      <Card>
        <p className="text-[16px] text-v1-text-secondary">{error ? '계산에 실패했어요' : emptyMessage}</p>
      </Card>
    );
  }

  const { quantity, submaterials, labor, cost } = result;
  const bigRange = range ?? { min: cost.min, max: cost.max };
  const dim = loading || stale || !!error;

  async function handleShare() {
    const url = `${window.location.origin}/calc/mortar/result?d=${encodeMortarForm(trimFormForShare(form))}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: '얼마드나 레미탈 계산 결과', url });
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
      {error && <p className="text-[14px] text-danger mb-2">마지막 계산에 실패해 이전 값이에요</p>}
      <div className={`flex flex-col gap-4 transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
        {/* 카드 1 — 물량 */}
        <Card>
          <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
            {formatNum(quantity.bags)}포
          </div>
          <p className="text-[16px] text-foreground leading-[1.6] tabular-nums">
            {result.mode} {quantity.thicknessMm}mm · 면적 {formatNum(quantity.areaSqm)}㎡ · 몰탈 {quantity.volumeWithLossM3}㎥
            · 로스 {quantity.lossPct}% 포함
            {quantity.usageLabel ? ` · ${quantity.usageLabel}` : ''}
          </p>
          {/* 레미탈은 품수(공법 표시 포함), 셀프레벨링은 "시공비는 현장 견적 별도" 안내로 대체한다
              (2026-09-14 검사관 지적 — 근거 없는 셀프레벨링 인건 단가를 지어내지 않는다) */}
          {labor ? (
            <p className="text-[14px] text-v1-text-disabled tabular-nums">
              {labor.method === '장비타설' ? '장비 타설' : '손미장(추정)'} {labor.manDaysTotal}품 · 2인 1조 약 {labor.teamDays}일
            </p>
          ) : (
            result.laborAdvisoryNote && <p className="text-[14px] text-v1-text-disabled">{result.laborAdvisoryNote}</p>
          )}
          {result.equipmentNote && <p className="text-[14px] text-v1-text-disabled">{result.equipmentNote}</p>}

          {quantity.altMix && (
            <Collapsible title="현장 배합 대안">
              <p className="text-[16px] text-foreground py-2 tabular-nums">
                시멘트 {formatNum(quantity.altMix.cementBags)}포(40kg) + 모래 {quantity.altMix.sandM3}㎥
              </p>
              <p className="text-[14px] text-v1-text-disabled">배합비 {quantity.altMix.mixRatio} · 참고용, 비용에는 안 넣었어요</p>
            </Collapsible>
          )}

          {quantity.byRoom.length > 1 && (
            <Collapsible title="구역별 보기">
              <div className="flex flex-col">
                {quantity.byRoom.map((r, i) => (
                  <div
                    key={r.key}
                    className={`h-11 flex items-center justify-between ${
                      i === quantity.byRoom.length - 1 ? '' : 'border-b border-v1-line-2'
                    }`}
                  >
                    <span className="text-[16px] text-foreground">{r.name}</span>
                    <span className="text-[16px] text-v1-text-secondary tabular-nums">
                      {formatNum(r.bags)}포{' '}
                      <span className="text-[14px] text-v1-text-disabled">{formatNum(r.areaSqm)}㎡</span>
                    </span>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}
        </Card>

        {/* 카드 2 — 부자재 (와이어메시·프라이머 옵션을 켰을 때만) */}
        {submaterials.length > 0 && (
          <Card>
            <h2 className="text-[20px] font-bold text-foreground">부자재</h2>
            <div className="flex flex-col">
              {submaterials.map((s, i) => (
                <div key={s.key} className={`py-[10px] ${i === submaterials.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] text-foreground">{s.name}</span>
                    <span className="text-[16px] text-foreground tabular-nums">
                      {formatNum(s.qty)}
                      {s.unit}
                    </span>
                  </div>
                  <p className="text-[14px] text-v1-text-disabled tabular-nums">
                    {s.basis}
                    {s.grade === 'C' && !s.basis.includes('추정') ? ' · 추정' : ''}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 카드 3 — 비용 */}
        <Card>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
              {formatManRange(bigRange.min, bigRange.max)}
            </div>
            {cost.mode === '산식' && (
              <span className="text-[14px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
                추정
              </span>
            )}
          </div>
          <p className="text-[16px] font-semibold text-v1-text-secondary tabular-nums">
            중간 {toMan(cost.mid).toLocaleString('ko-KR')}만원
          </p>
          <p className="text-[16px] text-foreground tabular-nums">{cost.basisLine}</p>
          <Collapsible title="구성 보기" defaultOpen>
            <div className="flex flex-col">
              {cost.breakdown.map((line, i) => (
                <div key={line.key} className={`py-[10px] ${i === cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[16px] text-foreground min-w-0 truncate">{line.name}</span>
                    <span className="text-[16px] text-foreground tabular-nums whitespace-nowrap flex-none">
                      {formatCostLineAmount(line)}
                    </span>
                  </div>
                  <p className="text-[14px] text-v1-text-disabled tabular-nums">{line.note}</p>
                </div>
              ))}
              <p className="text-[14px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
            </div>
          </Collapsible>
        </Card>

        <Button variant="secondary" fullWidth onClick={handleShare}>
          결과 공유
        </Button>

        <Disclaimer />
      </div>
      <Toast message={toast} />
    </>
  );
}
