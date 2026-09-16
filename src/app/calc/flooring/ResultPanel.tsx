// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 결과 패널 (도배 ResultPanel.tsx를 그대로 본떠 만듦)
// 물량 먼저, 비용 다음. PC에서는 입력 오른쪽에 sticky로 붙는다.
//
// 도배와 다른 점: 구성 보기 안의 토글이 두 개다(기존 바닥재 철거 · 걸레받이 교체).
// 큰 숫자 단위도 구매 단위(박스/미터)에 따라 달라진다.
//
// 2026-09-15 디자인 통일 지시(계산기 3종 화면 정리):
//   물량·부자재·비용 3장이던 테두리 카드를 결과 카드 한 장으로 합쳤다(카드 속 카드 금지).
//   빈 상태 안내문도 모바일 하단 고정 바와 중복이라 PC(lg 이상)에서만 그린다.
//
// 작성일: 2026년 09월 10일
// 카드 통합 + 빈 상태 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// ──────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Toggle from '@/components/v1/Toggle';
import Button from '@/components/v1/Button';
import Disclaimer from '@/components/v1/Disclaimer';
import Toast, { showToast } from '@/components/v1/Toast';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { type FlooringFormState, encodeFlooringForm } from '@/lib/v1/flooringQuery';
import { trimFormForShare, describeAreaPair } from '@/lib/v1/flooringEngineInput';
import type { FlooringCalcResultDTO, FlooringCostLine, FlooringRange } from '@/lib/v1/useFlooringCalc';
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
  /** "결과 공유" 버튼이 링크를 만들 때 쓰는 현재 폼 상태 */
  form: FlooringFormState;
  /** 결과가 없을 때(!result) 보여줄 한 줄 안내. 모바일은 하단 고정 바가 이미 보여주고
   *  있어서 이 패널은 PC(lg 이상)에서만 그린다(2026-09-15 중복 제거) */
  emptyMessage: string;
  /** 구성 보기의 "기존 바닥재 철거" 토글 */
  onRemoveOldChange: (v: boolean) => void;
  /** 구성 보기의 "걸레받이 교체" 토글 */
  onBaseboardChange: (v: boolean) => void;
}

/**
 * 원 단위("2개 × 2,500원 = 5,000원")로 보여줘도 되는 단위 — 정수로 세는 부자재만.
 * ㎡·m처럼 연속량 단위는 여기 넣지 않는다(검사관 2라운드 지적 N-1 참고).
 */
const COUNT_UNITS = new Set(['개', '통', '병', '세트', '롤']);

/**
 * 비용 구성 한 줄을 "28박스 × 3.2만 = 90만" 또는 범위 문자열로 만든다 (도배와 같은 규칙).
 *
 * 검사관 2라운드 지적 N-1: 1라운드에서 고친 "단가 1만원 미만이면 원 단위" 규칙이 장판
 * 철거 줄(68.1㎡ × 6,050원 = 412,005원)까지 걸려, ㎡당 철거 단가(서버 산식 값)가 그대로
 * 노출되고 과하게 정밀해 보였다. 원 단위 표기는 **정수 개수 단위(개·통·병·세트·롤)이면서
 * 금액이 10만원 미만**일 때만 쓰고, 그 외는 전부 만 단위로 뭉뚱그린다. 만 단위로 뭉개면
 * 단가가 "0만"이 되는 경우(예: ㎡당 4,000원 → 0만)엔 "qty × 0만 = N만" 같은 이상한 수식
 * 대신 금액만 "N만"(또는 그마저 0만이면 "1만 미만")으로 보여준다.
 */
function formatCostLineAmount(line: FlooringCostLine): string {
  // 일반경비는 unitPrice 칸에 원이 아니라 %가 들어 있어 따로 표기한다
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
    // 단가가 "0만"으로 뭉개지면 "qty × 0만 = N만"처럼 이상한 수식이 되므로 수식 없이 금액만
    if (manPrice === 0) {
      return manAmount === 0 ? '1만 미만' : `${manAmount}만`;
    }
    return `${formatNum(line.qty)}${line.unit} × ${manPrice}만 = ${manAmount}만`;
  }
  return formatManRange(line.amountMin, line.amountMax);
}

export default function ResultPanel({
  result,
  range,
  loading,
  error,
  stale,
  form,
  emptyMessage,
  onRemoveOldChange,
  onBaseboardChange,
}: ResultPanelProps) {
  // "링크를 복사했어요" 같은 짧은 토스트 메시지
  const [toast, setToast] = useState<string | null>(null);

  // GA4 — 결과 카드가 실제로 화면에 보였을 때(result가 새로 생길 때마다) 1번 기록
  useEffect(() => {
    if (result) track('calc_result_view', { process: 'flooring' });
  }, [result]);

  // 빈 상태 — 모바일 하단 고정 바가 이미 같은 문구를 보여주므로(2026-09-15 중복 제거 지시)
  // 이 카드는 PC(lg 이상)에서만 그린다.
  if (!result) {
    return (
      <div className="hidden lg:block">
        <Card>
          <p className="text-[15px] text-v1-text-secondary">{error ? '계산에 실패했어요' : emptyMessage}</p>
        </Card>
      </div>
    );
  }

  const { quantity, submaterials, cost } = result;
  // 큰 숫자 단위(박스/미터) 라벨
  const unitLabel = quantity.unit === '박스' ? '박스' : 'm';
  // 로스 근거 라벨: 실제/추정 기준으로 문구가 달라진다
  const lossLabel = quantity.lossMode === '실제' ? `실제 로스 ${quantity.lossPct}%` : `추정 로스 ${quantity.lossPct}%`;

  // 큰 숫자는 훅이 계산해 준 범위(범위가 없으면 이 결과 자체의 min~max)를 쓴다.
  const bigRange = range ?? { min: cost.min, max: cost.max };

  // 로딩 중이거나 이전 값을 보여주는 중이거나, 방금 계산이 실패해 예전 값을 그대로 보여주는
  // 중이면 카드 전체를 옅게 한다(도배와 같은 깜빡임 방지 규칙)
  const dim = loading || stale || !!error;

  /** "결과 공유" — 모바일은 공유 시트가 있으면 그것부터, 아니면 링크 복사 */
  async function handleShare() {
    track('calc_cta_click', { process: 'flooring', target: 'share' });
    // 지금 모드에서 안 쓰는 값(예: simple인데 실측 방 목록)은 링크에 안 싣는다
    const url = `${window.location.origin}/calc/flooring/result?d=${encodeFlooringForm(trimFormForShare(form))}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: '얼마드나 바닥재 계산 결과', url });
        return;
      } catch (e) {
        // 사용자가 공유 시트를 취소한 것(AbortError)이면 아무 것도 안 하고 조용히 끝낸다
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
      {/* 결과가 있는 상태에서 방금 계산이 실패했으면 침묵하지 않고 알려준다 */}
      {error && <p className="text-[13px] text-danger mb-2">마지막 계산에 실패해 이전 값이에요</p>}
      {/* 결과 카드 — 이 화면에서 테두리 카드는 이거 하나뿐이다(카드 속 카드 금지 원칙) */}
      <Card className={`transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
        {/* 물량 */}
        <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
          {formatNum(quantity.units)}
          {unitLabel}
        </div>
        <p className="text-[15px] text-foreground leading-[1.6] tabular-nums">
          바닥 {formatNum(quantity.floorSqm)}㎡ · {lossLabel}
          {quantity.pieces != null ? ` · 총 ${formatNum(quantity.pieces)}장` : ''}
        </p>
        {/* 간단(평형/㎡) 모드일 때만 "34평 · 84㎡" 병기(도배 ResultPanel과 같은 규칙) */}
        {quantity.inputMode === '평형' && describeAreaPair(form) && (
          <p className="text-[13px] text-v1-text-disabled tabular-nums">{describeAreaPair(form)}</p>
        )}
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

        {/* 부자재 */}
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
              {/* 근거 등급이 C(추정)면 근거줄 끝에 "· 추정"을 덧붙인다(도배와 같은 규칙) */}
              <p className="text-[13px] text-v1-text-disabled tabular-nums">
                {s.basis}
                {s.grade === 'C' && !s.basis.includes('추정') ? ' · 추정' : ''}
              </p>
            </div>
          ))}
        </div>

        {/* 비용 */}
        <h2 className="text-[17px] font-bold text-foreground border-t border-v1-line-2 pt-3 mt-1">비용</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
            {formatManRange(bigRange.min, bigRange.max)}
          </div>
          {cost.mode === '산식' && (
            <span className="text-[13px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
              추정
            </span>
          )}
        </div>
        <p className="text-[15px] font-semibold text-v1-text-secondary tabular-nums">
          중간 {toMan(cost.mid).toLocaleString('ko-KR')}만원
        </p>
        <p className="text-[15px] text-foreground tabular-nums">{cost.basisLine}</p>
        {/* 구성 보기 — 기본으로 전부 펼쳐 보여준다(접을 수는 있다). 견적은 전부 구축 기준이라
            맨 위에 토글 2개(기존 바닥재 철거 · 걸레받이 교체)를 두고 사용자가 보고 판단한다. */}
        <Collapsible
          title="구성 보기"
          defaultOpen
          onOpen={() => track('calc_detail_open', { process: 'flooring' })}
        >
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
                {/* 검사관 2라운드 지적 N-2: 이름이 길고 금액도 긴 줄(원 단위 표기 포함)이
                    좁은 화면에서 겹치지 않게 gap을 주고, 이름은 줄이며 금액은 안 접히게 한다 */}
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

      {/* 공유 행 — 저장 버튼은 이번 화면에 없음(로그인 미구현) */}
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
