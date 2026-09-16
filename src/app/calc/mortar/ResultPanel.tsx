// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: 결과 패널 (도배·바닥재 ResultPanel.tsx를 그대로 본떠 만듦)
// 물량 먼저, 비용 다음(설계 정본 0절). PC에서는 입력 오른쪽에 sticky로 붙는다.
//
// 도배·바닥재와 다른 점: 큰 숫자가 "레미탈 40kg × N포"이고, 레미탈 모드에서는 그 아래
// 현장 배합(시멘트+모래) 대안이 참고용으로 붙는다. 인건은 품수만 보여주고 산식은 안 보여준다.
//
// 2026-09-15 운영자 현장 기준 피드백(포수가 안 보이는 문제):
//   물량(카드 1)은 이제 서버 응답(result)을 기다리지 않고 quick(클라이언트 즉시 계산)
//   으로 항상 그린다 — 서버가 늦거나 실패해도 포수·체적·현장배합은 그대로 남는다.
//   부자재·비용만 서버 응답이 필요하다. 응답이 실패하면 비용 칸에
//   "비용은 잠시 후 다시" 캡션 1줄만 보여준다(포수는 안 지운다).
//
// 2026-09-15 디자인 통일 지시(계산기 3종 화면 정리):
//   물량·부자재·비용을 각각 테두리 카드 3장으로 나눠 그리던 걸 카드 한 장으로 합쳤다
//   (카드 속 카드 금지, 테두리 카드는 결과 카드 하나에만). 빈 상태 안내문도 모바일 하단
//   고정 바와 중복이라 PC(lg 이상)에서만 그린다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 피드백 2라운드)
// 카드 통합 + 빈 상태 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
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
import { trimFormForShare, describeAreaPair } from '@/lib/v1/mortarEngineInput';
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
  /** 결과가 없을 때(!quick) 보여줄 한 줄. 모바일은 하단 고정 바가 이미 보여주고 있어서
   *  이 패널은 PC(lg 이상)에서만 그린다(2026-09-15 중복 제거) */
  emptyMessage: string;
}

/** 원 단위로 보여줘도 되는 단위 — 정수로 세는 항목만(도배·바닥재와 같은 규칙) */
const COUNT_UNITS = new Set(['포', '통', '개', '㎡']);

/**
 * 금액 범위를 만원 단위로 뭉개면 안 보이는 소액(1만원 미만) 줄을 위한 보조 포맷터.
 * 2026-09-15 현장 지시: 시멘트처럼 줄 전체 금액이 1만원 밑인 항목이 formatManRange로
 * "0만~1만원"처럼 뭉개져 나오는 문제 — 1만원 미만은 천원 단위("4천~6천원")로, 1만원
 * 이상이면 기존 만원 단위(formatManRange)로 나눠 보여준다.
 * 공용 포맷터(money.ts)에는 없는 기능이라 미장 계산기 화면(ResultPanel·result/page)에만 둔다.
 */
function formatWonRange(min: number, max: number): string {
  if (max < 10000) {
    const a = Math.round(min / 1000);
    const b = Math.round(max / 1000);
    return a === b ? `${a}천원` : `${a}천~${b}천원`;
  }
  return formatManRange(min, max);
}

/**
 * 비용 구성 한 줄을 "13포 × 0.7만 = 9만" 또는 범위 문자열로 만든다.
 * 2026-09-15 운영자 현장 기준 지시(노임 범위화)로 분기 기준을 unitPriceMin===Max에서
 * amountMin===Max로 바꿨다 — 인건 줄은 단가(unitPrice)가 인원×혼합 노임이라 단일값이
 * 아니지만(0으로 채워 둠), 금액(amountMin~Max)은 실제 범위를 갖는다. 기존 기준을 그대로
 * 쓰면 인건 줄이 "68만"처럼 하한만 보이고 범위가 사라지는 문제가 생긴다.
 */
function formatCostLineAmount(line: MortarCostLine): string {
  if (line.key === 'overhead') {
    return line.unitPriceMin === line.unitPriceMax
      ? `${line.unitPriceMin}%`
      : `${line.unitPriceMin}~${line.unitPriceMax}%`;
  }
  if (line.amountMin === line.amountMax) {
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
  return formatWonRange(line.amountMin, line.amountMax);
}

/** 5층 비용 구성 순서 — 06_미장.md §11-9. 경비는 5층엔 안 들지만 합계 줄로 맨 뒤에 그대로 둔다 */
const LAYER_ORDER: MortarCostLine['layer'][] = ['자재', '부자재', '운송·하차', '양중', '인건', '경비'];

/** breakdown을 층별로 묶고 층 소계(금액 범위)를 같이 낸다 — 빈 층은 뺀다 */
function groupByLayer(breakdown: MortarCostLine[]): { layer: MortarCostLine['layer']; lines: MortarCostLine[]; subMin: number; subMax: number }[] {
  return LAYER_ORDER.map((layer) => {
    const lines = breakdown.filter((b) => b.layer === layer);
    return {
      layer,
      lines,
      subMin: lines.reduce((s, l) => s + l.amountMin, 0),
      subMax: lines.reduce((s, l) => s + l.amountMax, 0),
    };
  }).filter((g) => g.lines.length > 0);
}

export default function ResultPanel({ quick, result, range, loading, error, stale, form, emptyMessage }: ResultPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  // quick조차 없으면(면적·두께 미입력) 보여줄 물량이 아예 없다 — 모바일은 하단 고정 바가
  // 이미 같은 문구를 보여주므로(2026-09-15 중복 제거 지시) PC(lg 이상)에서만 그린다.
  if (!quick) {
    return (
      <div className="hidden lg:block">
        <Card>
          <p className="text-[15px] text-v1-text-secondary">{emptyMessage}</p>
        </Card>
      </div>
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
  const areaPair = describeAreaPair(form);

  return (
    <>
      {error && <p className="text-[13px] text-danger mb-2">비용 계산에 실패했어요 — 포수·체적은 그대로예요</p>}
      {/* 결과 카드 — 이 화면에서 테두리 카드는 이거 하나뿐이다(카드 속 카드 금지 원칙).
          물량 → 부자재 → 비용 순서를 얇은 구분선(구획 제목 17/700)으로만 나눈다. */}
      <Card>
        {/* 물량 — quick(즉시 계산)로 항상 그린다 — 서버 응답을 기다리지 않는다 */}
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-[20px] font-semibold text-foreground whitespace-nowrap">
            {quick.mode} {quick.bagKg}kg ×
          </span>
          <span className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
            {formatNum(quick.bags)}
          </span>
          <span className="text-[20px] font-semibold text-foreground">포</span>
        </div>
        <p className="text-[15px] text-foreground">{quick.productLabel}</p>
        <p className="text-[13px] text-v1-text-disabled tabular-nums">
          주문 수량: {formatNum(quick.bags)}포(로스 {quick.lossPct}% 포함)
        </p>
        <p className="text-[15px] text-foreground leading-[1.6] tabular-nums">
          {quick.thicknessMm}mm · 면적 {formatNum(quick.areaSqm)}㎡ · 몰탈 {quick.volumeWithLossM3}㎥
        </p>
        {/* 34평 의미 통일(2026-09-15) — 방통은 도배·바닥재처럼
            "34평 · 84㎡"를 병기해 어떤 규칙으로 계산됐는지 보여준다 */}
        {areaPair && <p className="text-[13px] text-v1-text-disabled tabular-nums">{areaPair}</p>}
        {quick.standardRangeNote && <p className="text-[13px] text-v1-text-secondary">{quick.standardRangeNote}</p>}

        {/* 인원 한 줄 — 서버 응답(labor)이 와야 나온다. "기공 N·조공 N, 1일 완료"(운영자 현장 기준 지시).
            안내 문구(장비대·시공비 별도)는 quick에서 바로 나온다 — 서버가 늦어도 먼저 보여준다 */}
        {labor ? (
          <p className="text-[13px] text-v1-text-disabled tabular-nums">
            {labor.method === '장비타설' ? '장비 타설' : '손미장(추정)'} · 기공 {labor.crewPlasterer}인 · 조공 {labor.crewHelper}인
            {labor.crewMechanic > 0 ? ` · 기계운전 ${labor.crewMechanic}인` : ''}, {labor.days}일 완료
          </p>
        ) : (
          quick.laborAdvisoryNote && <p className="text-[13px] text-v1-text-disabled">{quick.laborAdvisoryNote}</p>
        )}
        {quick.equipmentNote && <p className="text-[13px] text-v1-text-disabled">{quick.equipmentNote}</p>}

        {quick.altMix && (
          <Collapsible title="현장 배합 대안">
            <p className="text-[15px] text-foreground py-2 tabular-nums">
              시멘트 40kg × {formatNum(quick.altMix.cementBags)}포 + 모래 {quick.altMix.sandM3}㎥
            </p>
            <p className="text-[13px] text-v1-text-disabled">배합비 {quick.altMix.mixRatio} · 참고용, 비용에는 안 넣었어요</p>
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
                  <span className="text-[15px] text-foreground">{r.name}</span>
                  <span className="text-[15px] text-v1-text-secondary tabular-nums">
                    {formatNum(r.bags)}포{' '}
                    <span className="text-[13px] text-v1-text-disabled">{formatNum(r.areaSqm)}㎡</span>
                  </span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        {/* 부자재 (서버 응답이 와야 나온다 — 와이어메시·프라이머 옵션을 켰을 때만) */}
        {submaterials.length > 0 && (
          <div className={`transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
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
          </div>
        )}

        {/* 비용. 서버 응답이 없으면(실패 포함) 산식은 안 보이고 안내 캡션만 뜬다 */}
        <div className={`transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
          <h2 className="text-[17px] font-bold text-foreground border-t border-v1-line-2 pt-3 mt-1">비용</h2>
          {result && range ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
                  {formatManRange(range.min, range.max)}
                </div>
                <span className="text-[13px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
                  추정
                </span>
              </div>
              <p className="text-[15px] font-semibold text-v1-text-secondary tabular-nums">
                중간 {toMan(result.cost.mid).toLocaleString('ko-KR')}만원
              </p>
              <p className="text-[15px] text-foreground tabular-nums">{result.cost.basisLine}</p>
              {/* 현장 확인 필요 — 운송·양중·(장비타설시)장비대는 값을 안 넣으면 계산에서 빠진다.
                  캡션 1줄로 빠진 항목을 알려준다(운영자 현장 기준 지시 — "현장 확인 필요" 표시) */}
              {result.siteConfirmItems.length > 0 && (
                <p className="text-[13px] text-v1-text-secondary">
                  현장 확인 필요: {result.siteConfirmItems.join('·')}
                </p>
              )}
              {/* 5층 비용 구성표 — 자재/부자재/운송·하차/양중/인건 층별 소계(운영자 현장 기준 지시) */}
              <Collapsible title="구성 보기" defaultOpen>
                <div className="flex flex-col">
                  {groupByLayer(result.cost.breakdown).map((group) => (
                    <div key={group.layer} className="py-[10px] border-b border-v1-line-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold text-v1-text-label">{group.layer}</span>
                        <span className="text-[13px] font-semibold text-v1-text-label tabular-nums whitespace-nowrap">
                          {formatWonRange(group.subMin, group.subMax)}
                        </span>
                      </div>
                      <div className="flex flex-col pt-1">
                        {group.lines.map((line) => (
                          <div key={line.key} className="py-[6px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[15px] text-foreground min-w-0 truncate">{line.name}</span>
                              <span className="text-[15px] text-foreground tabular-nums whitespace-nowrap flex-none">
                                {formatCostLineAmount(line)}
                              </span>
                            </div>
                            <p className="text-[13px] text-v1-text-disabled tabular-nums">
                              {line.note}
                              {line.grade === 'C' && !line.note.includes('추정') ? ' · 추정' : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[13px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
                </div>
              </Collapsible>
            </>
          ) : (
            <p className="text-[15px] text-v1-text-secondary">{error ? '비용은 잠시 후 다시' : '비용 계산 중'}</p>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-4 mt-4">
        <Button variant="secondary" fullWidth onClick={handleShare}>
          결과 공유
        </Button>
        <Disclaimer />
      </div>
      <Toast message={toast} />
    </>
  );
}
