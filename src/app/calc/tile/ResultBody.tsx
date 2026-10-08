// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 결과 카드 본문(9단)
//
// 계산기 화면(ResultPanel)과 공유 결과 화면(result/page.tsx)이 같은 본문을 쓴다 — 두 화면의 숫자·순서가
// 어긋나지 않게. 순서(2026-10-08 개편, 토리 설계):
//   ① 총액 범위 + 등급 3단(보급·중급·고급 — 누르면 등급이 바뀐다) + 가정 1줄 + 경고 1개
//   ② 자재 — 박스 수(면적·로스·박스당), 접착제(kg), 떠붙임 몰탈, 줄눈재, 방수, 코너비드·실리콘·소모품
//   ③ 인건 — 기공·조공 일수, 에폭시 줄눈 시공, 양중
//   ④ 철거·폐기물(+ 일반경비)
//   ⑤ 왜 이 가격 — 자재/인건/철거/경비 비율 막대
//   ⑥ 절약 팁 3줄
//   ⑦ 시장 견적 비교 4종(접힘)
//   ⑧ 자주 틀리는 것(접힘)
//   ⑨ 블로그 글·공유·문의 — actions로 부모가 넣는다
// 추정 단가(등급 C)가 쓰인 줄에는 작은 "추정" 표식을 붙인다.
//
// 금액만 있고 단가는 없다 — 서버가 단가를 내보내지 않기 때문(단가 보호).
//
// 작성일: 2026년 10월 08일
// ──────────────────────────────────────────────

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import type { TileCalcResultDTO, TileCostLineDTO } from '@/lib/v1/useTileCalc';
import type { TileGrade } from '@/lib/v1/tilePresets';
import { track } from '@/lib/analytics';
import { dimTransitionStyle } from '../_components/dimTransition';
import {
  assumptionLine,
  commonMistakes,
  costGroups,
  formatWonRange,
  GRADE_LABEL,
  lineDetail,
  lineQty,
  savingTips,
  shareBars,
  summaryLine,
  warningOf,
} from './resultText';
import { TILE_RELATED_POSTS } from './relatedPosts';

export interface ResultBodyProps {
  result: TileCalcResultDTO;
  /** 계산 중(옛 값) — 흐리게 */
  dim?: boolean;
  /** 정확 모드 치수 미입력 — 기본 치수로 계산 중 */
  dimsAssumed?: boolean;
  /** 등급 카드를 눌렀을 때(없으면 누를 수 없는 표시만 — 공유 화면) */
  onGradeChange?: (g: TileGrade) => void;
  /** ⑨ 공유·문의 버튼 자리 */
  actions?: ReactNode;
}

/** 작은 "추정" 표식 */
function EstTag() {
  return <span className="ml-1 text-[11px] text-v1-text-disabled align-middle whitespace-nowrap">추정</span>;
}

/** 비용 한 줄 — 이름·수량 / 설명 / 금액 */
function CostRow({ line, result }: { line: TileCostLineDTO; result: TileCalcResultDTO }) {
  return (
    <div className="py-[6px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] text-foreground min-w-0">
          {line.name}
          {line.grade === 'C' && <EstTag />}
        </span>
        <span className="text-[14px] text-foreground tabular-nums whitespace-nowrap flex-none">{formatWonRange(line.amountMin, line.amountMax)}</span>
      </div>
      <p className="text-[12px] text-v1-text-disabled tabular-nums">
        {[lineQty(line), lineDetail(line, result)].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

/** 묶음 머리(번호 없는 소제목 + 소계) */
function GroupHead({ title, min, max }: { title: string; min: number; max: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-3">
      <span className="text-[13px] font-semibold text-v1-text-label">{title}</span>
      <span className="text-[13px] font-semibold text-v1-text-label tabular-nums whitespace-nowrap">{formatWonRange(min, max)}</span>
    </div>
  );
}

/** 막대 칸 색 — 강조색 하나(갈색)를 진하기만 달리 */
const BAR_TONE: Record<string, string> = {
  material: 'bg-brown',
  labor: 'bg-brown/60',
  demolish: 'bg-brown/35',
  overhead: 'bg-brown/15',
};

export default function ResultBody({ result, dim = false, dimsAssumed = false, onGradeChange, actions }: ResultBodyProps) {
  const self = result.resolved.service === 'self';
  const q = result.quantity;
  const assumed = assumptionLine(result, dimsAssumed);
  const warning = warningOf(result);
  const groups = costGroups(result);
  const bars = shareBars(result);
  const tips = savingTips(result);
  const mistakes = commonMistakes(result);
  const boxesText = [q.wall ? `벽 ${formatNum(q.wall.boxes)}` : null, q.floor ? `바닥 ${formatNum(q.floor.boxes)}` : null].filter(Boolean).join(' · ');
  const fade = { className: `transition-opacity ${dim ? 'opacity-60' : ''}`, style: dimTransitionStyle(dim) };

  return (
    <>
      {/* ① 총액 + 등급 3단 */}
      <Card>
        <div {...fade} className={`flex flex-col gap-2 ${fade.className}`}>
          <p className="t-sub text-ink-2">{summaryLine(result)}</p>
          {self ? (
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">{boxesText}</span>
              <span className="text-[20px] font-semibold text-foreground">박스</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
                {formatManRange(result.cost.min, result.cost.max)}
              </span>
              <span className="text-[13px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[8px] py-[1px] whitespace-nowrap">추정</span>
            </div>
          )}

          {/* 등급 3단 — 셀프면 자재비, 맡김이면 총액 */}
          <div className="grid grid-cols-3 gap-2 pt-1" role={onGradeChange ? 'radiogroup' : undefined} aria-label="자재 등급">
            {(['basic', 'mid', 'high'] as const).map((g) => {
              const t = result.cost.gradeTotals[g];
              const on = result.resolved.grade === g;
              const inner = (
                <>
                  <span className={`block text-[13px] ${on ? 'font-semibold text-ink' : 'text-ink-2'}`}>{GRADE_LABEL[g]}</span>
                  <span className={`block text-[13px] tabular-nums whitespace-nowrap ${on ? 'font-semibold text-brown' : 'text-ink-2'}`}>
                    {toMan(t.min).toLocaleString('ko-KR')}~{toMan(t.max).toLocaleString('ko-KR')}만
                  </span>
                </>
              );
              const cls = `min-h-11 rounded-[6px] px-2 py-[6px] text-left border ${on ? 'border-accent border-2 bg-white' : 'border-v1-line-3 bg-white'}`;
              return onGradeChange ? (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cls}
                  onClick={() => {
                    if (!on) track('calc_cta_click', { process: 'tile', target: `grade_${g}` });
                    onGradeChange(g);
                  }}
                >
                  {inner}
                </button>
              ) : (
                <div key={g} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>

          {assumed && <p className="t-sub text-ink-2">{assumed}</p>}
          {warning && <p className="t-sub text-danger">{warning}</p>}
        </div>
      </Card>

      {/* ②③④ 구성 — 자재 / 인건 / 철거 */}
      <Card>
        <div {...fade} className={`flex flex-col ${fade.className}`}>
          <GroupHead title="자재" min={groups.material.min} max={groups.material.max} />
          {groups.material.lines.map((l) => (
            <CostRow key={l.key} line={l} result={result} />
          ))}

          {!self && (
            <>
              <div className="border-t border-v1-line-2 mt-2" />
              <GroupHead title="인건" min={groups.labor.min} max={groups.labor.max} />
              {groups.labor.lines.map((l) => (
                <CostRow key={l.key} line={l} result={result} />
              ))}

              <div className="border-t border-v1-line-2 mt-2" />
              {groups.demolish.lines.length > 0 ? (
                <>
                  <GroupHead title="철거·폐기물" min={groups.demolish.min} max={groups.demolish.max} />
                  {groups.demolish.lines.map((l) => (
                    <CostRow key={l.key} line={l} result={result} />
                  ))}
                </>
              ) : (
                <p className="pt-3 text-[13px] text-v1-text-label">철거 없음 · {result.resolved.methodLabel}</p>
              )}
              {groups.overhead.lines.map((l) => (
                <CostRow key={l.key} line={l} result={result} />
              ))}
            </>
          )}
          <p className="text-[12px] text-v1-text-disabled pt-2">{result.cost.basisLine} · 부가세 포함</p>
        </div>
      </Card>

      {/* ⑤ 왜 이 가격 */}
      {!self && bars.length > 1 && (
        <section aria-label="왜 이 가격" className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold text-v1-text-label">왜 이 가격</h2>
          <div className="flex h-3 rounded-full overflow-hidden" aria-hidden="true">
            {bars.map((b) => (
              <span key={b.key} className={BAR_TONE[b.key]} style={{ width: `${b.pct}%` }} />
            ))}
          </div>
          <p className="t-sub text-ink-2 tabular-nums flex flex-wrap gap-x-3">
            {bars.map((b) => (
              <span key={b.key} className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className={`inline-block w-2 h-2 rounded-full ${BAR_TONE[b.key]}`} aria-hidden="true" />
                {b.label} {b.pct}%
              </span>
            ))}
          </p>
        </section>
      )}

      {/* ⑥ 절약 팁 */}
      <section aria-label="절약 팁" className="flex flex-col gap-1">
        <h2 className="text-[13px] font-semibold text-v1-text-label">아끼려면</h2>
        <ul className="flex flex-col gap-1">
          {tips.map((t) => (
            <li key={t} className="t-body text-ink">
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ⑦ 시장 견적 비교 · ⑧ 자주 틀리는 것 */}
      <div className="flex flex-col">
        <Collapsible title="시장 견적 비교" onOpen={() => track('calc_detail_open', { process: 'tile', section: 'market' })}>
          <div className="flex flex-col py-1">
            {result.marketRefs.map((m) => {
              const mine = result.marketRef?.key === m.key;
              return (
                <div key={m.key} className="min-h-10 flex items-center justify-between gap-3 border-b border-v1-line-2 last:border-b-0">
                  <span className={`text-[14px] ${mine ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                    {m.label}
                    <span className="text-[12px] text-v1-text-disabled"> · {m.n}건</span>
                  </span>
                  <span className={`text-[14px] tabular-nums whitespace-nowrap ${mine ? 'font-semibold text-brown' : 'text-ink-2'}`}>{formatWonRange(m.p25, m.p75)}</span>
                </div>
              );
            })}
            <p className="text-[12px] text-v1-text-disabled pt-2">실제 견적서 하위 25%~상위 25%</p>
          </div>
        </Collapsible>
        <Collapsible title="자주 틀리는 것" onOpen={() => track('calc_detail_open', { process: 'tile', section: 'mistakes' })}>
          <ul className="flex flex-col gap-1 py-2 list-disc pl-5">
            {mistakes.map((t) => (
              <li key={t} className="text-[14px] text-foreground">
                {t}
              </li>
            ))}
          </ul>
        </Collapsible>
      </div>

      {/* ⑨ 블로그 글 · 공유 · 문의 */}
      <section aria-label="관련 글" className="flex flex-col gap-1">
        <h2 className="text-[13px] font-semibold text-v1-text-label">더 읽기</h2>
        {TILE_RELATED_POSTS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="min-h-10 flex items-center text-[14px] text-ink underline-offset-2 hover:underline hover:text-brown"
            onClick={() => track('calc_cta_click', { process: 'tile', target: 'blog' })}
          >
            {p.label}
          </Link>
        ))}
      </section>
      {actions}
    </>
  );
}
