// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: 결과 패널
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9장 — 도배·바닥재가 이미 적용한 좁혀가기·
// 가정 표시·공유 버튼 규칙을 그대로 옮겨 왔다.
//
// 2026-09-27 저녁 지휘관 3차 검수 지적 1번: 카드 맨 위가 금액이 아니었다("레미탈
// 40kg × 146포"가 먼저, "비용 152만~229만원"이 한참 아래) — 도배·바닥재와 같은
// 순서로 다시 짰다:
//   ① 금액 범위(가장 큰 숫자) + 중간값 + "추정" 배지
//   ② 수량 한 줄: "레미탈 40kg × 146포 · 40mm · 84㎡"(㎡는 정수)
//   ③ 보조 한 줄(.t-sub): "로스 5% 포함 · 몰탈 3.5㎥ · 기공 2 · 조공 2 · 1일" —
//      "레미탈 40kg 포대"·"주문 수량: 146포(로스 5% 포함)"·"손미장(추정) · 기공
//      2인 · 조공 2인, 1일 완료"처럼 같은 내용을 여러 줄로 풀어 쓴 것을 한 줄로 합쳤다.
//   ④ 가정 줄(있을 때만)
//   ⑤ 기준 줄 + "현장 확인 필요: …"를 이어 한 줄로
//   ⑥ 현장 배합 대안(접힘) · 구역별 보기 · 부자재 · 구성 보기
//
// 물량(quick)은 서버 응답을 기다리지 않고 항상 즉시 계산된 값을 그린다 — 그래서 ②③④는
// dim 처리를 안 한다. ①⑤와 부자재·구성 보기(서버 응답, result)만 stale일 때 흐리게
// 한다 — "새 수량 옆에 옛 금액이 또렷이 보이는 순간"을 없애는 핵심은 옛 금액 쪽을
// 흐리게 하는 것이지, 이미 최신인 수량을 같이 흐리게 할 필요는 없다.
//
// 구성 보기의 만 원 미만 금액은 공용 costLineFormat.ts(원래 도배 전용이었으나 9장
// 작업으로 _components/로 옮김)의 formatWonPiece로 원 단위 그대로 보여준다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 피드백 2라운드)
// 카드 통합 + 빈 상태 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// 좁혀가기·가정 표시·공유 규칙 이식 + 만 원 미만 표기 통일: 2026년 09월 27일 (지시서 9장)
// 결과 카드 순서 재배치(금액 우선): 2026년 09월 27일 저녁(지휘관 3차 검수)
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Button from '@/components/v1/Button';
import Disclaimer from '@/components/v1/Disclaimer';
import Toast, { showToast } from '@/components/v1/Toast';
import CalcContactCta from '../_components/CalcContactCta';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { type MortarFormState, encodeMortarForm } from '@/lib/v1/mortarQuery';
import { trimFormForShare, describeAreaPair, type MortarAssumption } from '@/lib/v1/mortarEngineInput';
import type { MortarCalcResultDTO, MortarCostLine, MortarRange } from '@/lib/v1/useMortarCalc';
import type { MortarQuickResult } from '@/lib/v1/useMortarQuickCalc';
import { describeMortarAreaAssumptionLine } from '../_components/assumptionText';
import { formatWonPiece } from '../_components/costLineFormat';
import { dimTransitionStyle } from '../_components/dimTransition';

export interface ResultPanelProps {
  /** 즉시 계산 결과(서버 응답 없이도 항상 있음) — 수량 줄은 전부 여기서 가져온다 */
  quick: MortarQuickResult | null;
  /** 서버 계산 결과(부자재·비용·인건). 늦게 오거나 없을 수 있다 */
  result: MortarCalcResultDTO | null;
  range: MortarRange | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  /** 지금 보이는 result가 어떤 값을 가정해서 계산됐는지 */
  assumed: MortarAssumption[];
  /** 3단계(용도·면적·두께)가 전부 "손대서" 끝났는지 — 공유 버튼 노출 판정에 쓴다 */
  allDone: boolean;
  /**
   * 세부 조정의 배송비·지게차 하차비·양중비 세 금액 칸이 전부 범위(0~1,000만원) 안인지.
   * 2026-09-30 지휘관 긴급 전달(중요 3) — 하나라도 범위를 벗어나면 그 칸은 "안 넣은
   * 것"(0원)으로 계산되는데, 그 상태에서 공유를 계속 보여주면 이상할 게 없어 보이지만
   * 사실 "화면에 적힌 값(범위 밖 큰 숫자)"과 "계산에 쓴 값(0원 취급)"이 달라진 상태다 —
   * 그래서 공유 자체를 숨긴다(계산기 금액 = 공유 결과 금액을 항상 지키기 위해).
   */
  moneyFieldsAllInRange: boolean;
  form: MortarFormState;
  /** 면적 가정 문구("34평 가정" 또는 "33㎡ 가정") — 용도(방통/셀프레벨링)에 따라 달라 부르는 쪽이 계산해 넘긴다 */
  areaAssumedText: string;
  /** 두께 가정 문구("45mm 가정" 등) — 용도별 기본 두께가 달라 부르는 쪽이 계산해 넘긴다 */
  thicknessAssumedText: string;
  /** 결과가 없을 때(!quick) 보여줄 한 줄. 모바일은 하단 고정 바가 이미 보여주고 있어서
   *  이 패널은 PC(lg 이상)에서만 그린다(2026-09-15 중복 제거) */
  emptyMessage: string;
}

/** 소수 1자리 반올림 — 몰탈 체적 표시용("3.528" → "3.5") */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 층 소계(그룹핑) 전용 — 1만 원 미만 범위를 천 원 단위로 뭉뚱그려 보여준다("4천~6천원").
 * 개별 비용 줄(formatCostLineAmount)과는 다른 자리(요약용)라 그대로 남겨 둔다(9-1절이
 * 금지하는 건 "0만"처럼 값이 사라지는 표기이지, 이 의도된 요약 표기가 아니다).
 */
function formatLayerSubtotal(min: number, max: number): string {
  if (max < 10000) {
    const a = Math.round(min / 1000);
    const b = Math.round(max / 1000);
    return a === b ? `${a}천원` : `${a}천~${b}천원`;
  }
  return formatManRange(min, max);
}

/**
 * 비용 구성 한 줄을 "13포 × 700원 = 9,100원" 또는 범위 문자열로 만든다.
 * 분기 기준은 amountMin===amountMax(단가가 아니라 금액 범위로 판단 — 인건 줄은 단가
 * 자체가 인원×혼합 노임이라 단일값이 아니다, 2026-09-15 운영자 현장 기준 지시).
 * 만 원 미만 값은 formatWonPiece로 실제 원 금액을 그대로 보여준다(9-1절 — "1만 미만"
 * 같은 placeholder 문구를 쓰지 않는다).
 */
function formatCostLineAmount(line: MortarCostLine): string {
  if (line.key === 'overhead') {
    return line.unitPriceMin === line.unitPriceMax
      ? `${line.unitPriceMin}%`
      : `${line.unitPriceMin}~${line.unitPriceMax}%`;
  }
  if (line.amountMin === line.amountMax) {
    const qtyText = `${formatNum(line.qty)}${line.unit}`;
    const priceText = line.unitPriceMin > 0 ? formatWonPiece(line.unitPriceMin) : null;
    const amountText = line.amountMin > 0 ? formatWonPiece(line.amountMin) : null;
    if (priceText && amountText) return `${qtyText} × ${priceText} = ${amountText}`;
    if (amountText) return `${qtyText} = ${amountText}`;
    return qtyText;
  }
  return formatLayerSubtotal(line.amountMin, line.amountMax);
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

export default function ResultPanel({
  quick,
  result,
  range,
  loading,
  error,
  stale,
  assumed,
  allDone,
  moneyFieldsAllInRange,
  form,
  areaAssumedText,
  thicknessAssumedText,
  emptyMessage,
}: ResultPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  // quick조차 없으면(1단계 용도를 아직 안 골랐다) 보여줄 물량이 아예 없다 — 모바일은
  // 하단 고정 바가 이미 같은 문구를 보여주므로 PC(lg 이상)에서만 그린다.
  if (!quick) {
    return (
      <div className="hidden lg:block">
        <Card>
          <p className="text-[15px] text-v1-text-secondary">{emptyMessage}</p>
        </Card>
      </div>
    );
  }

  // 비용(서버 응답)이 아직 없으면(로딩 중이거나 실패) 금액·기준 줄 자리에 안내만 보인다.
  const hasCost = !!(result && range);
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
  const areaAssumptionLine = describeMortarAreaAssumptionLine(areaPair, assumed, areaAssumedText, thicknessAssumedText);

  // 도배·바닥재와 같은 규칙: 공유는 3단계(용도·면적·두께)가 전부 끝났고, 'area'·
  // 'thickness'·'measuring' 가정이 안 남아 있을 때만 보인다. 공법 조정 칩은 공유를 안 막는다.
  // 2026-09-30 지휘관 긴급 전달(중요 1) — 계산이 실패한 상태(error)에서는 공유를 숨긴다(세 계산기 공통 규칙)
  // 2026-09-30 지휘관 긴급 전달(중요 3) — 세부 조정 금액 칸(배송비·지게차 하차비·양중비)
  // 중 하나라도 범위(1,000만원)를 벗어나면 공유를 숨긴다. 그 칸은 계산에서 "안 넣은
  // 것"(0원)으로 빠지는데, 공유를 그대로 보여주면 화면 칸의 큰 숫자와 계산에 쓴 0원이
  // 서로 다른 채로 공유되는 사고가 난다.
  const canShare =
    allDone &&
    !error &&
    moneyFieldsAllInRange &&
    !assumed.includes('area') &&
    !assumed.includes('thickness') &&
    !assumed.includes('measuring');

  // ② 수량 한 줄 — "레미탈 40kg × 146포 · 40mm · 84㎡"(㎡는 정수). 가운뎃점으로 줄이
  // 갈리더라도 다음 줄이 가운뎃점으로 시작하지 않게 조각마다 span으로 나눈다.
  const quantityChunks = [
    `${quick.mode} ${quick.bagKg}kg × ${formatNum(quick.bags)}포`,
    `${quick.thicknessMm}mm`,
    `${Math.round(quick.areaSqm)}㎡`,
  ];

  // ③ 보조 한 줄 — "레미탈 40kg 포대"·"주문 수량: N포(로스 …)"·인건 줄을 여기 하나로 합친다.
  // 실제로 제품을 골라서 이름이 붙었을 때만(모드 기본 표기와 다를 때만) 맨 앞에 그 이름을 보여준다.
  const isGenericProductLabel = quick.productLabel === `${quick.mode} ${quick.bagKg}kg 포대`;
  const subChunks: string[] = [];
  if (!isGenericProductLabel) subChunks.push(quick.productLabel);
  subChunks.push(`로스 ${quick.lossPct}% 포함`);
  subChunks.push(`몰탈 ${r1(quick.volumeWithLossM3)}㎥`);
  if (labor) {
    subChunks.push(`기공 ${labor.crewPlasterer}`);
    subChunks.push(`조공 ${labor.crewHelper}`);
    if (labor.crewMechanic > 0) subChunks.push(`기계운전 ${labor.crewMechanic}`);
    subChunks.push(`${labor.days}일`);
  } else if (quick.laborAdvisoryNote) {
    subChunks.push(quick.laborAdvisoryNote);
  }

  // ⑤ 기준 줄 — "현장 확인 필요: …"를 기준 줄 뒤에 이어 한 줄로 붙인다(따로 줄 안 나눈다)
  const basisLineWithSiteConfirm = result
    ? `${result.cost.basisLine}${
        result.siteConfirmItems.length > 0 ? ` · 현장 확인 필요: ${result.siteConfirmItems.join('·')}` : ''
      }`
    : '';

  return (
    <>
      {error && <p className="text-[13px] text-danger mb-2">비용 계산에 실패했어요 — 수량·체적은 그대로예요</p>}
      {/* 결과 카드 — 이 화면에서 테두리 카드는 이거 하나뿐이다(카드 속 카드 금지 원칙) */}
      <Card>
        {/* ① 금액 범위 + 중간값 + "추정" 배지. 비용(서버 응답)이 아직 없으면 안내 한 줄만.
            result && range로 직접 검사해야 타입스크립트가 아래에서 null이 아님을 알아준다
            (hasCost는 별도 boolean이라 타입 좁히기가 안 된다) */}
        {result && range ? (
          <div className={`transition-opacity ${dim ? 'opacity-60' : ''}`} style={dimTransitionStyle(dim)}>
            <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
              {formatManRange(range.min, range.max)}
            </div>
            <p className="t-body font-semibold text-ink-2 tabular-nums flex items-center gap-2">
              중간 {toMan(result.cost.mid).toLocaleString('ko-KR')}만원
              {result.cost.mode === '산식' && (
                <span className="text-[13px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
                  추정
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="t-body text-ink-2">{error ? '비용은 잠시 후 다시' : '비용 계산 중'}</p>
        )}

        {/* ② 수량 한 줄 — 수량은 quick(즉시 계산)에서 바로 나온다. dim 처리 안 함(항상 최신).
            2026-10-03 사장 지적 1번: 요약 줄이 접힘 속 세부보다 흐려 보이던 문제 —
            본문 크기(15px)는 그대로 두고 수량 숫자라 굵기만 600으로 올렸다(색은 ink 그대로). */}
        <p className="t-body font-semibold text-ink tabular-nums pt-2 border-t border-v1-line-2 flex flex-wrap gap-x-1">
          {quantityChunks.map((chunk, i, arr) => (
            <span key={i} className="whitespace-nowrap">
              {chunk}
              {i < arr.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>

        {/* ③ 보조 한 줄 — 2026-10-03: "로스 포함·몰탈 체적·인원" 같은 조건 줄도 ②와 같은
            근거 정보라 t-sub(13px·ink-2)에서 t-body(15px·ink)로 올리고 숫자라 굵기도 600으로 */}
        <p className="t-body font-semibold text-ink tabular-nums flex flex-wrap gap-x-1">
          {subChunks.map((chunk, i, arr) => (
            <span key={i} className="whitespace-nowrap">
              {chunk}
              {i < arr.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>
        {/* 표준 범위·장비대 관련 경고성 캡션 — "같은 내용을 다르게 쓴 것"이 아니라 별도
            주의 문구라 ③과 합치지 않고 그대로 둔다 */}
        {quick.standardRangeNote && <p className="t-sub text-ink-2">{quick.standardRangeNote}</p>}
        {quick.equipmentNote && <p className="t-sub text-ink-2">{quick.equipmentNote}</p>}

        {/* ④ 면적·두께 가정 한 줄 */}
        {areaAssumptionLine && <p className="t-sub text-ink-2 tabular-nums">{areaAssumptionLine}</p>}

        {/* ⑤ 기준 줄 + 현장 확인 필요를 이어서 */}
        {hasCost && (
          <div className={`transition-opacity ${dim ? 'opacity-60' : ''}`} style={dimTransitionStyle(dim)}>
            <p className="t-body text-ink tabular-nums">{basisLineWithSiteConfirm}</p>
          </div>
        )}

        {/* 2026-10-03 사장 지적 1번: 접힘 속 세부는 "보조 정보"답게 13~14px·ink-2로 낮췄다
            (이름·안내문은 굵기 400 그대로, 금액류만 500). 글자 크기·굵기·색만 바뀌고 구조·
            문구·순서는 그대로다. */}
        {quick.altMix && (
          <Collapsible title="현장 배합 대안">
            <p className="text-[14px] text-ink-2 py-2 tabular-nums">
              시멘트 40kg × {formatNum(quick.altMix.cementBags)}포 + 모래 {quick.altMix.sandM3}㎥
            </p>
            <p className="text-[12.5px] text-v1-text-disabled">배합비 {quick.altMix.mixRatio} · 참고용, 비용에는 안 넣었어요</p>
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
                  <span className="text-[14px] text-ink-2">{r.name}</span>
                  <span className="text-[14px] font-medium text-ink-2 tabular-nums">
                    {formatNum(r.bags)}포{' '}
                    <span className="text-[12.5px] font-normal text-v1-text-disabled">{formatNum(r.areaSqm)}㎡</span>
                  </span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        {/* 부자재 (서버 응답이 와야 나온다 — 와이어메시·프라이머 옵션을 켰을 때만) */}
        {submaterials.length > 0 && (
          <div className={`transition-opacity ${dim ? 'opacity-60' : ''}`} style={dimTransitionStyle(dim)}>
            <h2 className="text-[14px] font-semibold text-ink-2 border-t border-v1-line-2 pt-3 mt-1">부자재</h2>
            <div className="flex flex-col">
              {submaterials.map((s, i) => (
                <div key={s.key} className={`py-[10px] ${i === submaterials.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-ink-2">{s.name}</span>
                    <span className="text-[14px] font-medium text-ink-2 tabular-nums">
                      {formatNum(s.qty)}
                      {s.unit}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-v1-text-disabled tabular-nums">
                    {s.basis}
                    {s.grade === 'C' && !s.basis.includes('추정') ? ' · 추정' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⑥ 비용 구성 — 서버 응답이 없으면 아예 안 그린다(위에서 이미 안내를 보여줬다).
            여기도 result를 직접 검사해 타입을 좁힌다 */}
        {result && (
          <div className={`transition-opacity ${dim ? 'opacity-60' : ''}`} style={dimTransitionStyle(dim)}>
            <Collapsible title="구성 보기" defaultOpen>
              <div className="flex flex-col">
                {groupByLayer(result.cost.breakdown).map((group) => (
                  <div key={group.layer} className="py-[10px] border-b border-v1-line-2">
                    {/* 층 이름(자재·부자재·인건 등)은 소제목이라 굵기 600 유지, 옆 소계
                        금액은 다른 금액들과 똑같이 굵기 500으로 낮췄다(2026-10-03) */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-ink-2">{group.layer}</span>
                      <span className="text-[13px] font-medium text-ink-2 tabular-nums whitespace-nowrap">
                        {formatLayerSubtotal(group.subMin, group.subMax)}
                      </span>
                    </div>
                    <div className="flex flex-col pt-1">
                      {group.lines.map((line) => (
                        <div key={line.key} className="py-[6px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[14px] text-ink-2 min-w-0 truncate">{line.name}</span>
                            <span className="text-[14px] font-medium text-ink-2 tabular-nums whitespace-nowrap flex-none">
                              {formatCostLineAmount(line)}
                            </span>
                          </div>
                          <p className="text-[12.5px] text-v1-text-disabled tabular-nums">
                            {line.note}
                            {line.grade === 'C' && !line.note.includes('추정') ? ' · 추정' : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[12.5px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
              </div>
            </Collapsible>
          </div>
        )}
      </Card>

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
