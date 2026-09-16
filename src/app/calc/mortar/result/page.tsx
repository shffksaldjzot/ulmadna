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
import { toEngineInput, describePreciseInput, describeAreaPair, sanitizeMortarFormState } from '@/lib/v1/mortarEngineInput';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
// 2026-09-15 디자인 통일 작업: 도배 결과 화면에만 있던 저장·공유 기능을 레미탈에도 그대로 붙인다
import { PostToBoardCheckbox, ResultFab } from '../../_components/ResultActions';
import CalcContactCta from '../../_components/CalcContactCta';

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

/** 비용 구성 한 줄의 최소 모양(레이어 그룹핑에서 재사용) */
interface CostLineLike {
  key: string;
  name: string;
  qty: number;
  unit: string;
  unitPriceMin: number;
  unitPriceMax: number;
  amountMin: number;
  amountMax: number;
  note: string;
  layer: '자재' | '부자재' | '운송·하차' | '양중' | '인건' | '경비';
  grade: 'A' | 'B' | 'C';
}

/** 5층 비용 구성 순서 — 06_미장.md §11-9. 경비는 5층엔 안 들지만 합계 줄로 맨 뒤에 그대로 둔다 */
const LAYER_ORDER: CostLineLike['layer'][] = ['자재', '부자재', '운송·하차', '양중', '인건', '경비'];

/** breakdown을 층별로 묶고 층 소계(금액 범위)를 같이 낸다 — 빈 층은 뺀다 */
function groupByLayer(breakdown: CostLineLike[]) {
  return LAYER_ORDER.map((layer) => {
    const lines = breakdown.filter((b) => b.layer === layer);
    return {
      layer,
      lines,
      subMin: lines.reduce((s, l) => s + l.amountMin, 0),
      subMax: lines.reduce((s, l) => s + l.amountMax, 0),
    };
  }).filter((g) => g.lines.length > 0);
}

/**
 * 금액 범위를 만원 단위로 뭉개면 안 보이는 소액(1만원 미만) 줄을 위한 보조 포맷터.
 * 2026-09-15 현장 지시: 시멘트처럼 줄 전체 금액이 1만원 밑인 항목이 formatManRange로
 * "0만~1만원"처럼 뭉개져 나오는 문제 — 1만원 미만은 천원 단위("4천~6천원")로, 1만원
 * 이상이면 기존 만원 단위(formatManRange)로 나눠 보여준다. ResultPanel.tsx와 같은 함수.
 */
function formatWonRange(min: number, max: number): string {
  if (max < 10000) {
    const a = Math.round(min / 1000);
    const b = Math.round(max / 1000);
    return a === b ? `${a}천원` : `${a}천~${b}천원`;
  }
  return formatManRange(min, max);
}

// 2026-09-15 운영자 현장 기준 지시(노임 범위화): 분기 기준을 unitPriceMin===Max에서 amountMin===Max로
// 바꿨다 — 인건 줄은 단가가 인원×혼합 노임이라 단일값이 아니지만(0으로 채워 둠), 금액은
// 실제 범위를 갖는다(ResultPanel.tsx와 같은 이유).
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
  if (line.amountMin === line.amountMax) {
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
  return formatWonRange(line.amountMin, line.amountMax);
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
        {/* px-5: 상단바(TopNav)와 좌우 여백을 맞춘다 */}
        <div className="px-5 py-4 flex flex-col gap-4 max-w-[720px] mx-auto">
          <Card>
            <p className="text-[15px] text-v1-text-secondary">조건이 비어 있어요</p>
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

      {/* px-5: 상단바(TopNav)와 좌우 여백을 맞춘다. pb-40: 모바일 하단 고정 저장·공유
          풍선(ResultFab)에 본문이 가리지 않게 여유를 둔다(도배 결과 화면과 동일) */}
      <div className="px-5 py-4 pb-40 lg:pb-8 flex flex-col gap-4 max-w-[720px] mx-auto">
        <p className="text-[13px] text-v1-text-secondary tabular-nums">{buildSummary(state)}</p>

        {/* 결과 카드 — 2026-09-15 디자인 통일 지시: 카드 속 카드 금지, 테두리 카드는 이거
            하나뿐이다. 물량 → 부자재 → 비용을 얇은 구분선(구획 제목 17/700)으로만 나눈다. */}
        <Card>
          {/* 물량. 큰 숫자는 "레미탈 40kg × N포" 형태(2026-09-15 운영자 현장 기준 피드백 —
              "몇 kg짜리 몇 포인지"가 안 보였다는 지적) */}
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-[20px] font-semibold text-foreground whitespace-nowrap">
              {result.mode} {quantity.bagKg}kg ×
            </span>
            <span className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
              {formatNum(quantity.bags)}
            </span>
            <span className="text-[20px] font-semibold text-foreground">포</span>
          </div>
          <p className="text-[15px] text-foreground">{quantity.productLabel}</p>
          <p className="text-[13px] text-v1-text-disabled tabular-nums">
            주문 수량: {formatNum(quantity.bags)}포(로스 {quantity.lossPct}% 포함)
          </p>
          <p className="text-[15px] text-foreground leading-[1.6] tabular-nums">
            {quantity.thicknessMm}mm · 면적 {formatNum(quantity.areaSqm)}㎡ · 몰탈 {quantity.volumeWithLossM3}㎥
          </p>
          {/* 34평 의미 통일(2026-09-15) — 방통은 도배·바닥재처럼
              "34평 · 84㎡"를 병기한다 */}
          {describeAreaPair(state) && (
            <p className="text-[13px] text-v1-text-disabled tabular-nums">{describeAreaPair(state)}</p>
          )}
          {quantity.standardRangeNote && <p className="text-[13px] text-v1-text-secondary">{quantity.standardRangeNote}</p>}
          {/* 레미탈은 인원 한 줄(공법 표시 포함), 셀프레벨링은 "시공비는 현장 견적 별도" 안내로 대체한다 */}
          {labor ? (
            <p className="text-[13px] text-v1-text-disabled tabular-nums">
              {labor.method === '장비타설' ? '장비 타설' : '손미장(추정)'} · 기공 {labor.crewPlasterer}인 · 조공 {labor.crewHelper}인
              {labor.crewMechanic > 0 ? ` · 기계운전 ${labor.crewMechanic}인` : ''}, {labor.days}일 완료
            </p>
          ) : (
            result.laborAdvisoryNote && <p className="text-[13px] text-v1-text-disabled">{result.laborAdvisoryNote}</p>
          )}
          {result.equipmentNote && <p className="text-[13px] text-v1-text-disabled">{result.equipmentNote}</p>}
          {quantity.altMix && (
            <Collapsible title="현장 배합 대안">
              <p className="text-[15px] text-foreground py-2 tabular-nums">
                시멘트 40kg × {formatNum(quantity.altMix.cementBags)}포 + 모래 {quantity.altMix.sandM3}㎥
              </p>
              <p className="text-[13px] text-v1-text-disabled">배합비 {quantity.altMix.mixRatio} · 참고용, 비용에는 안 넣었어요</p>
            </Collapsible>
          )}

          {/* 부자재 */}
          {submaterials.length > 0 && (
            <>
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
            </>
          )}

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
          {/* 현장 확인 필요 — 운송·양중·(장비타설시)장비대는 값을 안 넣으면 계산에서 빠진다 */}
          {result.siteConfirmItems.length > 0 && (
            <p className="text-[13px] text-v1-text-secondary">현장 확인 필요: {result.siteConfirmItems.join('·')}</p>
          )}
          {/* 5층 비용 구성표 — 자재/부자재/운송·하차/양중/인건 층별 소계 */}
          <Collapsible title="구성 보기" defaultOpen>
            <div className="flex flex-col">
              {groupByLayer(cost.breakdown as CostLineLike[]).map((group) => (
                <div key={group.layer} className="py-[10px] border-b border-v1-line-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-v1-text-label">{group.layer}</span>
                    <span className="text-[13px] font-semibold text-v1-text-label tabular-nums whitespace-nowrap">
                      {formatWonRange(group.subMin, group.subMax)}
                    </span>
                  </div>
                  <div className="flex flex-col pt-1">
                    {group.lines.map((line) => (
                      <div key={line.key} className="py-[6px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[15px] text-foreground min-w-0 truncate">{line.name}</span>
                          <span className="text-[15px] text-foreground tabular-nums whitespace-nowrap flex-none">
                            {formatCostLineAmount(line)}
                          </span>
                        </div>
                        <p className="text-[13px] text-v1-text-disabled tabular-nums">
                          {line.note}
                          {line.grade === 'C' && !line.note.includes('추정') ? ' · 추정' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
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
          <ResultFab shareText="얼마드나 레미탈 계산 결과를 확인해 보세요" />
        </div>
      </div>
    </>
  );
}
