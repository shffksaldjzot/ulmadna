// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 공유 결과 화면 (서버 컴포넌트)
//
// URL의 d(폼 상태 인코딩)를 풀어 → 모양 검사(sanitizeTileForm) → 계산기 화면과 같은
// 요청 변환(buildTileRequest) → API와 같은 검증(parseInput) → calcTile을 서버에서 직접 돌린다.
// 단가 로직이 브라우저로 새지 않고, 계산기에서 본 금액과 같은 값이 나온다.
// 무엇이 터지든 500 대신 "조건을 다시 넣어 주세요"로 떨어진다(safeCalc).
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import Link from 'next/link';
import type { Metadata } from 'next';
import TopNav from '@/components/v1/TopNav';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Disclaimer from '@/components/v1/Disclaimer';
import Button from '@/components/v1/Button';
import { calcTile, type TileCalcResult } from '@/server/calc/tile';
import { parseInput, ValidationError } from '@/server/calc/validate/tile';
import { decodeTileForm, type TileFormState } from '@/lib/v1/tileQuery';
import { buildTileRequest, sanitizeTileForm } from '@/lib/v1/tileEngineInput';
import { TILE_SCOPES } from '@/lib/v1/tilePresets';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import type { TileCalcResultDTO } from '@/lib/v1/useTileCalc';
import { PostToBoardCheckbox, ResultFab } from '../../_components/ResultActions';
import CalcContactCta from '../../_components/CalcContactCta';
import { safeCalc } from '../../_components/resultGuard';
import { assumptionLine, checkTexts, quantityChunks, subChunks } from '../resultText';

export const metadata: Metadata = {
  title: '타일 계산기 결과 — 얼마드나',
  alternates: { canonical: 'https://ulmadna.com/calc/tile' },
  // 사람마다 조건이 다른 결과라 검색에 안 잡히게
  robots: { index: false, follow: true },
};

type Outcome = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; result: TileCalcResult };

/** 폼 상태 → 서버 계산(계산기 화면과 같은 변환·같은 검증) */
function calcFromState(state: TileFormState): Outcome {
  const req = buildTileRequest(state);
  if (!req) return { kind: 'empty' };
  try {
    return { kind: 'ok', result: calcTile(parseInput(req)) };
  } catch (e) {
    if (e instanceof ValidationError) return { kind: 'invalid' };
    throw e;
  }
}

/** 조건 요약 한 줄(예: "욕실 2칸 · 철거 후 새로 · 300×600") */
function buildSummary(state: TileFormState, r: TileCalcResult): string {
  const parts: string[] = [];
  if (r.resolved.mode === 'simple') parts.push(TILE_SCOPES.find((s) => s.value === state.scope)?.label ?? '');
  else parts.push(`실측 ${r.quantity.byRoom.length}개 실`);
  parts.push(r.resolved.methodLabel);
  if (r.resolved.pyeong) parts.push(`${r.resolved.pyeong}평`);
  parts.push(r.resolved.service === 'self' ? '셀프(자재만)' : '맡김');
  return parts.filter(Boolean).join(' · ');
}

/** 1만 원 미만은 천 원 단위 */
function formatWonRange(min: number, max: number): string {
  if (max < 10000) {
    const a = Math.round(min / 1000);
    const b = Math.round(max / 1000);
    return a === b ? `${a}천원` : `${a}천~${b}천원`;
  }
  return formatManRange(min, max);
}

interface PageProps {
  searchParams: Promise<{ d?: string }>;
}

export default async function TileResultPage({ searchParams }: PageProps) {
  const { d } = await searchParams;
  const decoded = decodeTileForm(d);
  // 모양 검사 — 어떤 값이 와도 던지지 않는 함수지만, 만일을 위해 계산과 함께 safeCalc로 감싼다
  const outcome: Outcome = decoded
    ? safeCalc(
        () => calcFromState(sanitizeTileForm(decoded)),
        () => ({ kind: 'invalid' as const }),
      )
    : { kind: 'empty' };
  const state = decoded ? safeCalc(() => sanitizeTileForm(decoded), () => null) : null;
  const backHref = d ? `/calc/tile?d=${d}` : '/calc/tile';

  const changeLink = (
    <Link href={backHref} className="text-[16px] font-semibold text-brown">
      조건 바꾸기
    </Link>
  );

  if (!state || outcome.kind !== 'ok') {
    return (
      <>
        <TopNav title="타일 계산기" backHref="/calc" rightSlot={changeLink} />
        <div className="px-5 py-4 flex flex-col gap-4 max-w-[720px] mx-auto">
          <Card>
            <p className="text-[15px] text-v1-text-secondary">{outcome.kind === 'invalid' ? '조건을 다시 넣어 주세요' : '조건이 비어 있어요'}</p>
            {outcome.kind === 'invalid' && (
              <Link href="/calc/tile" className="inline-block mt-3">
                <Button>계산기로 가기</Button>
              </Link>
            )}
          </Card>
        </div>
      </>
    );
  }

  const { result } = outcome;
  // 서버 결과와 화면 DTO는 같은 모양 — 문구 함수(resultText)를 그대로 쓴다
  const dto = result as unknown as TileCalcResultDTO;
  const self = result.resolved.service === 'self';
  const assumed = assumptionLine(dto, state);
  const q = result.quantity;
  const boxesText = [q.wall ? `벽 ${formatNum(q.wall.boxes)}` : null, q.floor ? `바닥 ${formatNum(q.floor.boxes)}` : null].filter(Boolean).join(' · ');
  const layers = ['자재', '부자재', '철거', '방수', '인건', '경비'] as const;

  return (
    <>
      <TopNav title="타일 계산기" backHref="/calc" rightSlot={changeLink} />

      <div className="px-5 py-4 pb-40 lg:pb-8 flex flex-col gap-4 max-w-[720px] mx-auto">
        <p className="text-[13px] text-v1-text-secondary tabular-nums">{buildSummary(state, result)}</p>

        <Card>
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
          <p className="t-body font-semibold text-ink tabular-nums pt-2 border-t border-v1-line-2">
            {self
              ? `자재비 ${formatManRange(
                  result.cost.breakdown.reduce((s, l) => s + l.amountMin, 0),
                  result.cost.breakdown.reduce((s, l) => s + l.amountMax, 0),
                )}`
              : quantityChunks(dto).join(' · ')}
          </p>
          <p className="t-sub text-ink-2 tabular-nums">{subChunks(dto).join(' · ')}</p>
          {assumed && <p className="t-sub text-ink-2">{assumed}</p>}
          <p className="t-sub text-ink-2 tabular-nums">
            {result.cost.basisLine}
            {result.marketRef ? ` · 견적DB ${result.marketRef.n}건 ${result.marketRef.label} ${formatWonRange(result.marketRef.p25, result.marketRef.p75)}` : ''}
          </p>

          <Collapsible title="구성 보기" defaultOpen>
            <div className="flex flex-col">
              {layers
                .map((layer) => ({ layer, lines: result.cost.breakdown.filter((l) => l.layer === layer) }))
                .filter((g) => g.lines.length > 0)
                .map((g) => (
                  <div key={g.layer} className="py-[10px] border-b border-v1-line-2">
                    <span className="text-[13px] font-semibold text-v1-text-label">{g.layer}</span>
                    {g.lines.map((l) => (
                      <div key={l.key} className="py-[4px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[14px] text-foreground min-w-0 truncate">{l.name}</span>
                          <span className="text-[14px] text-foreground tabular-nums whitespace-nowrap">
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

          <Collapsible title="현장 확인">
            <ul className="flex flex-col gap-1 py-2 list-disc pl-5">
              {checkTexts(dto).map((t) => (
                <li key={t} className="text-[14px] text-foreground">
                  {t}
                </li>
              ))}
            </ul>
          </Collapsible>
        </Card>

        <PostToBoardCheckbox />
        <CalcContactCta />
        <Disclaimer />
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-5 pb-4 pt-2 flex flex-col gap-3 max-w-[720px] mx-auto lg:static lg:max-w-[720px] lg:px-0 lg:pb-8">
        <div className="flex justify-end">
          <ResultFab shareText="얼마드나 타일 계산 결과를 확인해 보세요" />
        </div>
      </div>
    </>
  );
}
