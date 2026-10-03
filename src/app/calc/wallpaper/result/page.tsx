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
// 안 고른 상태로 공유된 링크는 계산 자체를 안 하고(2026-09-09 새 규칙) 빈 상태를 보여준다.
//
// 작성일: 2026년 08월 28일
// 2026년 09월 09일: toCalcInput을 toEngineInput 기반으로 교체(새 필드 전부 반영), 제품 목록 배선
// 2026년 09월 09일(재배치): 벽지 종류 병합(합집합) 즉답 폐기 — calcFromState가 단일 호출만 한다
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
import { toEngineInput, describePreciseInput, describeAreaPair, type WallpaperAssumption } from '@/lib/v1/wallpaperEngineInput';
import { formatManRange, formatNum, toMan } from '@/lib/v1/money';
// 2026-09-15 디자인 통일 작업: 결과 화면 저장·공유 부품을 계산기 3종 공용 위치로 옮겼다
import { PostToBoardCheckbox, ResultFab } from '../../_components/ResultActions';
import CalcContactCta from '../../_components/CalcContactCta';
// 비용 구성 한 줄 표기 — 즉답 화면(ResultPanel.tsx)과 완전히 같은 규칙을 쓰려고 공용 파일로
// 뺐다(2026-09-27 4차 검수 지적 2번 — 만 원 미만 단가가 "0만"으로 보이던 문제 수리)
// 2026-09-27 배포 전 검사관 지적 7번: 롤 수 범위·"제품 미정" 표시도 즉답 화면과 같은
// 함수(formatRollsText·describeWallpaperAreaAssumptionLine)로 맞춘다 — 안 그러면 공유
// 링크를 받은 사람이 보낸 사람과 다른 정보를 보게 된다.
import { formatCostLineAmount, formatRollsText } from '../../_components/costLineFormat';
import { describeWallpaperAreaAssumptionLine } from '../../_components/assumptionText';
// 2026-09-30 지휘관 긴급 전달(중요 1 남은 부분) — 이 화면이 API(route.ts)와 같은 검증을
// 거치게 한다. 공유 링크에 서버가 거절할 값(범위 밖 등)이 들어 있으면 계산 자체를 안 하고
// "조건을 다시 넣어 주세요"를 보여준다(검증 없이 계산해 버리던 사고 수리).
import { parseInput, ValidationError } from '@/server/calc/validate/wallpaper';
// 2026-09-30 결함 수리(경미 결함 2번) — 공유 링크(?d=)를 조작해 방 목록(preciseRooms)이나
// 방 하나의 문·창 목록(openings)이 배열이 아닌 값으로 들어오면 계산 전에 걸러 500을 막는다.
import { isArrayFieldOk, safeCalc } from '../../_components/resultGuard';

export const metadata = {
  title: '도배 계산기 결과 — 얼마드나',
  // 결과 페이지는 ?d= 조건값에 따라 주소가 무한히 갈라진다(공유 링크마다 다른 주소).
  // 검색엔진에는 전부 "같은 페이지의 변형"이라고 알려주기 위해 canonical을 원본
  // 계산기 페이지로 모아준다(2026-09-14, 형아 지시: 계산기 SEO 정비).
  alternates: { canonical: 'https://ulmadna.com/calc/wallpaper' },
  // 2026-09-30 검사관 10차 — 결과 공유 화면은 사람마다 조건이 다 달라(남의 견적 조건)
  // 검색에 안 잡히게 한다. 계산기 자체(alternates 위)는 그대로 색인된다.
  robots: { index: false, follow: true },
};

// 2026-09-11 검사관 지적: 시세(/calc/price)·질문(/calc/q) 페이지가 아직 없다.
// 페이지가 생길 때까지 이 화면의 관련 링크·하단 CTA 버튼에서 해당 링크만 숨겨둔다.
const SHOW_UNFINISHED_LINKS = false;

/**
 * 폼 상태 → 서버 계산 결과 + 가정 목록.
 * 즉답 화면의 훅과 같은 toEngineInput으로 요청을 만들어, 같은 조건이면 같은 금액이 나오게 한다.
 * toEngineInput이 null이면(벽지 종류 미선택 / simple인데 평형 없음 / precise인데 치수 없음)
 * 이 함수도 null을 돌려주고, 페이지가 "조건이 비어 있어요" 빈 상태를 보여준다.
 *
 * 2026-09-27 배포 전 검사관 지적 7번: engineInput.assumed(무엇을 가정해서 계산했는지)도
 * 같이 돌려준다 — 예전엔 이 값을 버려서, 공유 링크로 제품을 안 정한 채 받은 사람은
 * "제품 미정" 표시도 롤 수 범위도 못 보고 대표값 하나만 봤다(보낸 사람과 다른 정보).
 *
 * 2026-09-30 지휘관 긴급 전달(중요 1 남은 부분) — toEngineInput은 모양만 맞추는 순수
 * 함수라 값 범위를 검사하지 않는다. 그래서 서버가 거절할 값(예: 높이 10m)이 든 공유
 * 링크를 열면 API를 거치지 않고 그대로 계산돼 버렸다. calcWallpaper를 부르기 직전에
 * API 라우트(route.ts)와 완전히 같은 parseInput으로 한 번 더 검사한다 — 통과 못 하면
 * 'invalid'를 돌려주고, 페이지가 "조건을 다시 넣어 주세요"를 보여준다.
 */
type CalcOutcome =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'ok'; result: WallpaperCalcResult; assumed: WallpaperAssumption[] };

/**
 * 공유 링크(?d=)를 조작해 배열이어야 할 자리가 배열이 아니면(예: preciseRooms를 문자열로
 * 바꿔치기) true를 돌려준다. 방 목록 자체와, 방 하나마다 있는 문·창 목록(openings)까지
 * 확인한다(2026-09-30 결함 수리 — 그대로 두면 이 화면이 500이 났다).
 */
function hasMalformedWallpaperShape(state: WallpaperFormState): boolean {
  if (!isArrayFieldOk(state.preciseRooms)) return true;
  if (Array.isArray(state.preciseRooms)) {
    return state.preciseRooms.some((r) => !isArrayFieldOk((r as { openings?: unknown })?.openings));
  }
  return false;
}

function calcFromState(
  state: WallpaperFormState,
  products: ReturnType<typeof toWallpaperProductOptions>,
): CalcOutcome {
  const engineInput = toEngineInput(state, products);
  if (!engineInput) return { kind: 'empty' };
  const { base, paper, assumed } = engineInput;
  const request: WallpaperCalcInput = { ...base, paperType: paper.paperType, product: paper.product };
  try {
    // parseInput은 body(unknown)를 받는 함수라 이미 만든 request 객체를 그대로 넣어도
    // 똑같이 한 칸씩 검사해 준다(같은 타입이라 통과하면 값이 그대로 나온다).
    const validated = parseInput(request);
    return { result: calcWallpaper(validated), assumed, kind: 'ok' };
  } catch (e) {
    if (e instanceof ValidationError) return { kind: 'invalid' };
    throw e;
  }
}

/** 조건 요약 1줄 (예: "34평 · 3베이 · 전체 · 천장 포함 · 실크") */
function buildSummary(state: WallpaperFormState): string {
  const parts: string[] = [];
  // describePreciseInput()이 view까지 반영해 정밀 폼이 실제로 유효한지 판정한다(resolveView
  // 공통 규칙 — toEngineInput과 똑같은 기준). 정밀이 아니면 즉답(평형) 방식이다 — 옛
  // mode('평형'/'실측'/'면적') 필드는 지금 화면에서 아무도 안 채우는 죽은 필드라 더 안 본다
  // (검사관 2라운드 지적 4번).
  const precise = describePreciseInput(state);
  if (precise?.kind === 'room') {
    parts.push(`실측 ${precise.count}개 실`);
  } else if (precise?.kind === 'length') {
    parts.push(`벽 길이 ${state.wallLength}m`);
  } else {
    // 간단 모드 — 평형(공급) 또는 ㎡(전용) 중 지금 쓰는 값을 "34평 · 84㎡"로 병기한다
    // (2026-09-15 ㎡ 모드 추가. describeAreaPair가 null이면 옛 공유 링크 등 예외라 평형만 적는다)
    parts.push(describeAreaPair(state) ?? `${state.pyeong}평`, `${state.bay ?? 3}베이`);
    parts.push(Array.isArray(state.scope) ? '방 고르기' : state.scope === '거실주방' ? '거실·주방' : '전체');
  }

  // 범위 — 벽만 / 천장만 / 벽+천장 (2026-09-09 벽·천장 각각 토글)
  parts.push(state.target === 'wall' ? '벽만' : state.target === 'ceiling' ? '천장만' : '벽+천장');

  // 2026-09-09부터 견적은 전부 구축 기준. 철거를 껐을 때만 그 사실을 적는다
  parts.push('구축 기준');
  if (state.removeOld === false) parts.push('철거 제외');

  // 이 함수가 불리는 시점엔 이미 계산이 성공한 뒤라 paperType은 항상 있다(2026-09-09 새
  // 규칙 — 벽지 종류를 안 고르면 calcFromState가 null을 돌려주고 이 화면 자체가 안 그려진다).
  parts.push(state.paperType as string);
  return parts.join(' · ');
}

// 비용 구성 한 줄 표기(formatCostLineAmount)는 위에서 costLineFormat.ts를 import해 쓴다 —
// 즉답 화면(ResultPanel.tsx)이 쓰던 것과 완전히 같은 함수라 여기서 따로 만들지 않는다.

interface PageProps {
  searchParams: Promise<{ d?: string }>;
}

export default async function WallpaperResultPage({ searchParams }: PageProps) {
  const { d } = await searchParams;
  // 공유 링크 자체가 없거나(d 없음) 깨진(디코드 실패) 경우를 조용히 기본값으로 채우지 않는다
  // — 그러면 "입력이 빈 경우"(아래 !result 분기)를 거치지 못하고 항상 뭔가 계산돼 버린다.
  // 디코드 실패도 그대로 null로 두고, "빈 상태"를 한 곳(!state || !result)에서만 처리한다.
  const state = decodeWallpaperForm(d);
  // 제품 마스터는 입력 화면(page.tsx)과 같은 순수 함수로 변환한다(중복 제거)
  const products = toWallpaperProductOptions(WALLPAPER_PRODUCTS);
  // "조건 바꾸기"에서 그대로 이어 쓸 수 있게 같은 d 쿼리를 되돌려 준다
  const backHref = d ? `/calc/wallpaper?d=${d}` : '/calc/wallpaper';

  // 2026-09-30 결함 수리(경미 결함 2번) — 배열이어야 할 자리가 배열이 아니면 계산을 아예
  // 시도하지 않는다. safeCalc는 이 검사로도 못 잡는 더 깊은 모양 문제까지 대비한 마지막
  // 방어선이다(무엇이 터지든 500 대신 'invalid'로 떨어진다).
  const outcome: CalcOutcome = state
    ? hasMalformedWallpaperShape(state)
      ? { kind: 'invalid' }
      : safeCalc(
          () => calcFromState(state, products),
          () => ({ kind: 'invalid' as const }),
        )
    : { kind: 'empty' };

  // 공유 링크가 없거나·깨졌거나·디코드는 됐지만 입력이 완전히 비어 있으면(벽지 미선택 /
  // simple인데 평형 없음 / precise인데 치수 없음) 조용히 기본값으로 바꿔치기하지 않고
  // 빈 상태를 그대로 보여준다 — 원인이 달라도 전부 같은 화면이다.
  //
  // 2026-09-30 지휘관 긴급 전달 — "입력이 비어 있음"(empty)과 "값은 있는데 서버 범위를
  // 벗어남"(invalid)은 원인이 달라서 문구도 다르게 보여준다(형아 지시: 문구 새로 만들지
  // 말라는 원칙과 별개로, 이 두 문구는 이번 수리에서 지시받은 것 그대로다).
  if (!state || outcome.kind !== 'ok') {
    return (
      <>
        <TopNav
          title="도배 계산기"
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
            <p className="text-[15px] text-v1-text-secondary">
              {outcome.kind === 'invalid' ? '조건을 다시 넣어 주세요' : '조건이 비어 있어요'}
            </p>
            {outcome.kind === 'invalid' && (
              <Link href="/calc/wallpaper" className="inline-block mt-3">
                <Button>계산기로 가기</Button>
              </Link>
            )}
          </Card>
        </div>
      </>
    );
  }

  const { result, assumed } = outcome;
  const { quantity, submaterials, cost } = result;
  // 로스 근거 라벨: 실제/추정/면적 기준으로 문구가 달라진다(설계 정본 카드1 규칙)
  const lossLabel =
    quantity.lossMode === '실제'
      ? `실제 로스 ${quantity.lossPct}%`
      : quantity.lossMode === '면적'
        ? `면적 기준 로스 ${quantity.lossPct}%`
        : `추정 로스 ${quantity.lossPct}%`;

  // 2026-09-27 배포 전 검사관 지적 7번 — 즉답 화면(ResultPanel.tsx)과 같은 함수로
  // "34평 · 84㎡ · 제품 미정" 같은 가정 줄을 만든다. 간단 모드(평형)일 때만 면적 병기가
  // 뜻이 있다.
  const areaPairText = quantity.inputMode === '평형' ? describeAreaPair(state) : null;
  const areaAssumptionLine = describeWallpaperAreaAssumptionLine(areaPairText, assumed);

  return (
    <>
      <TopNav
        title="도배 계산기"
        backHref="/calc"
        rightSlot={
          <Link href={backHref} className="text-[16px] font-semibold text-brown">
            조건 바꾸기
          </Link>
        }
      />

      {/* px-5: 상단바(TopNav)와 좌우 여백을 맞춘다 */}
      <div className="px-5 py-4 pb-40 lg:pb-8 flex flex-col gap-4 max-w-[720px] mx-auto">
        <p className="text-[13px] text-v1-text-secondary tabular-nums">{buildSummary(state)}</p>

        {/* 결과 카드 — 2026-09-15 디자인 통일 지시: 카드 속 카드 금지, 테두리 카드는 이거
            하나뿐이다. 물량 → 부자재 → 비용을 얇은 구분선(구획 제목 17/700)으로만 나눈다. */}
        <Card>
          {/* 물량 — 제품 미정이면 롤 수도 범위로("19~46롤", 검사관 지적 7번: 즉답 화면과
              같은 함수 formatRollsText를 써서 보낸 사람이 본 값과 반드시 같게 한다) */}
          <div className="text-[34px] font-extrabold text-brown tabular-nums leading-[1.15] tracking-[-0.02em]">
            {formatRollsText(quantity)}
          </div>
          {/* 2026-10-03 사장 지적 1번(공유 화면까지 확대 적용) — 수량 한 줄은 즉답 화면
              (ResultPanel.tsx)과 같은 "요약" 톤: 15px·ink·수량 숫자라 굵기 600 */}
          <p className="text-[15px] font-semibold text-ink leading-[1.6] tabular-nums">
            벽 {quantity.wallSqm}㎡ · 천장 {quantity.ceilingSqm}㎡ · {lossLabel}
          </p>
          {/* 면적·가정 한 줄 — "제품 미정" 등(검사관 지적 7번). 즉답 화면 ResultPanel.tsx와
              같은 자리·같은 함수를 쓴다. 색만 즉답 화면과 같은 ink-2로 맞춘다(크기·굵기는 그대로) */}
          {areaAssumptionLine && <p className="text-[13px] text-ink-2 tabular-nums">{areaAssumptionLine}</p>}
          {/* 면적(벽 길이) 모드는 방별 물량이 없어 "실별 보기"가 뜻이 없다 — 숨긴다(검사관 지적 17번).
              2026-10-03: 접힘 속 세부는 "보조 정보"답게 13~14px·ink-2로 낮췄다(이름은 굵기
              400, 금액은 500, 캡션은 12.5px disabled) */}
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
                    <span className="text-[14px] text-ink-2">{r.name}</span>
                    <span className="text-[14px] font-medium text-ink-2 tabular-nums">
                      {r.rolls}롤{' '}
                      <span className="text-[12.5px] font-normal text-v1-text-disabled">{r1(r.wallSqm + r.ceilingSqm)}㎡</span>
                    </span>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {/* 부자재 — 섹션 제목은 소제목이라 굵기 600 유지, 크기만 17px→14px·ink-2로 낮췄다 */}
          <h2 className="text-[14px] font-semibold text-ink-2 border-t border-v1-line-2 pt-3 mt-1">부자재</h2>
          <div className="flex flex-col">
            {submaterials.map((s, i) => (
              <div key={s.key} className={`py-[10px] ${i === submaterials.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-ink-2">{s.name}</span>
                  <span className="text-[14px] font-medium text-ink-2 tabular-nums">
                    {formatNum(s.qty)}
                    {s.unit}
                  </span>
                </div>
                <p className="text-[12.5px] text-v1-text-disabled tabular-nums">{s.basis}</p>
              </div>
            ))}
          </div>

          {/* 비용 — "부자재"와 같은 소제목 톤 */}
          <h2 className="text-[14px] font-semibold text-ink-2 border-t border-v1-line-2 pt-3 mt-1">비용</h2>
          {/* 금액과 단위는 줄바꿈으로 갈라지면 안 되므로(디자인 가이드 원칙) whitespace-nowrap.
              배지가 자리 부족하면 배지만 다음 줄로 내려가게 flex-wrap 허용 */}
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
          {/* 기준 줄 — 즉답 화면과 같은 "요약" 톤(15px·ink), 굵기는 그대로(근거 문장이라 안 올림) */}
          <p className="text-[15px] text-ink tabular-nums">{cost.basisLine}</p>
          <Collapsible title="구성 보기" defaultOpen>
            <div className="flex flex-col">
              {cost.breakdown.map((line, i) => (
                <div key={line.key} className={`py-[10px] ${i === cost.breakdown.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-ink-2">{line.name}</span>
                    <span className="text-[14px] font-medium text-ink-2 tabular-nums">{formatCostLineAmount(line)}</span>
                  </div>
                  <p className="text-[12.5px] text-v1-text-disabled tabular-nums">{line.note}</p>
                </div>
              ))}
              <p className="text-[12.5px] text-v1-text-disabled pt-[10px]">소비자가 기준 · 부가세 포함</p>
            </div>
          </Collapsible>
        </Card>

        <PostToBoardCheckbox />

        {/* 관련 링크 — 시세(/calc/price)·질문(/calc/q) 페이지가 아직 없어서 숨김.
            지금은 실제로 열리는 블로그 글 2개만 보여준다 (2026-09-11 검사관 지적) */}
        <div className="bg-white border border-v1-line rounded-[4px] px-4">
          {SHOW_UNFINISHED_LINKS && <ListRow href="/calc/price">시세 · 실크 벽지 평당 단가</ListRow>}
          <ListRow href="/blog/wallpaper-cost">글 · 도배 견적서 확인 4가지</ListRow>
          {/* 뒤에 오는 "질문" 링크들이 숨겨진 동안은 이 행이 마지막이라 last를 켜서 구분선을 뺀다 */}
          <ListRow href="/blog/paint-vs-wallpaper-cost" last={!SHOW_UNFINISHED_LINKS}>
            글 · 합지와 실크, 무엇이 다른가
          </ListRow>
          {SHOW_UNFINISHED_LINKS && (
            <>
              <ListRow href="/calc/q">질문 · 도배 210만원 적정한가요</ListRow>
              <ListRow href="/calc/q" last>
                질문 · 살림집 추가비 얼마 붙나요
              </ListRow>
            </>
          )}
        </div>

        <CalcContactCta />
        <Disclaimer />
      </div>

      {/* 하단 고정 — 모바일은 화면 하단에 고정, PC(lg)는 콘텐츠 흐름 안 인라인 버튼으로 */}
      {/* px-5: 위 본문과 좌우 여백을 맞춘다(모바일 고정바 기준). PC는 정적 배치로 바뀌며 lg:px-0 유지 */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-4 pt-2 flex flex-col gap-3 max-w-[720px] mx-auto lg:static lg:max-w-[720px] lg:px-0 lg:pb-8">
        <div className="flex justify-end">
          <ResultFab shareText="얼마드나 도배 계산 결과를 확인해 보세요" />
        </div>
        {/* /calc/q 페이지가 아직 없어서 숨김 (2026-09-11 검사관 지적) */}
        {SHOW_UNFINISHED_LINKS && (
          <Link href="/calc/q">
            <Button fullWidth>이 조건으로 질문하기</Button>
          </Link>
        )}
      </div>
    </>
  );
}

/** 소수점 1자리 반올림 (실별 보기 면적 합산용) */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
