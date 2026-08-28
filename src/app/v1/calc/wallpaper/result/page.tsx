// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 결과 화면
// 서버 컴포넌트에서 calcWallpaper()를 직접 호출한다(단가 로직이 클라이언트로 새지 않게).
// URL의 d 쿼리(입력 폼이 인코딩해서 넘긴 값)를 풀어서 계산 입력으로 바꾼다.
//
// 디자인 가이드 v4 아트보드 06 기준:
//   조건 요약 1줄 → 카드1 물량(+실별 보기) → 카드2 부자재 → 카드3 비용(+구성 보기)
//   → 게시판 체크박스 → 관련 링크 5개 → 하단 고지 → 플로팅 저장/공유 → 하단 고정 [이 조건으로 질문하기]
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import Link from 'next/link';
import TopNav from '@/components/v1/TopNav';
import Card from '@/components/v1/Card';
import Collapsible from '@/components/v1/Collapsible';
import ListRow from '@/components/v1/ListRow';
import Disclaimer from '@/components/v1/Disclaimer';
import Button from '@/components/v1/Button';
import { calcWallpaper } from '@/server/calc/wallpaper';
import type { WallpaperCalcInput } from '@/server/calc/wallpaper';
import { decodeWallpaperForm, DEFAULT_WALLPAPER_FORM, type WallpaperFormState } from '@/lib/v1/wallpaperQuery';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
import { PostToBoardCheckbox, ResultFab } from './ResultActions';

export const metadata = {
  title: '도배 계산기 결과 — 얼마드나',
};

/** 입력 폼 상태(WallpaperFormState) → 서버 계산 입력(WallpaperCalcInput) */
function toCalcInput(state: WallpaperFormState): WallpaperCalcInput {
  return {
    mode: state.mode,
    pyeong: state.pyeong,
    bay: state.bay,
    rooms: state.rooms,
    heightM: state.heightM,
    areas: state.areas,
    scope: state.scope,
    ceiling: state.ceiling,
    paperType: state.paperType,
    product: state.product,
    region: state.region,
  };
}

/** 조건 요약 1줄 (예: "34평 · 3베이 · 전체 · 천장 포함 · 실크") */
function buildSummary(state: WallpaperFormState): string {
  const parts: string[] = [];
  if (state.mode === '평형') {
    parts.push(`${state.pyeong}평`, `${state.bay ?? 3}베이`);
    parts.push(Array.isArray(state.scope) ? '방 고르기' : state.scope === '거실주방' ? '거실·주방' : '전체');
  } else if (state.mode === '실측') {
    parts.push(`실측 ${state.rooms?.length ?? 0}개 실`);
  } else {
    parts.push('면적 직접 입력');
  }
  parts.push(state.ceiling ? '천장 포함' : '천장 미포함');
  parts.push(state.paperType);
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
  const state = decodeWallpaperForm(d) ?? DEFAULT_WALLPAPER_FORM;
  const result = calcWallpaper(toCalcInput(state));

  const { quantity, submaterials, cost } = result;
  // 로스 근거 라벨: 실제/추정/면적 기준으로 문구가 달라진다(설계 정본 카드1 규칙)
  const lossLabel =
    quantity.lossMode === '실제'
      ? `실제 로스 ${quantity.lossPct}%`
      : quantity.lossMode === '면적'
        ? `면적 기준 로스 ${quantity.lossPct}%`
        : `추정 로스 ${quantity.lossPct}%`;

  // "조건 바꾸기"에서 그대로 이어 쓸 수 있게 같은 d 쿼리를 되돌려 준다
  const backHref = d ? `/v1/calc/wallpaper?d=${d}` : '/v1/calc/wallpaper';

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
            <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em] whitespace-nowrap">
              {formatManRange(cost.min, cost.max)}
            </div>
            {cost.mode === '산식' && (
              <span className="text-[14px] font-semibold text-brown bg-v1-badge-gold-bg border border-gold rounded-[6px] px-[10px] py-[2px] whitespace-nowrap">
                추정
              </span>
            )}
          </div>
          <p className="text-[16px] font-semibold text-v1-text-secondary tabular-nums">
            중간 {toMan(cost.mid).toLocaleString('ko-KR')}만원
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
