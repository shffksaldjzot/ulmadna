// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 결과 패널
// 물량 먼저, 비용 다음(설계 정본 0절). PC에서는 입력 오른쪽에 sticky로 붙는다.
//
// 2026-09-15 디자인 통일 지시(계산기 3종 화면 정리):
//   예전엔 물량·부자재·비용을 각각 테두리 카드(Card) 3장으로 나눠 그렸다 — "카드 속 카드
//   금지, 테두리 카드는 결과 카드 하나에만" 원칙에 따라 이제 이 패널 전체가 카드 한 장이고,
//   안쪽은 여백 + 구획 제목(17/700) + 얇은 구분선으로만 나눈다.
//   또한 빈 상태(아직 계산할 값이 없을 때) 안내문("벽지를 고르면 바로 나와요" 등)은 모바일에서
//   하단 고정 요약 바와 겹쳐 같은 문장이 두 번 보이는 중복이었다 — 모바일 화면(<lg)에서는
//   하단 바 하나만 남기고 이 패널의 빈 상태 문구는 PC(lg 이상)에서만 보여준다.
//
// 작성일: 2026년 09월 08일
// 채움: 2026년 09월 09일 (B 지시서)
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
import { type WallpaperFormState, encodeWallpaperForm } from '@/lib/v1/wallpaperQuery';
import { trimFormForShare, describeAreaPair } from '@/lib/v1/wallpaperEngineInput';
import type { WallpaperCalcResultDTO, WallpaperCostLine, WallpaperRange } from '@/lib/v1/useWallpaperCalc';
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
  /** "결과 공유" 버튼이 링크를 만들 때 쓰는 현재 폼 상태 */
  form: WallpaperFormState;
  /**
   * 결과가 없을 때(!result) 보여줄 한 줄 안내. WallpaperCalculator가 폼 상태를 보고
   * "벽지를 고르면 바로 나와요" / "평형을 고르면 바로 나와요" / "치수를 넣으면 나와요" 중
   * 하나로 미리 계산해 내려준다. 모바일은 하단 고정 바가 이미 같은 문구를 보여주고 있어
   * 이 패널은 PC(lg 이상)에서만 그린다(2026-09-15 중복 제거).
   */
  emptyMessage: string;
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

export default function ResultPanel({ result, range, loading, error, stale, form, emptyMessage,
  onRemoveOldChange, }: ResultPanelProps) {
  // "링크를 복사했어요" 같은 짧은 토스트 메시지
  const [toast, setToast] = useState<string | null>(null);

  // GA4 — 결과 카드가 실제로 화면에 보였을 때(result가 새로 생길 때마다) 1번 기록
  useEffect(() => {
    if (result) track('calc_result_view', { process: 'wallpaper' });
  }, [result]);

  // 빈 상태 — 아직 계산할 값이 없거나(벽지 미선택 / 평형 미입력 / 치수 미입력) 계산이
  // 실패했을 때. 같은 문구를 모바일 하단 고정 바가 이미 보여주고 있어서(2026-09-15 중복
  // 제거 지시), 이 카드는 PC(lg 이상)에서만 그린다 — 모바일은 통째로 숨긴다.
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
  // 로스 근거 라벨: 실제/추정/면적 기준으로 문구가 달라진다(설계 정본 카드1 규칙)
  const lossLabel =
    quantity.lossMode === '실제'
      ? `실제 로스 ${quantity.lossPct}%`
      : quantity.lossMode === '면적'
        ? `면적 기준 로스 ${quantity.lossPct}%`
        : `추정 로스 ${quantity.lossPct}%`;

  // 큰 숫자는 훅이 계산해 준 범위(범위가 없으면 이 결과 자체의 min~max)를 쓴다.
  // 지금은 항상 한 번만 계산하므로 range는 사실상 늘 result.cost.min~max와 같다.
  const bigRange = range ?? { min: cost.min, max: cost.max };

  // 로딩 중이거나 이전 값을 보여주는 중이거나, 방금 계산이 실패해 예전 값을 그대로 보여주는
  // 중이면 카드 전체를 옅게 한다(깜빡임 방지 규칙 + 검사관 지적 12번)
  const dim = loading || stale || !!error;

  /** "결과 공유" — 모바일은 공유 시트가 있으면 그것부터, 아니면 링크 복사 */
  async function handleShare() {
    track('calc_cta_click', { process: 'wallpaper', target: 'share' });
    // 지금 모드에서 안 쓰는 값(예: simple인데 실측 방 목록)은 링크에 안 싣는다 — 폼 상태
    // 원본(form)은 그대로 두고 공유용 사본만 깎는다(검사관 2라운드 지적 3번)
    const url = `${window.location.origin}/calc/wallpaper/result?d=${encodeWallpaperForm(trimFormForShare(form))}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: '얼마드나 도배 계산 결과', url });
        return;
      } catch (e) {
        // 사용자가 공유 시트를 취소한 것(AbortError)이면 아무 것도 안 하고 조용히 끝낸다
        // (검사관 지적 15번 — 취소했는데 클립보드 폴백·토스트가 뜨는 건 잘못된 안내)
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // 그 외 실패(공유 시트 자체가 오류)는 아래 클립보드 복사로 폴백한다
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
      {/* 결과가 있는 상태에서 방금 계산이 실패했으면(예: 값 바꾸다 5평 미만 등) 침묵하지 않고
          알려준다 — 아래 카드와 달리 옅어지지 않게 dim 바깥에 둔다(검사관 지적 12번) */}
      {error && (
        <p className="text-[13px] text-danger mb-2">마지막 계산에 실패해 이전 값이에요</p>
      )}
      {/* 결과 카드 — 이 화면에서 테두리 카드는 이거 하나뿐이다(카드 속 카드 금지 원칙).
          물량 → 부자재 → 비용 순서를 얇은 구분선(구획 제목 17/700)으로만 나눈다. */}
      <Card className={`transition-opacity duration-150 ${dim ? 'opacity-60' : ''}`}>
        {/* 물량 */}
        <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
          {formatNum(quantity.rolls)}롤
        </div>
        <p className="text-[15px] text-foreground leading-[1.6] tabular-nums">
          벽 {quantity.wallSqm}㎡ · 천장 {quantity.ceilingSqm}㎡ · {lossLabel}
        </p>
        {/* 간단(평형/㎡) 모드일 때만 "34평 · 84㎡" 병기 — 실측·벽 길이는 이미
            실제 치수라 공급/전용 개념이 없다(2026-09-15 형아 지시 ㎡ 모드 추가) */}
        {quantity.inputMode === '평형' && describeAreaPair(form) && (
          <p className="text-[13px] text-v1-text-disabled tabular-nums">{describeAreaPair(form)}</p>
        )}
        {/* 면적(벽 길이) 모드는 방별 물량이 없어 "실별 보기"가 뜻이 없다 — 숨긴다(검사관 지적 17번) */}
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

        {/* 부자재 — 구획 제목(17/700) + 얇은 구분선으로 물량과 나눈다(카드 속 카드 금지) */}
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
              {/* 근거 등급이 C(추정)면 근거줄 끝에 "· 추정"을 덧붙인다. 단 basis 자체에 이미
                  "추정"이 들어 있으면(계수 문구에 포함된 경우) 중복으로 안 붙인다(검사관 지적 7번) */}
              <p className="text-[13px] text-v1-text-disabled tabular-nums">
                {s.basis}
                {s.grade === 'C' && !s.basis.includes('추정') ? ' · 추정' : ''}
              </p>
            </div>
          ))}
        </div>

        {/* 비용 — 구획 제목(17/700) + 얇은 구분선으로 부자재와 나눈다 */}
        <h2 className="text-[17px] font-bold text-foreground border-t border-v1-line-2 pt-3 mt-1">비용</h2>
        {/* 금액과 단위는 줄바꿈으로 갈라지면 안 되므로(디자인 가이드 원칙) whitespace-nowrap.
            배지가 자리 부족하면 배지만 다음 줄로 내려가게 flex-wrap 허용 */}
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
        {/* 구성 보기 — 2026-09-09 형아 결정: 기본으로 전부 펼쳐 보여준다(접을 수는 있다).
            견적은 전부 구축 기준이라 맨 위에 "기존 벽지 제거" 토글을 두고 사용자가 보고 판단한다. */}
        <Collapsible
          title="구성 보기"
          defaultOpen
          onOpen={() => track('calc_detail_open', { process: 'wallpaper' })}
        >
          <div className="flex flex-col">
            <div className="py-[10px] border-b border-v1-line-2 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-[2px] min-w-0">
                <span className="text-[15px] text-foreground">기존 벽지 제거</span>
                <span className="text-[13px] text-v1-text-disabled">구축 기준 견적 · 끄면 철거비를 뺍니다</span>
              </div>
              <Toggle
                checked={form.removeOld ?? true}
                onChange={onRemoveOldChange}
                label="기존 벽지 제거 포함"
                className="flex-none"
              />
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
