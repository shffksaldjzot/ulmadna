// ──────────────────────────────────────────────
// v1 허브 — 레미탈 계산기 결과 화면 (도배·바닥재 result/page.tsx를 그대로 본떠 만듦)
// 서버 컴포넌트에서 calcMortar()를 직접 호출한다(단가 로직이 클라이언트로 새지 않게).
// URL의 d 쿼리(입력 폼이 인코딩해서 넘긴 값)를 풀어서 계산 입력으로 바꾼다.
//
// 계산 규칙(폼 상태 → 엔진 요청 변환)은 즉답 화면의 훅(useMortarCalc)과 완전히 같은
// 순수 함수(toEngineInput, src/lib/v1/mortarEngineInput.ts)를 쓴다. 그래야 즉답 화면에서
// 본 금액과 "결과 공유"로 열어 본 이 페이지의 금액이 어긋나지 않는다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import Link from 'next/link';
import type { Metadata } from 'next';
import TopNav from '@/components/v1/TopNav';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import Disclaimer from '@/components/v1/Disclaimer';
import { calcMortar } from '@/server/calc/mortar';
import type { MortarCalcInput, MortarCalcResult } from '@/server/calc/mortar';
import { MORTAR_PRODUCTS } from '@/server/calc/data/mortar-products';
import { decodeMortarForm, type MortarFormState } from '@/lib/v1/mortarQuery';
import { toMortarProductOptions } from '@/lib/v1/mortarProductOptions';
import { toEngineInput, describePreciseInput, sanitizeMortarFormState } from '@/lib/v1/mortarEngineInput';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';

export const metadata: Metadata = {
  title: '레미탈 계산기 결과 — 얼마드나',
  alternates: { canonical: 'https://ulmadna.com/calc/mortar' },
};

/**
 * 폼 상태 → 서버 계산 결과.
 * 즉답 화면의 훅과 같은 toEngineInput으로 요청을 만들어, 같은 조건이면 같은 값이 나오게 한다.
 */
function calcFromState(
  state: MortarFormState,
  products: ReturnType<typeof toMortarProductOptions>,
): MortarCalcResult | null {
  const engineInput = toEngineInput(state, products);
  if (!engineInput) return null;
  return calcMortar(engineInput as MortarCalcInput);
}

/** 조건 요약 1줄 (예: "레미탈 · 방통 전체 · 45mm · 10평") */
function buildSummary(state: MortarFormState): string {
  const parts: string[] = [state.mode ?? '레미탈'];
  const precise = describePreciseInput(state);
  if (precise?.kind === 'room') {
    parts.push(`실측 ${precise.count}개 구역`);
  } else if (state.areaInputMode === 'rect' && state.rectWidth && state.rectDepth) {
    parts.push(`${state.rectWidth}×${state.rectDepth}m`);
  } else if (state.area) {
    parts.push(`${state.area}${state.areaUnit ?? '평'}`);
  }
  if (state.thicknessMm) parts.push(`${state.thicknessMm}mm`);
  return parts.join(' · ');
}

const COUNT_UNITS = new Set(['포', '통', '개', '㎡']);

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

export default async function MortarResultPage({ searchParams }: PageProps) {
  const { d } = await searchParams;
  // 2026-09-15 검사관 지적: ?d=에 비정상 값(예: 1e22)이 들어오면 계산 입력(toEngineInput)은
  // 클램프되지만, 요약줄(buildSummary)이 원본 state를 그대로 읽으면 "1e+22" 같은 지수
  // 표기가 그대로 노출된다 — decode 직후 sanitizeMortarFormState로 한 번 걸러서, 이후
  // buildSummary·calcFromState 둘 다 "화면에 보여줘도 안전한" 같은 state를 쓰게 한다.
  const decoded = decodeMortarForm(d);
  const state = decoded ? sanitizeMortarFormState(decoded) : null;
  const products = toMortarProductOptions(MORTAR_PRODUCTS);
  const backHref = d ? `/calc/mortar?d=${d}` : '/calc/mortar';

  const result = state ? calcFromState(state, products) : null;

  if (!state || !result) {
    return (
      <>
        <TopNav
          title="레미탈 계산기"
          backHref="/calc"
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

  const { quantity, submaterials, labor, cost } = result;

  return (
    <>
      <TopNav
        title="레미탈 계산기"
        backHref="/calc"
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
            {formatNum(quantity.bags)}포
          </div>
          <p className="text-[16px] text-foreground leading-[1.6] tabular-nums">
            {result.mode} {quantity.thicknessMm}mm · 면적 {formatNum(quantity.areaSqm)}㎡ · 몰탈 {quantity.volumeWithLossM3}㎥
            · 로스 {quantity.lossPct}% 포함
          </p>
          {/* 레미탈은 품수(공법 표시 포함), 셀프레벨링은 "시공비는 현장 견적 별도" 안내로 대체한다 */}
          {labor ? (
            <p className="text-[14px] text-v1-text-disabled tabular-nums">
              {labor.method === '장비타설' ? '장비 타설' : '손미장(추정)'} {labor.manDaysTotal}품 · 2인 1조 약 {labor.teamDays}일
            </p>
          ) : (
            result.laborAdvisoryNote && <p className="text-[14px] text-v1-text-disabled">{result.laborAdvisoryNote}</p>
          )}
          {result.equipmentNote && <p className="text-[14px] text-v1-text-disabled">{result.equipmentNote}</p>}
          {quantity.altMix && (
            <Collapsible title="현장 배합 대안">
              <p className="text-[16px] text-foreground py-2 tabular-nums">
                시멘트 {formatNum(quantity.altMix.cementBags)}포(40kg) + 모래 {quantity.altMix.sandM3}㎥
              </p>
              <p className="text-[14px] text-v1-text-disabled">배합비 {quantity.altMix.mixRatio} · 참고용, 비용에는 안 넣었어요</p>
            </Collapsible>
          )}
        </Card>

        {/* 카드 2 — 부자재 */}
        {submaterials.length > 0 && (
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
                  <p className="text-[14px] text-v1-text-disabled tabular-nums">
                    {s.basis}
                    {s.grade === 'C' && !s.basis.includes('추정') ? ' · 추정' : ''}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

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
