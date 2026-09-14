// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: 결과 패널 (도배·바닥재 ResultPanel.tsx를 그대로 본떠 만듦)
// 물량 먼저, 비용 다음. PC에서는 입력 오른쪽에 sticky로 붙는다.
//
// 도배·바닥재와 다른 점: 큰 숫자가 "레미탈 40kg × N포"이고, 레미탈 모드에서는 그 아래
// 현장 배합(시멘트+모래) 대안이 참고용으로 붙는다. 인건은 품수만 보여주고 산식은 안 보여준다.
//
// 2026-09-15 형아 피드백(포수가 안 보이는 문제):
//   물량 카드(카드 1)는 이제 서버 응답(result)을 기다리지 않고 quick(클라이언트 즉시 계산)
//   으로 항상 그린다 — 서버가 늦거나 실패해도 포수·체적·현장배합은 그대로 남는다.
//   부자재(카드 2)·비용(카드 3)만 서버 응답이 필요하다. 응답이 실패하면 비용 칸에
//   "비용은 잠시 후 다시" 캡션 1줄만 보여준다(포수는 안 지운다).
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(형아 피드백 2라운드)
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
import type { MortarQuickResult } from '@/lib/v1/useMortarQuickCalc';

export interface ResultPanelProps {
  /** 즉시 계산 결과(서버 응답 없이도 항상 있음) — 물량 카드는 전부 여기서 가져온다 */
  quick: MortarQuickResult | null;
  /** 서버 계산 결과(부자재·비용·인건). 늦게 오거나 없을 수 있다 */
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

export default function ResultPanel({ quick, result, range, loading, error, stale, form, emptyMessage }: ResultPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  // quick조차 없으면(면적·두께 미입력) 보여줄 물량이 아예 없다 — 빈 상태 카드 한 장만
  if (!quick) {
    return (
      <Card>
        <p className="text-[16px] text-v1-text-secondary">{emptyMessage}</p>
      </Card>
    );
  }

  const dim = loading || stale;

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

  const submaterials = result?.submaterials ?? [];
  const labor = result?.labor ?? null;

  return (
    <>
      {error && <p className="text-[14px] text-danger mb-2">비용 계산에 실패했어요 — 포수·체적은 그대로예요</p>}
      <div className="flex flex-col gap-4">
        {/* 카드 1 — 물량. quick(즉시 계산)로 항상 그린다 — 서버 응답을 기다리지 않는다 */}
        <Card>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-[20px] font-semibold text-foreground whitespace-nowrap">
              {quick.mode} {quick.bagKg}kg ×
            </span>
            <span className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
              {formatNum(quick.bags)}
            </span>
            <span className="text-[20px] font-semibold text-foreground">포</span>
          </div>
          <p className="text-[16px] text-foreground">{quick.productLabel}</p>
          <p className="text-[14px] text-v1-text-disabled tabular-nums">
            주문 수량: {formatNum(quick.bags)}포(로스 {quick.lossPct}% 포함)
          </p>
          <p className="text-[16px] text-foreground leading-[1.6] tabular-nums">
            {quick.thicknessMm}mm · 면적 {formatNum(quick.areaSqm)}㎡ · 몰탈 {quick.volumeWithLossM3}㎥
          </p>
          {quick.standardRangeNote && <p className="text-[14px] text-v1-text-secondary">{quick.standardRangeNote}</p>}

          {/* 인건 품수는 서버 응답(labor)이 와야 나온다. 안내 문구(장비비·시공비 별도)는
              quick에서 바로 나온다 — 서버가 늦어도 먼저 보여준다 */}
          {labor ? (
            <p className="text-[14px] text-v1-text-disabled tabular-nums">
              {labor.method === '장비타설' ? '장비 타설' : '손미장(추정)'} {labor.manDaysTotal}품 · 2인 1조 약 {labor.teamDays}일
            </p>
          ) : (
            quick.laborAdvisoryNote && <p className="text-[14px] text-v1-text-disabled">{quick.laborAdvisoryNote}</p>
          )}
          {quick.equipmentNote && <p className="text-[14px] text-v1-text-disabled">{quick.equipmentNote}</p>}

          {quick.altMix && (
            <Collapsible title="현장 배합 대안">
              <p className="text-[16px] text-foreground py-2 tabular-nums">
                시멘트 40kg × {formatNum(quick.altMix.cementBags)}포 + 모래 {quick.altMix.sandM3}㎥
              </p>
              <p className="text-[14px] text-v1-text-disabled">배합비 {quick.altMix.mixRatio} · 참고용, 비용에는 안 넣었어요</p>
            </Collapsible>
          )}

          {/* 구역별 보기는 서버가 실별로 배분한 값이라 result가 와야 나온다(2개 이상일 때만) */}
          {result && result.quantity.byRoom.length > 1 && (
            <Collapsible title="구역별 보기">
              <div className="flex flex-col">
                {result.quantity.byRoom.map((r, i) => (
                  <div
                    key={r.key}
                    className={`h-11 flex items-center justify-between ${
                      i === result.quantity.byRoom.length - 1 ? '' : 'border-b border-v1-line-2'
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

        {/* 카드 2 — 부자재 (서버 응답이 와야 나온다 — 와이어메시·프라이머 옵션을 켰을 때만) */}
        {submaterials.length > 0 && (
          <Card className={`transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
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

        {/* 카드 3 — 비용. 서버 응답이 없으면(실패 포함) 산식은 안 보이고 안내 캡션만 뜬다 */}
        <Card className={`transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
          {result && range ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
                  {formatManRange(range.min, range.max)}
                </div>
                <span className="text-[14px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
                  추정
                </span>
              </div>
              <p className="text-[16px] font-semibold text-v1-text-secondary tabular-nums">
                중간 {toMan(result.cost.mid).toLocaleString('ko-KR')}만원
              </p>
              <p className="text-[16px] text-foreground tabular-nums">{result.cost.basisLine}</p>
              <Collapsible title="구성 보기" defaultOpen>
                <div className="flex flex-col">
                  {result.cost.breakdown.map((line, i) => (
                    <div key={line.key} className={`py-[10px] ${i === result.cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
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
            </>
          ) : (
            <p className="text-[16px] text-v1-text-secondary">{error ? '비용은 잠시 후 다시' : '비용 계산 중'}</p>
          )}
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
