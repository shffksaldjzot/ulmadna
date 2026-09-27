// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 결과 패널
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 3-13절: 카드 안 순서를 아래로 바꿨다(계산
// 내용·항목 자체는 그대로다).
//   1. 금액 범위(가장 큰 숫자) + "추정" 표시 + 중간값 한 줄
//   2. 수량 한 줄 — 제품 미정(assumed에 'product')이면 롤 수도 범위로 보여준다(rollsRange)
//   3. 면적·가정 한 줄(있을 때만) — "34평 · 84㎡ · 제품 미정" 또는 "34평 가정 · 제품 미정" 등,
//      ink-2 보조색(2026-09-27 3차 검수 지적 4번으로 면적 병기 줄과 가정 줄을 하나로 합침)
//   4. 기준 줄(cost.basisLine)
//   5. 구성 보기(접힘) · 부자재 · 실별 보기(접힘)
//   6. 공유·문의
//
// 공유 버튼은 지휘관이 3-13절을 수정한 규칙을 따른다(2026-09-27):
//   "결과 공유는 필수 단계 3개(종류·제품·면적)가 모두 완료됐을 때만 보인다. 조정 칩
//   (베이·범위)과 '아직 안 정했어요'(제품)는 공유를 막지 않는다. 'area'·'measuring'
//   가정이 남아 있으면 숨긴다." → allDone && !assumed.includes('area'|'measuring')로 구현.
//
// 3-13절: "첫 단계를 고르기 전에는 결과 카드를 그리지 않는다" — result가 null이면(계산
// 담당의 useWallpaperCalc가 벽지 종류를 아직 못 골라 계산을 안 한 상태) 통째로 아무것도
// 안 그린다. 종류는 골랐는데 계산 자체가 실패했으면(드묾) 짧은 실패 문구만 보여준다.
//
// 작성일: 2026년 09월 08일
// 채움: 2026년 09월 09일 (B 지시서)
// 카드 통합 + 빈 상태 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// 결과 카드 순서 재배치 + 좁혀가기 연동: 2026년 09월 27일 (단계 흐름 개선)
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
import { type WallpaperFormState, encodeWallpaperForm } from '@/lib/v1/wallpaperQuery';
import { trimFormForShare, describeAreaPair, type WallpaperAssumption } from '@/lib/v1/wallpaperEngineInput';
import type { WallpaperCalcResultDTO, WallpaperCostLine, WallpaperRange } from '@/lib/v1/useWallpaperCalc';
import { describeWallpaperAreaAssumptionLine } from './assumptionText';
// GA4 — 결과 노출/구성 보기 펼침/공유 버튼 클릭 이벤트
import { track } from '@/lib/analytics';

export interface ResultPanelProps {
  /** 마지막 성공 결과 (물량·부자재·비용 구성 전부 포함) */
  result: WallpaperCalcResultDTO | null;
  /** 결과 화면 큰 숫자에 쓰는 금액 범위(= result.cost.min~max) */
  range: WallpaperRange | null;
  loading: boolean;
  error: string | null;
  /** true면 지금 보이는 값이 최신 입력 이전 값이라는 뜻(깜빡임 방지용 표시) */
  stale: boolean;
  /** 지금 보이는 result가 어떤 값을 가정해서 계산됐는지(계산 담당 useWallpaperCalc가 돌려준다) */
  assumed: WallpaperAssumption[];
  /** 3단계(종류·제품·면적/실측)가 전부 "손대서" 끝났는지 — 공유 버튼 노출 판정에 쓴다 */
  allDone: boolean;
  /** "결과 공유" 버튼이 링크를 만들 때 쓰는 현재 폼 상태 */
  form: WallpaperFormState;
  /** 구성 보기의 "기존 벽지 제거" 토글 — 켜고 끄면 폼 상태(removeOld)가 바뀌어 다시 계산된다 */
  onRemoveOldChange: (v: boolean) => void;
}

/** 비용 구성 한 줄을 "28롤 × 3.2만 = 90만" 또는 범위 문자열로 만든다 (result/page.tsx와 같은 규칙) */
function formatCostLineAmount(line: WallpaperCostLine): string {
  // 일반경비는 unitPrice 칸에 원이 아니라 %가 들어 있어 따로 표기한다
  if (line.key === 'overhead') {
    return line.unitPriceMin === line.unitPriceMax
      ? `${line.unitPriceMin}%`
      : `${line.unitPriceMin}~${line.unitPriceMax}%`;
  }
  if (line.unitPriceMin === line.unitPriceMax) {
    return `${formatNum(line.qty)}${line.unit} × ${toMan(line.unitPriceMin)}만 = ${toMan(line.amountMin)}만`;
  }
  return formatManRange(line.amountMin, line.amountMax);
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
}: ResultPanelProps) {
  // "링크를 복사했어요" 같은 짧은 토스트 메시지
  const [toast, setToast] = useState<string | null>(null);

  // GA4 — 결과 카드가 실제로 화면에 보였을 때(result가 새로 생길 때마다) 1번 기록
  useEffect(() => {
    if (result) track('calc_result_view', { process: 'wallpaper' });
  }, [result]);

  // 3-13절: 첫 단계를 고르기 전(계산 담당이 아직 계산할 게 없다고 본 상태)에는 통째로 안 그린다.
  // 종류는 골랐는데 계산 자체가 실패했으면(드묾) 짧은 실패 문구만 보여준다.
  if (!result) {
    if (error) return <p className="t-body text-ink">계산에 실패했어요</p>;
    return null;
  }

  const { quantity, submaterials, cost } = result;

  // 큰 숫자는 훅이 계산해 준 범위(범위가 없으면 이 결과 자체의 min~max)를 쓴다.
  const bigRange = range ?? { min: cost.min, max: cost.max };

  // 로딩 중이거나 이전 값을 보여주는 중이거나, 방금 계산이 실패해 예전 값을 그대로 보여주는
  // 중이면 카드 전체를 옅게 한다(깜빡임 방지 규칙 + 검사관 지적 12번)
  const dim = loading || stale || !!error;

  // 2026-09-27 지휘관 3차 검수 지적 4번: "34평 · 84㎡"(면적 병기)와 "가정 줄"을 한 줄로
  // 합친다. 간단 모드(평형)일 때만 areaPairText가 의미 있고, 그 외(정확 모드 등)엔 null을
  // 넘겨서 area 가정 여부·product 가정 여부만으로 문구를 만든다.
  const areaPairText = quantity.inputMode === '평형' ? describeAreaPair(form) : null;
  const areaAssumptionLine = describeWallpaperAreaAssumptionLine(areaPairText, assumed);

  // 지휘관 확정 규칙(2026-09-27, 3-13절 수정): 공유는 3단계가 전부 끝났고, 'area'·'measuring'
  // 가정이 안 남아 있을 때만 보인다. 베이·범위 조정 칩과 "제품 미정"은 공유를 막지 않는다.
  const canShare = allDone && !assumed.includes('area') && !assumed.includes('measuring');

  /** "결과 공유" — 모바일은 공유 시트가 있으면 그것부터, 아니면 링크 복사 */
  async function handleShare() {
    track('calc_cta_click', { process: 'wallpaper', target: 'share' });
    const url = `${window.location.origin}/calc/wallpaper/result?d=${encodeWallpaperForm(trimFormForShare(form))}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: '얼마드나 도배 계산 결과', url });
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
      <Card className={`transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
        {/* 1. 금액 범위(가장 큰 숫자) + 중간값 + "추정" 표시 한 줄 — 지시서 3-13절 순서 1번.
            2026-09-27 검수 지적 9번: "추정" 배지가 360px에서 금액 아래로 밀려 떨어지던 문제 —
            배지를 금액 줄이 아니라 "중간값" 줄 오른쪽 끝에 고정해 폭에 상관없이 자리를 통일했다. */}
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

        {/* 2. 수량 한 줄 — 제품 미정이면 롤 수도 범위로("19~46롤"), 최소=최대면 하나만("19롤").
            2026-09-27 검수 지적 4·5번: 로스 문구는 뺐다(구성 보기에 따로 없어 그냥 삭제 —
            서버 응답에 이미 있었다면 거기로 옮겼겠지만 지금은 없다). ㎡는 정수 반올림.
            세 조각(롤 수·벽·천장)을 각각 span으로 나눠 flex-wrap 해서, 390px에서는 한 줄에
            다 들어가고 360px처럼 좁아 줄바꿈될 때도 다음 줄이 가운뎃점으로 시작하지 않는다
            (가운뎃점을 항상 "앞 조각 끝"에 붙여 뒀기 때문). */}
        <p className="t-body text-ink tabular-nums pt-2 border-t border-v1-line-2 flex flex-wrap gap-x-1">
          {[
            quantity.rollsRange && quantity.rollsRange.min !== quantity.rollsRange.max
              ? `${formatNum(quantity.rollsRange.min)}~${formatNum(quantity.rollsRange.max)}롤`
              : `${formatNum(quantity.rollsRange ? quantity.rollsRange.min : quantity.rolls)}롤`,
            `벽 ${Math.round(quantity.wallSqm)}㎡`,
            `천장 ${Math.round(quantity.ceilingSqm)}㎡`,
          ].map((chunk, i, arr) => (
            <span key={i} className="whitespace-nowrap">
              {chunk}
              {i < arr.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>
        {/* 3. 면적·가정 한 줄 — 2026-09-27 검수 지적 4번으로 합쳤다. 예:
            "34평 · 84㎡"(면적을 직접 골랐고 가정 없음) / "34평 · 84㎡ · 제품 미정"(면적은
            골랐는데 제품만 미정) / "34평 가정 · 제품 미정"(면적도 가정) / "실측 입력 중" */}
        {areaAssumptionLine && <p className="t-sub text-ink-2 tabular-nums">{areaAssumptionLine}</p>}

        {/* 4. 기준 줄 */}
        <p className="t-body text-ink tabular-nums">{cost.basisLine}</p>

        {/* 면적(벽 길이) 모드는 방별 물량이 없어 "실별 보기"가 뜻이 없다 — 숨긴다 */}
        {quantity.inputMode !== '면적' && (
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
                    {r.rolls}롤{' '}
                    <span className="text-[13px] text-v1-text-disabled">
                      {Math.round((r.wallSqm + r.ceilingSqm) * 10) / 10}㎡
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

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

        {/* 구성 보기 — 2026-09-09 형아 결정: 기본으로 전부 펼쳐 보여준다(접을 수는 있다) */}
        <Collapsible title="구성 보기" defaultOpen onOpen={() => track('calc_detail_open', { process: 'wallpaper' })}>
          <div className="flex flex-col">
            <div className="py-[10px] border-b border-v1-line-2 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-[2px] min-w-0">
                <span className="text-[15px] text-foreground">기존 벽지 제거</span>
                <span className="text-[13px] text-v1-text-disabled">구축 기준 견적 · 끄면 철거비를 뺍니다</span>
              </div>
              <Toggle checked={form.removeOld ?? true} onChange={onRemoveOldChange} label="기존 벽지 제거 포함" className="flex-none" />
            </div>
            {cost.breakdown.map((line, i) => (
              <div key={line.key} className={`py-[10px] ${i === cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] text-foreground">{line.name}</span>
                  <span className="text-[15px] text-foreground tabular-nums">{formatCostLineAmount(line)}</span>
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
