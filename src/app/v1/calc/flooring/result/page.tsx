// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 결과 화면 (도배 result/page.tsx를 그대로 본떠 만듦)
// 서버 컴포넌트에서 calcFlooring()을 직접 호출한다(단가 로직이 클라이언트로 새지 않게).
// URL의 d 쿼리(입력 폼이 인코딩해서 넘긴 값)를 풀어서 계산 입력으로 바꾼다.
//
// 계산 규칙(폼 상태 → 엔진 요청 변환)은 즉답 화면의 훅(useFlooringCalc)과 완전히 같은
// 순수 함수(toEngineInput, src/lib/v1/flooringEngineInput.ts)를 쓴다. 그래야 즉답 화면에서
// 본 금액과 "결과 공유"로 열어 본 이 페이지의 금액이 어긋나지 않는다.
//
// 작성일: 2026년 09월 10일
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
import { toEngineInput, describePreciseInput } from '@/lib/v1/flooringEngineInput';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';

export const metadata = {
  title: '바닥재 계산기 결과 — 얼마드나',
};

/**
 * 폼 상태 → 서버 계산 결과.
 * 즉답 화면의 훅과 같은 toEngineInput으로 요청을 만들어, 같은 조건이면 같은 금액이 나오게 한다.
 * toEngineInput이 null이면(종류 미선택 / simple인데 평형·제품 없음 / precise인데 치수 없음)
 * 이 함수도 null을 돌려주고, 페이지가 "조건이 비어 있어요" 빈 상태를 보여준다.
 */
function calcFromState(
  state: FlooringFormState,
  products: ReturnType<typeof toFlooringProductOptions>,
): FlooringCalcResult | null {
  const engineInput = toEngineInput(state, products);
  if (!engineInput) return null;
  // toEngineInput(U 쪽 순수 함수)이 만드는 요청 모양은 공통 규칙 문서 API 계약을 그대로
  // 따랐고, calcFlooring(E 쪽 실제 엔진)의 FlooringCalcInput도 같은 계약이라 필드가 그대로
  // 맞는다(mode·pyeong·bay·rooms·scope·kind·product·removeOld·baseboard).
  return calcFlooring(engineInput as FlooringCalcInput);
}

/** 조건 요약 1줄 (예: "34평 · 3베이 · 전체 · 마루 · 구축 기준 · 철거 제외") */
function buildSummary(state: FlooringFormState): string {
  const parts: string[] = [];
  const precise = describePreciseInput(state);
  if (precise?.kind === 'room') {
    parts.push(`실측 ${precise.count}개 실`);
  } else {
    parts.push(`${state.pyeong}평`, `${state.bay ?? 3}베이`);
    // 검사관 1라운드 지적 1번: 범위(전체/방만/거실·주방·복도)는 실측 모드에선 뜻이 없다
    // (엔진도 실측이면 항상 전체로 계산한다) — 평형 모드일 때만 요약줄에 넣는다
    parts.push(state.scope === '방만' ? '방만' : state.scope === '거실주방' ? '거실·주방·복도' : '전체');
  }

  // 이 함수가 불리는 시점엔 이미 계산이 성공한 뒤라 kind는 항상 있다(종류를 안 고르면
  // calcFromState가 null을 돌려주고 이 화면 자체가 안 그려진다).
  parts.push(state.kind as string);

  // 견적은 전부 구축 기준. 철거·걸레받이를 껐을 때만 그 사실을 적는다
  parts.push('구축 기준');
  if (state.removeOld === false) parts.push('철거 제외');
  if (state.baseboard === false) parts.push('걸레받이 제외');
  return parts.join(' · ');
}

/**
 * 원 단위("2개 × 2,500원 = 5,000원")로 보여줘도 되는 단위 — 정수로 세는 부자재만.
 * ㎡·m처럼 연속량 단위는 여기 넣지 않는다(검사관 2라운드 지적 N-1, ResultPanel과 동일).
 */
const COUNT_UNITS = new Set(['개', '통', '병', '세트', '롤']);

/**
 * 비용 구성 한 줄을 "28박스 × 3.2만 = 90만" 또는 범위 문자열로 만든다.
 *
 * 검사관 2라운드 지적 N-1: 1라운드에서 고친 "단가 1만원 미만이면 원 단위" 규칙이 장판
 * 철거 줄(68.1㎡ × 6,050원 = 412,005원)까지 걸려 ㎡당 철거 단가가 그대로 노출됐다.
 * 원 단위 표기는 정수 개수 단위(개·통·병·세트·롤)이면서 금액이 10만원 미만일 때만 쓰고,
 * 그 외는 만 단위로 뭉뚱그린다(단가가 "0만"이 되면 수식 없이 금액만 "N만"/"1만 미만").
 */
function formatCostLineAmount(line: {
  key: string;
  qty: number;
  unit: string;
  unitPriceMin: number;
  unitPriceMax: number;
  amountMin: number;
  amountMax: number;
}): string {
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
    if (manPrice === 0) {
      return manAmount === 0 ? '1만 미만' : `${manAmount}만`;
    }
    return `${formatNum(line.qty)}${line.unit} × ${manPrice}만 = ${manAmount}만`;
  }
  return formatManRange(line.amountMin, line.amountMax);
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
  const backHref = d ? `/v1/calc/flooring?d=${d}` : '/v1/calc/flooring';

  const result = state ? calcFromState(state, products) : null;

  if (!state || !result) {
    return (
      <>
        <TopNav
          title="바닥재 계산기"
          backHref="/v1"
          rightSlot={
            <Link href={backHref} className="text-[16px] font-semibold text-brown">
              조건 바꾸기
            </Link>
          }
        />
        <div className="px-4 py-4 flex flex-col gap-4 max-w-[720px] mx-auto">
          <Card>
            <p className="text-[16px] text-v1-text-secondary">조건이 비어 있어요</p>
          </Card>
        </div>
      </>
    );
  }

  const { quantity, submaterials, cost } = result;
  const unitLabel = quantity.unit === '박스' ? '박스' : 'm';
  const lossLabel = quantity.lossMode === '실제' ? `실제 로스 ${quantity.lossPct}%` : `추정 로스 ${quantity.lossPct}%`;

  return (
    <>
      <TopNav
        title="바닥재 계산기"
        backHref="/v1"
        rightSlot={
          <Link href={backHref} className="text-[16px] font-semibold text-brown">
            조건 바꾸기
          </Link>
        }
      />

      <div className="px-4 py-4 pb-8 flex flex-col gap-4 max-w-[720px] mx-auto">
        <p className="text-[14px] text-v1-text-secondary tabular-nums">{buildSummary(state)}</p>

        {/* 카드 1 — 물량 */}
        <Card>
          <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
            {formatNum(quantity.units)}
            {unitLabel}
          </div>
          <p className="text-[16px] text-foreground leading-[1.6] tabular-nums">
            바닥 {formatNum(quantity.floorSqm)}㎡ · {lossLabel}
            {quantity.pieces != null ? ` · 총 ${formatNum(quantity.pieces)}장` : ''}
          </p>
          <Collapsible title="실별 보기">
            <div className="flex flex-col">
              {quantity.byRoom.map((r, i) => (
                <div
                  key={r.key}
                  className={`h-11 flex items-center justify-between ${
                    i === quantity.byRoom.length - 1 ? '' : 'border-b border-v1-line-2'
                  }`}
                >
                  <span className="text-[16px] text-foreground">{r.name}</span>
                  <span className="text-[16px] text-v1-text-secondary tabular-nums">
                    {formatNum(r.units)}
                    {unitLabel}{' '}
                    <span className="text-[14px] text-v1-text-disabled">{formatNum(r.floorSqm)}㎡</span>
                  </span>
                </div>
              ))}
            </div>
          </Collapsible>
        </Card>

        {/* 카드 2 — 부자재 */}
        <Card>
          <h2 className="text-[20px] font-bold text-foreground">부자재</h2>
          <div className="flex flex-col">
            {submaterials.map((s, i) => (
              <div key={s.key} className={`py-[10px] ${i === submaterials.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[16px] text-foreground">{s.name}</span>
                  <span className="text-[16px] text-foreground tabular-nums">
                    {formatNum(s.qty)}
                    {s.unit}
                  </span>
                </div>
                {/* 검사관 1라운드 지적 9번: 근거 등급이 C(추정)면 근거줄 끝에 "· 추정"을
                    덧붙인다 — 즉답 화면 ResultPanel과 같은 규칙이라 두 화면 문구가 어긋나지 않는다 */}
                <p className="text-[14px] text-v1-text-disabled tabular-nums">
                  {s.basis}
                  {s.grade === 'C' && !s.basis.includes('추정') ? ' · 추정' : ''}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* 카드 3 — 비용 */}
        <Card>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
              {formatManRange(cost.min, cost.max)}
            </div>
            {cost.mode === '산식' && (
              <span className="text-[14px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
                추정
              </span>
            )}
          </div>
          <p className="text-[16px] font-semibold text-v1-text-secondary tabular-nums">
            중간 {toMan(cost.mid).toLocaleString('ko-KR')}만원
          </p>
          <p className="text-[16px] text-foreground tabular-nums">{cost.basisLine}</p>
          <Collapsible title="구성 보기" defaultOpen>
            <div className="flex flex-col">
              {cost.breakdown.map((line, i) => (
                <div key={line.key} className={`py-[10px] ${i === cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  {/* 검사관 2라운드 지적 N-2: 이름·금액이 둘 다 긴 줄이 좁은 화면에서 겹치지
                      않게 gap을 주고, 이름은 줄이며 금액은 안 접히게 한다(ResultPanel과 동일) */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[16px] text-foreground min-w-0 truncate">{line.name}</span>
                    <span className="text-[16px] text-foreground tabular-nums whitespace-nowrap flex-none">
                      {formatCostLineAmount(line)}
                    </span>
                  </div>
                  <p className="text-[14px] text-v1-text-disabled tabular-nums">{line.note}</p>
                </div>
              ))}
              <p className="text-[14px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
            </div>
          </Collapsible>
        </Card>

        <Disclaimer />
      </div>
    </>
  );
}
