// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 결과 카드
//
// 순서(설계서 §5-5, 미장 결과 카드와 같은 틀):
//   ① 맨 위 — 맡김: 금액 범위(중간·추정) / 셀프: 박스 수
//   ② 요약 줄(진하게) — 맡김: "벽 300×600 12박스 · 바닥 300×300 4박스" / 셀프: 자재비 범위
//   ③ 보조 줄 — 면적·로스·줄눈재·압착시멘트·품
//   ④ 가정 줄(있을 때만) ⑤ 근거 줄(견적DB n건 범위) ⑥ 경고 1개(덧방)
//   ⑦ 실별 보기 · 구성 보기 · 현장 확인(작게 접힘)
//   ⑧ 공유 · 직접 문의 · 관련 계산기 · 고지
//
// 수량도 금액도 서버 응답 하나에서 온다(계수가 서버에만 있어서) — 계산 중이면 통째로 흐리게 한다.
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Button from '@/components/v1/Button';
import Disclaimer from '@/components/v1/Disclaimer';
import Toast, { showToast } from '@/components/v1/Toast';
import CalcContactCta from '../_components/CalcContactCta';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { encodeTileForm, type TileFormState } from '@/lib/v1/tileQuery';
import type { TileCalcResultDTO, TileCostLineDTO } from '@/lib/v1/useTileCalc';
import { dimTransitionStyle } from '../_components/dimTransition';
import { assumptionLine, checkTexts, LARGE_OVERLAY_WARNING, quantityChunks, subChunks } from './resultText';

export interface ResultPanelProps {
  result: TileCalcResultDTO | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  /** 단계가 전부 끝났는지 — 공유 버튼 노출 판정 */
  allDone: boolean;
  form: TileFormState;
  /** 결과가 없을 때 한 줄(PC에서만, 모바일은 하단 바가 보여 준다) */
  emptyMessage: string;
}

/** 비용 층 순서 */
const LAYER_ORDER: TileCostLineDTO['layer'][] = ['자재', '부자재', '철거', '방수', '인건', '경비'];

/** 1만 원 미만은 천 원 단위로, 그 이상은 만 원 범위로 */
function formatWonRange(min: number, max: number): string {
  if (max < 10000) {
    const a = Math.round(min / 1000);
    const b = Math.round(max / 1000);
    return a === b ? `${a}천원` : `${a}천~${b}천원`;
  }
  return formatManRange(min, max);
}

export default function ResultPanel({ result, loading, error, stale, allDone, form, emptyMessage }: ResultPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  if (!result) {
    return (
      <>
        {error && <p className="text-[13px] text-danger mb-2">계산하지 못했어요</p>}
        <div className="hidden lg:block">
          <Card>
            <p className="text-[15px] text-v1-text-secondary">{loading ? '계산 중' : emptyMessage}</p>
          </Card>
        </div>
      </>
    );
  }

  const dim = loading || stale;
  const self = result.resolved.service === 'self';
  const q = result.quantity;
  const assumed = assumptionLine(result, form);
  const checks = checkTexts(result);
  const largeWarn = result.checks.includes('largeOverlay');
  const materialMin = result.cost.breakdown.filter((l) => l.layer === '자재' || l.layer === '부자재').reduce((s, l) => s + l.amountMin, 0);
  const materialMax = result.cost.breakdown.filter((l) => l.layer === '자재' || l.layer === '부자재').reduce((s, l) => s + l.amountMax, 0);

  // 공유 — 단계 완료 + 계산 실패 아님 + 치수 가정이 안 남았을 때만
  const canShare = allDone && !error && !result.assumed.includes('dims') && !result.assumed.includes('rooms');

  async function handleShare() {
    const url = `${window.location.origin}/calc/tile/result?d=${encodeTileForm(form)}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: '얼마드나 타일 계산 결과', url });
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

  const groups = LAYER_ORDER.map((layer) => {
    const lines = result.cost.breakdown.filter((b) => b.layer === layer);
    return { layer, lines, subMin: lines.reduce((s, l) => s + l.amountMin, 0), subMax: lines.reduce((s, l) => s + l.amountMax, 0) };
  }).filter((g) => g.lines.length > 0);

  const boxesText = [q.wall ? `벽 ${formatNum(q.wall.boxes)}` : null, q.floor ? `바닥 ${formatNum(q.floor.boxes)}` : null].filter(Boolean).join(' · ');

  return (
    <>
      {error && <p className="text-[13px] text-danger mb-2">다시 계산하지 못했어요 — 직전 결과예요</p>}
      <Card>
        <div className={`flex flex-col gap-2 transition-opacity ${dim ? 'opacity-60' : ''}`} style={dimTransitionStyle(dim)}>
          {/* ① 맨 위 */}
          {self ? (
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">{boxesText}</span>
              <span className="text-[20px] font-semibold text-foreground">박스</span>
            </div>
          ) : (
            <div>
              <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
                {formatManRange(result.cost.min, result.cost.max)}
              </div>
              <p className="t-body font-semibold text-ink-2 tabular-nums flex items-center gap-2">
                중간 {toMan(result.cost.mid).toLocaleString('ko-KR')}만원
                <span className="text-[13px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">추정</span>
              </p>
            </div>
          )}

          {/* ② 요약 줄 — 진하게 */}
          <p className="t-body font-semibold text-ink tabular-nums pt-2 border-t border-v1-line-2 flex flex-wrap gap-x-1">
            {(self ? [`자재비 ${formatManRange(materialMin, materialMax)}`] : quantityChunks(result)).map((c, i, arr) => (
              <span key={i} className="whitespace-nowrap">
                {c}
                {i < arr.length - 1 ? ' ·' : ''}
              </span>
            ))}
          </p>

          {/* ③ 보조 줄 */}
          <p className="t-sub text-ink-2 tabular-nums flex flex-wrap gap-x-1">
            {subChunks(result).map((c, i, arr) => (
              <span key={i} className="whitespace-nowrap">
                {c}
                {i < arr.length - 1 ? ' ·' : ''}
              </span>
            ))}
          </p>

          {/* ④ 가정 */}
          {assumed && <p className="t-sub text-ink-2">{assumed}</p>}

          {/* ⑤ 근거 */}
          <p className="t-sub text-ink-2 tabular-nums">
            {result.cost.basisLine}
            {result.marketRef
              ? ` · 견적DB ${result.marketRef.n}건 ${result.marketRef.label} ${formatWonRange(result.marketRef.p25, result.marketRef.p75)}`
              : ''}
          </p>

          {/* ⑥ 경고 — 화면당 1개 */}
          {largeWarn && <p className="t-sub text-danger">{LARGE_OVERLAY_WARNING}</p>}
        </div>

        {/* ⑦ 실별 보기 */}
        {q.byRoom.length > 1 && (
          <Collapsible title="실별 보기">
            <div className="flex flex-col">
              {q.byRoom.map((r, i) => (
                <div key={r.key} className={`min-h-11 py-2 flex items-center justify-between gap-3 ${i === q.byRoom.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  <span className="text-[15px] text-foreground truncate">{r.name}</span>
                  <span className="text-[14px] text-v1-text-secondary tabular-nums whitespace-nowrap">
                    {[r.wallSqm > 0 ? `벽 ${formatNum(r.wallSqm)}㎡ ${r.wallBoxes}박스` : null, r.floorSqm > 0 ? `바닥 ${formatNum(r.floorSqm)}㎡ ${r.floorBoxes}박스` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        {/* 구성 보기 — 작게 */}
        <div className={`transition-opacity ${dim ? 'opacity-60' : ''}`} style={dimTransitionStyle(dim)}>
          <Collapsible title="구성 보기">
            <div className="flex flex-col">
              {groups.map((g) => (
                <div key={g.layer} className="py-[10px] border-b border-v1-line-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-v1-text-label">{g.layer}</span>
                    <span className="text-[13px] font-semibold text-v1-text-label tabular-nums whitespace-nowrap">{formatWonRange(g.subMin, g.subMax)}</span>
                  </div>
                  {g.lines.map((l) => (
                    <div key={l.key} className="py-[4px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] text-foreground min-w-0 truncate">{l.name}</span>
                        <span className="text-[14px] text-foreground tabular-nums whitespace-nowrap flex-none">
                          {l.key === 'overhead' ? '' : `${formatNum(l.qty)}${l.unit} · `}
                          {formatWonRange(l.amountMin, l.amountMax)}
                        </span>
                      </div>
                      <p className="text-[12px] text-v1-text-disabled">
                        {l.note}
                        {l.grade === 'C' && !l.note.includes('추정') ? ' · 추정' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
              <p className="text-[12px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
            </div>
          </Collapsible>
        </div>

        {/* 현장 확인 */}
        <Collapsible title="현장 확인">
          <ul className="flex flex-col gap-1 py-2 list-disc pl-5">
            {checks.map((t) => (
              <li key={t} className="text-[14px] text-foreground">
                {t}
              </li>
            ))}
          </ul>
        </Collapsible>
      </Card>

      <div className="flex flex-col gap-4 mt-4">
        {canShare && (
          <Button variant="secondary" fullWidth onClick={handleShare}>
            결과 공유
          </Button>
        )}
        <CalcContactCta />
        <p className="t-sub text-ink-2">
          관련 계산기{' '}
          <Link href="/calc/mortar" className="underline underline-offset-2 hover:text-brown">
            몰탈
          </Link>{' '}
          ·{' '}
          <Link href="/calc/flooring" className="underline underline-offset-2 hover:text-brown">
            바닥재
          </Link>
        </p>
        <Disclaimer />
      </div>
      <Toast message={toast} />
    </>
  );
}
