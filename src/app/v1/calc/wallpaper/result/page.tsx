// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 결과 화면
// 서버 컴포넌트에서 calcWallpaper()를 직접 호출한다(단가 로직이 클라이언트로 새지 않게).
// URL의 d 쿼리(입력 폼이 인코딩해서 넘긴 값)를 풀어서 계산 입력으로 바꾼다.
//
// 디자인 가이드 v4 아트보드 06 기준:
//   조건 요약 1줄 → 카드1 물량(+실별 보기) → 카드2 부자재 → 카드3 비용(+구성 보기)
//   → 게시판 체크박스 → 관련 링크 5개 → 하단 고지 → 플로팅 저장/공유 → 하단 고정 [이 조건으로 질문하기]
//
// 계산 규칙(폼 상태 → 엔진 요청 변환)은 즉답 화면의 훅(useWallpaperCalc)과 완전히 같은
// 순수 함수(toEngineInput, src/lib/v1/wallpaperEngineInput.ts)를 쓴다. 그래야 즉답 화면에서
// 본 금액과 "결과 공유"로 열어 본 이 페이지의 금액이 어긋나지 않는다. 벽지 종류를 아직
// 안 고른 상태(paperType 없음)로 공유된 링크는 즉답 화면과 똑같이 합지·실크를 둘 다 계산해
// 실크 쪽 상세 + 합지 최저~실크 최고 범위로 보여준다.
//
// 작성일: 2026년 08월 28일
// 2026년 09월 09일: toCalcInput을 toEngineInput 기반으로 교체(새 필드 전부 반영), 제품 목록 배선
// ──────────────────────────────────────────────

import Link from 'next/link';
import TopNav from '@/components/v1/TopNav';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import ListRow from '@/components/v1/ListRow';
import Disclaimer from '@/components/v1/Disclaimer';
import Button from '@/components/v1/Button';
import { calcWallpaper } from '@/server/calc/wallpaper';
import type { WallpaperCalcInput, WallpaperCalcResult } from '@/server/calc/wallpaper';
import { WALLPAPER_PRODUCTS } from '@/server/calc/data/wallpaper-products';
import { decodeWallpaperForm, type WallpaperFormState } from '@/lib/v1/wallpaperQuery';
import { toWallpaperProductOptions } from '@/lib/v1/wallpaperProductOptions';
import { toEngineInput, describePreciseInput } from '@/lib/v1/wallpaperEngineInput';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { PostToBoardCheckbox, ResultFab } from './ResultActions';

export const metadata = {
  title: '도배 계산기 결과 — 얼마드나',
};

/** 이 페이지가 계산해서 넘기는 값 — 결과 상세(대표)·카드3 큰 숫자 범위·카드3 "중간" 금액 */
interface CalcFromStateResult {
  result: WallpaperCalcResult;
  range: { min: number; max: number };
  /** 카드3 "중간 N만원" — 합집합이면 result.cost.mid(실크 단독값)가 아니라 range 중앙값 */
  mid: number;
}

/** 원 단위 금액을 1,000원 단위로 반올림 (서버 roundWon과 같은 규칙) */
function roundWon(n: number): number {
  return Math.round(n / 1000) * 1000;
}

/**
 * 폼 상태 → 서버 계산 결과.
 * 즉답 화면의 훅과 같은 toEngineInput으로 요청을 만들어, 같은 조건이면 같은 금액이 나오게 한다.
 * 벽지 종류를 아직 안 골랐으면(paper.mergeBoth) 합지·실크를 둘 다 계산해 실크 쪽 상세를
 * 대표로 담고, 금액 범위는 합지 최저~실크 최고로 넓힌다(훅의 병합 규칙과 동일).
 *
 * 2026-09-09 검사관 지적 수리: 입력이 완전히 비어 toEngineInput이 null이면 예전엔 조용히
 * 34평 기본값으로 계산해 버렸다("아무 것도 안 골랐는데 결과가 나온다" 착시). 이제는 null을
 * 그대로 돌려주고, 페이지가 "조건이 비어 있어요" 빈 상태를 보여준다.
 */
function calcFromState(
  state: WallpaperFormState,
  products: ReturnType<typeof toWallpaperProductOptions>,
): CalcFromStateResult | null {
  const engineInput = toEngineInput(state, products);
  if (!engineInput) return null;
  const { base, paper } = engineInput;

  if (paper.mergeBoth) {
    const lo: WallpaperCalcInput = { ...base, paperType: '합지' };
    const hi: WallpaperCalcInput = { ...base, paperType: '실크' };
    const loResult = calcWallpaper(lo);
    const hiResult = calcWallpaper(hi);
    // 합지 쪽 최저 ~ 실크 쪽 최고로 범위를 넓힌다(useWallpaperCalc.ts와 같은 규칙)
    const range = { min: loResult.cost.min, max: hiResult.cost.max };
    // 검사관 지적 8번: "중간"도 실크 단독값이 아니라 이 넓힌 범위의 중앙값이어야 한다
    const mid = roundWon((range.min + range.max) / 2);
    return { result: hiResult, range, mid };
  }

  const request: WallpaperCalcInput = { ...base, paperType: paper.paperType, product: paper.product };
  const result = calcWallpaper(request);
  return { result, range: { min: result.cost.min, max: result.cost.max }, mid: result.cost.mid };
}

/** 조건 요약 1줄 (예: "34평 · 3베이 · 전체 · 천장 포함 · 실크") */
function buildSummary(state: WallpaperFormState): string {
  const parts: string[] = [];
  // 새 화면(즉답+정밀 폼)의 entry 값이 있으면 그걸 우선한다 — 방별 실측/벽 길이 직접 입력이
  // 옛 mode('평형'/'실측'/'면적') 필드보다 실제 입력 방식을 더 정확히 담고 있기 때문.
  // describePreciseInput()으로 판정한다 — 예전엔 state.preciseRooms.length를 그대로 세서
  // 가로·세로를 아직 안 채운 빈 방 카드까지 "실측 N개 실"에 포함시키는 버그가 있었다(검사관 지적 N4).
  const precise = describePreciseInput(state);
  if (precise?.kind === 'room') {
    parts.push(`실측 ${precise.count}개 실`);
  } else if (precise?.kind === 'length') {
    parts.push(`벽 길이 ${state.wallLength}m`);
  } else if (state.mode === '평형') {
    parts.push(`${state.pyeong}평`, `${state.bay ?? 3}베이`);
    parts.push(Array.isArray(state.scope) ? '방 고르기' : state.scope === '거실주방' ? '거실·주방' : '전체');
  } else if (state.mode === '실측') {
    parts.push(`실측 ${state.rooms?.length ?? 0}개 실`);
  } else {
    parts.push('면적 직접 입력');
  }

  // 대상이 "벽만"이면 그 문구로, 아니면 기존 천장 포함/미포함 문구를 그대로 쓴다
  parts.push(state.target === 'wall' ? '벽만' : state.ceiling ? '천장 포함' : '천장 미포함');

  // 구축(재도배)이면 한 마디 더 붙인다
  if (state.isOld) parts.push('구축');

  // 새 화면에서 paperType이 선택 전(undefined)일 수도 있게 바뀌어 "합지~실크"로 채운다
  parts.push(state.paperType ?? '합지~실크');
  return parts.join(' · ');
}

/** 비용 구성 한 줄을 "28롤 × 3.2만 = 90만" 또는 범위 문자열로 만든다 */
function formatCostLineAmount(line: {
  key: string;
  qty: number;
  unit: string;
  unitPriceMin: number;
  unitPriceMax: number;
  amountMin: number;
  amountMax: number;
}): string {
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

interface PageProps {
  searchParams: Promise<{ d?: string }>;
}

export default async function WallpaperResultPage({ searchParams }: PageProps) {
  const { d } = await searchParams;
  // 2026-09-09 검사관 2라운드 지적 1번: 예전엔 여기서 `?? DEFAULT_CALC_FORM`으로 즉시
  // 34평 기본값을 채워 넣어서, 공유 링크 자체가 없거나(d 없음) 깨진(디코드 실패) 경우가
  // "입력이 빈 경우"(아래 !calc 분기)를 거치지 못하고 항상 34평 결과가 나와 버렸다.
  // 이제는 디코드 실패도 그대로 null로 두고, "빈 상태"를 한 곳(!state || !calc)에서만 처리한다.
  const state = decodeWallpaperForm(d);
  // 제품 마스터는 입력 화면(page.tsx)과 같은 순수 함수로 변환한다(중복 제거)
  const products = toWallpaperProductOptions(WALLPAPER_PRODUCTS);
  // "조건 바꾸기"에서 그대로 이어 쓸 수 있게 같은 d 쿼리를 되돌려 준다
  const backHref = d ? `/v1/calc/wallpaper?d=${d}` : '/v1/calc/wallpaper';

  const calc = state ? calcFromState(state, products) : null;

  // 검사관 지적 3번(1라운드)+1번(2라운드): 공유 링크가 없거나·깨졌거나·디코드는 됐지만
  // 입력이 완전히 비어 있으면(평형도 실측도 없음) 조용히 34평으로 바꿔치기하지 않고
  // 빈 상태를 그대로 보여준다 — 세 경우 전부 같은 화면이다.
  if (!state || !calc) {
    return (
      <>
        <TopNav
          title="도배 계산기"
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

  const { result, range, mid } = calc;
  const { quantity, submaterials, cost } = result;
  // 로스 근거 라벨: 실제/추정/면적 기준으로 문구가 달라진다(설계 정본 카드1 규칙)
  const lossLabel =
    quantity.lossMode === '실제'
      ? `실제 로스 ${quantity.lossPct}%`
      : quantity.lossMode === '면적'
        ? `면적 기준 로스 ${quantity.lossPct}%`
        : `추정 로스 ${quantity.lossPct}%`;

  return (
    <>
      <TopNav
        title="도배 계산기"
        backHref="/v1"
        rightSlot={
          <Link href={backHref} className="text-[16px] font-semibold text-brown">
            조건 바꾸기
          </Link>
        }
      />

      <div className="px-4 py-4 pb-40 lg:pb-8 flex flex-col gap-4 max-w-[720px] mx-auto">
        <p className="text-[14px] text-v1-text-secondary tabular-nums">{buildSummary(state)}</p>

        {/* 카드 1 — 물량 */}
        <Card>
          <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
            {formatNum(quantity.rolls)}롤
          </div>
          <p className="text-[16px] text-foreground leading-[1.6] tabular-nums">
            벽 {quantity.wallSqm}㎡ · 천장 {quantity.ceilingSqm}㎡ · {lossLabel}
          </p>
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
                    <span className="text-[16px] text-foreground">{r.name}</span>
                    <span className="text-[16px] text-v1-text-secondary tabular-nums">
                      {r.rolls}롤{' '}
                      <span className="text-[14px] text-v1-text-disabled">{r1(r.wallSqm + r.ceilingSqm)}㎡</span>
                    </span>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}
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
                <p className="text-[14px] text-v1-text-disabled tabular-nums">{s.basis}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* 카드 3 — 비용 */}
        <Card>
          {/* 금액과 단위는 줄바꿈으로 갈라지면 안 되므로(디자인 가이드 원칙) whitespace-nowrap.
              배지가 자리 부족하면 배지만 다음 줄로 내려가게 flex-wrap 허용 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 벽지 종류를 아직 안 고른 공유 링크는 range가 cost.min~max보다 넓다(합지 최저~실크 최고) */}
            <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
              {formatManRange(range.min, range.max)}
            </div>
            {cost.mode === '산식' && (
              <span className="text-[14px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[4px] px-[10px] py-[2px] whitespace-nowrap">
                추정
              </span>
            )}
          </div>
          <p className="text-[16px] font-semibold text-v1-text-secondary tabular-nums">
            중간 {toMan(mid).toLocaleString('ko-KR')}만원
          </p>
          <p className="text-[16px] text-foreground tabular-nums">{cost.basisLine}</p>
          <Collapsible title="구성 보기">
            <div className="flex flex-col">
              {cost.breakdown.map((line, i) => (
                <div key={line.key} className={`py-[10px] ${i === cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] text-foreground">{line.name}</span>
                    <span className="text-[16px] text-foreground tabular-nums">{formatCostLineAmount(line)}</span>
                  </div>
                  <p className="text-[14px] text-v1-text-disabled tabular-nums">{line.note}</p>
                </div>
              ))}
              <p className="text-[14px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
            </div>
          </Collapsible>
        </Card>

        <PostToBoardCheckbox />

        {/* 관련 링크 5개 — 시세·글은 준비 중, 블로그 글 2개는 실제 발행 글로 연결 */}
        <div className="bg-white border border-v1-line rounded-[4px] px-4">
          <ListRow href="/v1/price">시세 · 실크 벽지 평당 단가</ListRow>
          <ListRow href="/blog/wallpaper-cost">글 · 도배 견적서 확인 4가지</ListRow>
          <ListRow href="/blog/paint-vs-wallpaper-cost">글 · 합지와 실크, 무엇이 다른가</ListRow>
          <ListRow href="/v1/q">질문 · 도배 210만원 적정한가요</ListRow>
          <ListRow href="/v1/q" last>
            질문 · 살림집 추가비 얼마 붙나요
          </ListRow>
        </div>

        <Disclaimer />
      </div>

      {/* 하단 고정 — 모바일은 화면 하단에 고정, PC(lg)는 콘텐츠 흐름 안 인라인 버튼으로 */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 flex flex-col gap-3 max-w-[720px] mx-auto lg:static lg:max-w-[720px] lg:px-0 lg:pb-8">
        <div className="flex justify-end">
          <ResultFab />
        </div>
        <Link href="/v1/q">
          <Button fullWidth>이 조건으로 질문하기</Button>
        </Link>
      </div>
    </>
  );
}

/** 소수점 1자리 반올림 (실별 보기 면적 합산용) */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
