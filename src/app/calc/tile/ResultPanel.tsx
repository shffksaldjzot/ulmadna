// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 결과 패널(계산기 화면용 껍데기)
//
// 본문(9단)은 ResultBody가 그린다 — 공유 결과 화면과 같은 본문을 쓰려고 나눴다.
// 이 파일은 계산기 화면에만 있는 것을 맡는다:
//   · 결과가 없을 때 한 줄(PC) / 계산 실패 문구
//   · 결과 노출 추적(calc_result_view) · 공유 버튼(링크 복사, calc_cta_click share)
//   · 문의 버튼 · 고지
// 공유 버튼은 단계를 다 끝냈고, 치수 가정(기본 치수로 계산)이 없을 때만 보인다.
//
// 작성일: 2026년 10월 03일
// 개편(9단 본문 분리·추적): 2026년 10월 08일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/v1/Card';
import Button from '@/components/v1/Button';
import Disclaimer from '@/components/v1/Disclaimer';
import Toast, { showToast } from '@/components/v1/Toast';
import CalcContactCta from '../_components/CalcContactCta';
import { encodeTileForm, type TileFormState } from '@/lib/v1/tileQuery';
import type { TileCalcResultDTO } from '@/lib/v1/useTileCalc';
import type { TileGrade } from '@/lib/v1/tilePresets';
import { track } from '@/lib/analytics';
import ResultBody from './ResultBody';

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
  /** 정확 모드 치수 미입력 — 기본 치수로 즉답 중 */
  dimsAssumed: boolean;
  /** 등급 카드 누름 */
  onGradeChange: (g: TileGrade) => void;
}

export default function ResultPanel({ result, loading, error, stale, allDone, form, emptyMessage, dimsAssumed, onGradeChange }: ResultPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  // GA4 — 결과 카드가 새로 생길 때마다 1번(도배 계산기와 같은 방식)
  useEffect(() => {
    if (result) track('calc_result_view', { process: 'tile' });
  }, [result]);

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

  // 공유 — 단계 완료 + 계산 실패 아님 + 기본 치수 가정이 안 남았을 때만
  const canShare = allDone && !error && !dimsAssumed;

  async function handleShare() {
    track('calc_cta_click', { process: 'tile', target: 'share' });
    const url = `${window.location.origin}/calc/tile/result?d=${encodeTileForm(form)}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: '얼마드나 타일 견적 결과', url });
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
      {error && <p className="text-[13px] text-danger">다시 계산하지 못했어요 — 직전 결과예요</p>}
      <ResultBody
        result={result}
        dim={loading || stale}
        dimsAssumed={dimsAssumed}
        onGradeChange={onGradeChange}
        actions={
          <div className="flex flex-col gap-4">
            {canShare && (
              <Button variant="secondary" fullWidth onClick={handleShare}>
                결과 공유
              </Button>
            )}
            <CalcContactCta />
            <Disclaimer />
          </div>
        }
      />
      <Toast message={toast} />
    </>
  );
}
