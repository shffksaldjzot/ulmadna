// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 결과 화면 (도배 result/page.tsx를 그대로 본떠 만듦)
// 서버 컴포넌트에서 calcFlooring()을 직접 호출한다(단가 로직이 클라이언트로 새지 않게).
// URL의 d 쿼리(입력 폼이 인코딩해서 넘긴 값)를 풀어서 계산 입력으로 바꾼다.
//
// 계산 규칙(폼 상태 → 엔진 요청 변환)은 즉답 화면의 훅(useFlooringCalc)과 완전히 같은
// 순수 함수(toEngineInputWithAssumed, src/lib/v1/flooringEngineInput.ts)를 쓴다. 그래야
// 즉답 화면에서 본 금액과 "결과 공유"로 열어 본 이 페이지의 금액이 어긋나지 않는다.
//
// 2026-09-27 지시서 9-4절: 결과 공유 화면에 도배처럼 수량 범위·"제품 미정" 표시를
// 넣는다 — toEngineInput 대신 toEngineInputWithAssumed로 바꿔서 assumed 목록도 같이
// 받고, 즉답 화면과 똑같은 함수(formatUnitsRangeText·describeFlooringAreaAssumptionLine·
// formatCostLineAmount)로 표시한다.
//
// 작성일: 2026년 09월 10일
// 수량 범위·제품 미정 표시 추가(도배 방식 이식): 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

import Link from 'next/link';
import TopNav from '@/components/v1/TopNav';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Disclaimer from '@/components/v1/Disclaimer';
import { calcFlooring } from '@/server/calc/flooring';
import type { FlooringCalcInput, FlooringCalcResult } from '@/server/calc/flooring';
import { FLOORING_PRODUCTS } from '@/server/calc/data/flooring-products';
import { decodeFlooringForm, type FlooringFormState } from '@/lib/v1/flooringQuery';
import { toFlooringProductOptions } from '@/lib/v1/flooringProductOptions';
import {
  toEngineInputWithAssumed,
  describePreciseInput,
  describeAreaPair,
  type FlooringAssumption,
} from '@/lib/v1/flooringEngineInput';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
// 2026-09-15 디자인 통일 작업: 도배 결과 화면에만 있던 저장·공유 기능을 바닥재에도 그대로 붙인다
import { PostToBoardCheckbox, ResultFab } from '../../_components/ResultActions';
import CalcContactCta from '../../_components/CalcContactCta';
// 만 원 미만 원 단위 표기 + 수량 범위 표기 — 즉답 화면(ResultPanel.tsx)과 완전히 같은
// 규칙을 쓰려고 공용 파일(원래 도배 전용이었으나 9장 작업으로 _components/로 옮김)에서 가져온다
import { formatCostLineAmount, formatUnitsRangeText } from '../../_components/costLineFormat';
import { describeFlooringAreaAssumptionLine } from '../../_components/assumptionText';

export const metadata = {
  title: '바닥재 계산기 결과 — 얼마드나',
  // 결과 페이지는 ?d= 조건값에 따라 주소가 무한히 갈라진다(공유 링크마다 다른 주소).
  // 검색엔진에는 전부 "같은 페이지의 변형"이라고 알려주기 위해 canonical을 원본
  // 계산기 페이지로 모아준다(2026-09-14, 형아 지시: 계산기 SEO 정비).
  alternates: { canonical: 'https://ulmadna.com/calc/flooring' },
};

/**
 * 폼 상태 → 서버 계산 결과 + 가정 목록.
 * 즉답 화면의 훅과 같은 toEngineInputWithAssumed로 요청을 만들어, 같은 조건이면 같은
 * 금액이 나오게 한다. null이면(종류 미선택) 이 함수도 null을 돌려주고, 페이지가 "조건이
 * 비어 있어요" 빈 상태를 보여준다.
 */
function calcFromState(
  state: FlooringFormState,
  products: ReturnType<typeof toFlooringProductOptions>,
): { result: FlooringCalcResult; assumed: FlooringAssumption[] } | null {
  const engineInput = toEngineInputWithAssumed(state, products);
  if (!engineInput) return null;
  // toEngineInput(순수 함수)이 만드는 요청 모양은 공통 규칙 문서 API 계약을 그대로
  // 따랐고, calcFlooring(실제 엔진)의 FlooringCalcInput도 같은 계약이라 필드가 그대로 맞는다.
  return { result: calcFlooring(engineInput.request as FlooringCalcInput), assumed: engineInput.assumed };
}

/** 조건 요약 1줄 (예: "34평 · 3베이 · 전체 · 마루 · 구축 기준 · 철거 제외") */
function buildSummary(state: FlooringFormState): string {
  const parts: string[] = [];
  const precise = describePreciseInput(state);
  if (precise?.kind === 'room') {
    parts.push(`실측 ${precise.count}개 실`);
  } else {
    // 간단 모드 — 평형(공급) 또는 ㎡(전용) 중 지금 쓰는 값을 "34평 · 84㎡"로 병기한다
    parts.push(describeAreaPair(state) ?? `${state.pyeong}평`, `${state.bay ?? 3}베이`);
    // 범위(전체/방만/거실·주방·복도)는 실측 모드에선 뜻이 없다 — 평형 모드일 때만 요약줄에 넣는다
    parts.push(state.scope === '방만' ? '방만' : state.scope === '거실주방' ? '거실·주방·복도' : '전체');
  }

  // 이 함수가 불리는 시점엔 이미 계산이 성공한 뒤라 kind는 항상 있다.
  parts.push(state.kind as string);

  // 견적은 전부 구축 기준. 철거·걸레받이를 껐을 때만 그 사실을 적는다
  parts.push('구축 기준');
  if (state.removeOld === false) parts.push('철거 제외');
  if (state.baseboard === false) parts.push('걸레받이 제외');
  return parts.join(' · ');
}

interface PageProps {
  searchParams: Promise<{ d?: string }>;
}

export default async function FlooringResultPage({ searchParams }: PageProps) {
  const { d } = await searchParams;
  // 공유 링크 자체가 없거나(d 없음) 깨진(디코드 실패) 경우를 조용히 기본값으로 채우지 않는다
  const state = decodeFlooringForm(d);
  const products = toFlooringProductOptions(FLOORING_PRODUCTS);
  // "조건 바꾸기"에서 그대로 이어 쓸 수 있게 같은 d 쿼리를 되돌려 준다
  const backHref = d ? `/calc/flooring?d=${d}` : '/calc/flooring';

  const calc = state ? calcFromState(state, products) : null;
  const result = calc?.result ?? null;
  const assumed = calc?.assumed ?? [];

  if (!state || !result) {
    return (
      <>
        <TopNav
          title="바닥재 계산기"
          backHref="/calc"
          rightSlot={
            <Link href={backHref} className="text-[16px] font-semibold text-brown">
              조건 바꾸기
            </Link>
          }
        />
        {/* px-5: 상단바(TopNav)와 좌우 여백을 맞춘다 */}
        <div className="px-5 py-4 flex flex-col gap-4 max-w-[720px] mx-auto">
          <Card>
            <p className="text-[15px] text-v1-text-secondary">조건이 비어 있어요</p>
          </Card>
        </div>
      </>
    );
  }

  const { quantity, submaterials, cost } = result;
  const unitLabel = quantity.unit === '박스' ? '박스' : 'm';
  const lossLabel = quantity.lossMode === '실제' ? `실제 로스 ${quantity.lossPct}%` : `추정 로스 ${quantity.lossPct}%`;

  // 즉답 화면(ResultPanel.tsx)과 같은 함수로 "34평 · 84㎡ · 제품 미정" 같은 가정 줄을 만든다.
  const areaPairText = quantity.inputMode === '평형' ? describeAreaPair(state) : null;
  const areaAssumptionLine = describeFlooringAreaAssumptionLine(areaPairText, assumed);

  return (
    <>
      <TopNav
        title="바닥재 계산기"
        backHref="/calc"
        rightSlot={
          <Link href={backHref} className="text-[16px] font-semibold text-brown">
            조건 바꾸기
          </Link>
        }
      />

      {/* px-5: 상단바(TopNav)와 좌우 여백을 맞춘다. pb-40: 모바일 하단 고정 저장·공유
          풍선(ResultFab)에 본문이 가리지 않게 여유를 둔다(도배 결과 화면과 동일) */}
      <div className="px-5 py-4 pb-40 lg:pb-8 flex flex-col gap-4 max-w-[720px] mx-auto">
        <p className="text-[13px] text-v1-text-secondary tabular-nums">{buildSummary(state)}</p>

        {/* 결과 카드 — 2026-09-15 디자인 통일 지시: 카드 속 카드 금지, 테두리 카드는 이거
            하나뿐이다. 물량 → 부자재 → 비용을 얇은 구분선(구획 제목 17/700)으로만 나눈다. */}
        <Card>
          {/* 물량 — 제품 미정이면 수량도 범위로("19~46박스") */}
          <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
            {formatUnitsRangeText(quantity.units, quantity.unitsRange, unitLabel)}
          </div>
          {/* 2026-09-27 저녁 지휘관 3차 검수 지적 8번: 면적 정수·"총" 삭제 — 즉답 화면
              (ResultPanel.tsx)과 같은 표기로 맞춘다 */}
          <p className="text-[15px] text-foreground leading-[1.6] tabular-nums">
            바닥 {Math.round(quantity.floorSqm)}㎡ · {lossLabel}
            {quantity.pieces != null ? ` · ${formatNum(quantity.pieces)}장` : ''}
          </p>
          {/* 면적·가정 한 줄 — "제품 미정" 등. 즉답 화면 ResultPanel.tsx와 같은 자리·같은 함수를 쓴다 */}
          {areaAssumptionLine && <p className="text-[13px] text-v1-text-secondary tabular-nums">{areaAssumptionLine}</p>}
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
              {formatManRange(cost.min, cost.max)}
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
          <Collapsible title="구성 보기" defaultOpen>
            <div className="flex flex-col">
              {cost.breakdown.map((line, i) => (
                <div key={line.key} className={`py-[10px] ${i === cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
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

        <PostToBoardCheckbox />

        <CalcContactCta />
        <Disclaimer />
      </div>

      {/* 하단 고정 — 모바일은 화면 하단에 고정, PC(lg)는 콘텐츠 흐름 안 인라인 버튼으로
          (도배 결과 화면과 동일한 배치) */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-4 pt-2 flex flex-col gap-3 max-w-[720px] mx-auto lg:static lg:max-w-[720px] lg:px-0 lg:pb-8">
        <div className="flex justify-end">
          <ResultFab shareText="얼마드나 바닥재 계산 결과를 확인해 보세요" />
        </div>
      </div>
    </>
  );
}
