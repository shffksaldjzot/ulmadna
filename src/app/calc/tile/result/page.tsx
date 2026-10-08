// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 공유 결과 화면 (서버 컴포넌트)
//
// URL의 d(폼 상태 인코딩)를 풀어 → 모양 검사(sanitizeTileForm) → 계산기 화면과 같은
// 요청 변환(buildTileRequestFull) → API와 같은 검증(parseInput) → calcTile을 서버에서 직접 돌린다.
// 단가 로직이 브라우저로 새지 않고, 계산기에서 본 금액과 같은 값이 나온다.
// 본문은 계산기와 같은 ResultBody(9단)를 그대로 쓴다(등급 칸은 누를 수 없는 표시만).
// 무엇이 터지든 500 대신 "조건을 다시 넣어 주세요"로 떨어진다(safeCalc).
//
// 작성일: 2026년 10월 03일
// 개편(9단 본문 공용화): 2026년 10월 08일
// ──────────────────────────────────────────────

import Link from 'next/link';
import type { Metadata } from 'next';
import TopNav from '@/components/v1/TopNav';
import Card from '@/components/v1/Card';
import Disclaimer from '@/components/v1/Disclaimer';
import Button from '@/components/v1/Button';
import { calcTile, TileIncompleteError, type TileCalcResult } from '@/server/calc/tile';
import { parseInput, ValidationError } from '@/server/calc/validate/tile';
import { decodeTileForm } from '@/lib/v1/tileQuery';
import { buildTileRequestFull, sanitizeTileForm } from '@/lib/v1/tileEngineInput';
import type { TileCalcResultDTO } from '@/lib/v1/useTileCalc';
import { PostToBoardCheckbox, ResultFab } from '../../_components/ResultActions';
import CalcContactCta from '../../_components/CalcContactCta';
import { safeCalc } from '../../_components/resultGuard';
import ResultBody from '../ResultBody';

export const metadata: Metadata = {
  title: '타일 견적 결과 — 얼마드나',
  alternates: { canonical: 'https://ulmadna.com/calc/tile' },
  // 사람마다 조건이 다른 결과라 검색에 안 잡히게
  robots: { index: false, follow: true },
};

type Outcome = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; result: TileCalcResult; dimsAssumed: boolean };

/** 폼 상태 → 서버 계산(계산기 화면과 같은 변환·같은 검증) */
function calcFromState(raw: Record<string, unknown>): Outcome {
  const built = buildTileRequestFull(sanitizeTileForm(raw));
  if (!built) return { kind: 'empty' };
  try {
    return { kind: 'ok', result: calcTile(parseInput(built.request)), dimsAssumed: built.dimsAssumed };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof TileIncompleteError) return { kind: 'invalid' };
    throw e;
  }
}

interface PageProps {
  searchParams: Promise<{ d?: string }>;
}

export default async function TileResultPage({ searchParams }: PageProps) {
  const { d } = await searchParams;
  const decoded = decodeTileForm(d);
  const outcome: Outcome = decoded
    ? safeCalc(
        () => calcFromState(decoded),
        () => ({ kind: 'invalid' as const }),
      )
    : { kind: 'empty' };
  const backHref = d ? `/calc/tile?d=${d}` : '/calc/tile';

  const changeLink = (
    <Link href={backHref} className="text-[16px] font-semibold text-brown">
      조건 바꾸기
    </Link>
  );

  if (outcome.kind !== 'ok') {
    return (
      <>
        <TopNav title="타일 견적 계산기" backHref="/calc" rightSlot={changeLink} />
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

  // 서버 결과와 화면 DTO는 같은 모양 — JSON으로 한 번 돌려 순수 데이터만 클라이언트 본문에 넘긴다
  const dto = JSON.parse(JSON.stringify(outcome.result)) as TileCalcResultDTO;

  return (
    <>
      <TopNav title="타일 견적 계산기" backHref="/calc" rightSlot={changeLink} />

      <div className="px-5 py-4 pb-40 lg:pb-8 flex flex-col gap-4 max-w-[720px] mx-auto">
        <ResultBody
          result={dto}
          dimsAssumed={outcome.dimsAssumed}
          actions={
            <div className="flex flex-col gap-4">
              <PostToBoardCheckbox />
              <CalcContactCta />
              <Disclaimer />
            </div>
          }
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-5 pb-4 pt-2 flex flex-col gap-3 max-w-[720px] mx-auto lg:static lg:max-w-[720px] lg:px-0 lg:pb-8">
        <div className="flex justify-end">
          <ResultFab shareText="얼마드나 타일 견적 결과를 확인해 보세요" />
        </div>
      </div>
    </>
  );
}
