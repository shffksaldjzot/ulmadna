// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 오케스트레이터 (클라이언트)
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 적용 — 옛 StepFlow/useStepFlow(9/16 도입)를
// 새 공용 틀(flow/*)로 완전히 새로 짰다. 핵심 변화:
//   · 좁혀가기(1절 결정 1번): 벽지 종류 하나만 골라도 바로 결과가 뜬다. 안 고른 값은
//     계산 담당(useWallpaperCalc)이 가정값(34평·종류 전체 범위·3베이 등)으로 채워 계산하고,
//     "무엇을 가정했는지"를 assumed 목록으로 돌려준다 — allDone을 기다리지 않는다.
//   · 범위(벽·천장)·베이는 단계에서 빼서 "조정 칩"(결과 위)으로 옮겼다. 조정 칩은 계산
//     담당에게 touched.bay·touched.scope로 "사용자가 직접 건드렸는지"를 알려 준다 —
//     안 건드렸으면 기본값으로 계산되고 가정 목록에 표시된다.
//   · 제품은 목록 드롭다운 대신 시트(ProductSheet)로 고른다. "아직 안 정했어요"를 골라도
//     이 단계는 완료된다(그 종류 전체 범위로 계산).
//   · 뒤로 가기·새로 고침 복원(flow/useFlowBackNav·flow/sessionPersist)을 새로 붙였다.
//
// 옛 부품(StepFlow.tsx·useStepFlow.ts·ModePicker.tsx)은 바닥재·미장이 아직 쓰므로
// 손대지 않았다. ModePicker는 그대로 재사용한다(3-10절: 첫 화면 카드 두 장은 유지).
//
// 작성일: 2026년 09월 08일
// 2026년 09월 09일: B·C 지시서 완료 배선(lengthOpenings·product 포함)
// 재배치: 2026년 09월 09일 (벽지 최우선 A안 — 벽지 카드 1번 고정, 모드 세그먼트 도입)
// 튜토리얼식 단계 안내: 2026년 09월 16일
// 단계 흐름 2판(좁혀가기·조정 칩·제품 시트·뒤로 가기·새로 고침 복원): 2026년 09월 27일
// 합지/실크 선택 단계 없앰(2026년 10월 29일): 단계가 [벽지 → 면적/실측] 두 개가 됐다.
//   벽지 목록 한 줄마다 [합지]/[실크]가 붙어 있고, 고른 줄의 종류가 그대로 paperType이 된다.
//   폼 상태 모양(paperType·productCode·product)은 그대로라 공유 링크·결과 화면·엔진은 안 바뀐다.
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Segment from '@/components/v1/Segment';
import Chip from '@/components/v1/Chip';
import {
  DEFAULT_CALC_FORM,
  decodeWallpaperForm,
  type WallpaperFormState,
  type WallpaperProductOption,
} from '@/lib/v1/wallpaperQuery';
import { useWallpaperCalc } from '@/lib/v1/useWallpaperCalc';
import { describePreciseInput, MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM } from '@/lib/v1/wallpaperEngineInput';
import {
  MIN_SUPPLY_PYEONG,
  MAX_SUPPLY_PYEONG,
  ROOM_HEIGHT_M_MIN,
  ROOM_HEIGHT_M_MAX,
  isWithinRange,
  isRoomDimValid,
  isOpeningDimValid,
} from '../_components/inputRanges';
import { formatManRange } from '@/lib/v1/money';
// GA4 — 계산기 화면 진입 이벤트(마운트 1번만)
import { track } from '@/lib/analytics';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import PaperPicker, { type PaperSelectionChange } from './PaperPicker';
import ConditionChips from './ConditionChips';
import ResultPanel from './ResultPanel';
import AreaPendingCard from '../_components/AreaPendingCard';
// 광고 자리(2026-10-29): 결과가 보일 때만 — 표시 모드(관리자)는 결과 전에도
import CalcAdSlot from '@/components/ads/CalcAdSlot';
import { CALC_AD_PROCESS } from '@/lib/ads/pricing';
import { describeWallpaperBottomBarAssumption } from '../_components/assumptionText';
import FlowShell from '../_components/flow/FlowShell';
import AdjustChips from '../_components/flow/AdjustChips';
import BottomBar from '../_components/flow/BottomBar';
import { useFlowSteps } from '../_components/flow/useFlowSteps';
import { useResultReveal } from '../_components/flow/useResultReveal';
import { useFlowBackNav } from '../_components/flow/useFlowBackNav';
import { useSheetBackNav } from '../_components/flow/useSheetBackNav';
import { loadSessionState, saveSessionState } from '../_components/flow/sessionPersist';
import type { FlowStepDef } from '../_components/flow/types';
import ModePicker, { type CalcViewMode } from '../_components/ModePicker';

interface WallpaperCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: WallpaperProductOption[];
}

/**
 * 새로 고침 복원(sessionStorage) 열쇠·판 번호 — 모양이 바뀌면 SESSION_VERSION을 올려서 옛 값을 버린다.
 * 2026-09-29: touched 저장 모양을 자리 번호 배열 → 단계 이름(key) 사전으로 바꿔서 1→2로 올렸다
 * (모드 전환 손댐 오판정 수리 — 아래 isValidWallpaperSession 주석 참고). 옛 배열 값은 버전이
 * 안 맞아 loadSessionState가 그냥 null로 취급하므로 에러 없이 기본 상태로 시작한다.
 */
const SESSION_KEY = 'calc:wallpaper:v1';
// 2026-10-29: 합지/실크 단계('paperType')를 없애 단계 이름이 바뀌어 2→3으로 올렸다(옛 저장값은 버린다)
const SESSION_VERSION = 3;

/** 뒤로 가기 스택에서 "이 계산기가 쌓은 몫"을 구분하는 값 */
const CALC_ID = 'wallpaper';

/** 세션에 저장하는 값의 모양 */
interface WallpaperSession {
  form: WallpaperFormState;
  /** 단계 이름(key)별로 실제로 손댔는지(useFlowSteps의 touchedMap) — 2026-09-29부터 이름 기준 */
  touched: Record<string, boolean>;
  /** ModePicker를 이미 지나왔는지 */
  userPickedMode: boolean;
  /** 조정 칩(베이·범위)을 사용자가 직접 건드렸는지 */
  bayTouched: boolean;
  scopeTouched: boolean;
}

/**
 * 세션에서 읽은 값이 우리가 기대하는 모양인지 검사한다(2026-09-27 검사관 지적 11번).
 * 필수 칸이 없거나 형이 다르면(예: touched가 배열이 아님) false — 부르는 쪽이 이 값을
 * 통째로 버리고 기본 상태로 시작하게 한다. 옛 판(형식이 바뀌기 전) 데이터나, 다른 코드가
 * sessionStorage를 건드려 놓은 경우 등을 방어한다.
 */
/**
 * 개구부(문·창) 목록 하나가 우리가 기대하는 모양인지 — {kind, w, h, count} 전부 정확한 형.
 * 2026-09-27 배포 전 재검수 지적 3번: preciseRooms 안쪽까지 안 보면, 방은 배열인데 그 안의
 * openings가 배열이 아니거나 방 자체가 {w,d} 없이 이상한 값이면 나중에 정밀 폼 컴포넌트가
 * `.filter`·`.map`을 부르다 그대로 멈춘다.
 */
function isValidOpening(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    (o.kind === 'door' || o.kind === 'window') &&
    typeof o.w === 'number' &&
    typeof o.h === 'number' &&
    typeof o.count === 'number'
  );
}

/** 정밀 폼 방 하나(PreciseRoomInput)의 모양 검사 — w·d는 필수 숫자, h는 있으면 숫자, openings는 배열 */
function isValidPreciseRoom(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  if (typeof r.w !== 'number' || typeof r.d !== 'number') return false;
  if (r.h !== undefined && typeof r.h !== 'number') return false;
  if (!Array.isArray(r.openings) || !r.openings.every(isValidOpening)) return false;
  return true;
}

/**
 * 세션에 저장된 폼 상태(WallpaperFormState) 자체의 모양을 검사한다(2026-09-27 배포 전
 * 재검수 지적 3번). 실제 사고 사례: preciseRooms가 배열이 아닌 값으로 저장돼 있으면
 * `(state.preciseRooms ?? []).filter is not a function`으로 화면이 그대로 멈췄다.
 * 여기서 배열·숫자·문자열·허용된 값까지 미리 걸러서, 하나라도 어긋나면 세션 전체를
 * 버리고 기본 상태로 시작하게 한다(폼 안쪽 칸 하나 때문에 전체를 못 쓰게 되는 게
 * 어설프게 부분만 살리는 것보다 안전하다 — 계산에 쓰는 값들끼리 서로 앞뒤가 안 맞을
 * 위험이 없어진다).
 */
function isValidWallpaperFormState(v: unknown): v is WallpaperFormState {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;

  // 필수 칸(WallpaperFormState 정의상 물음표가 없는 칸) — 없거나 모양이 다르면 바로 탈락
  if (f.mode !== '평형' && f.mode !== '실측' && f.mode !== '면적') return false;
  if (typeof f.ceiling !== 'boolean') return false;
  if (
    f.scope !== '전체' &&
    f.scope !== '거실주방' &&
    !(Array.isArray(f.scope) && f.scope.every((s) => typeof s === 'string'))
  ) {
    return false;
  }

  if (f.paperType !== undefined && f.paperType !== '합지' && f.paperType !== '실크') return false;
  if (f.view !== undefined && f.view !== 'simple' && f.view !== 'precise') return false;
  if (f.areaUnit !== undefined && f.areaUnit !== '평' && f.areaUnit !== '㎡') return false;
  if (f.bay !== undefined && f.bay !== 2 && f.bay !== 3 && f.bay !== 4) return false;
  if (f.pyeong !== undefined && typeof f.pyeong !== 'number') return false;
  if (f.exclusiveSqm !== undefined && typeof f.exclusiveSqm !== 'number') return false;
  if (f.target !== undefined && f.target !== 'wall' && f.target !== 'ceiling' && f.target !== 'both') return false;
  if (f.entry !== undefined && f.entry !== 'room' && f.entry !== 'length') return false;
  if (f.unit !== undefined && f.unit !== 'mm' && f.unit !== 'm') return false;
  if (f.heightM !== undefined && typeof f.heightM !== 'number') return false;
  if (f.wallLength !== undefined && typeof f.wallLength !== 'number') return false;
  if (f.directCeilingSqm !== undefined && typeof f.directCeilingSqm !== 'number') return false;
  if (f.removeOld !== undefined && typeof f.removeOld !== 'boolean') return false;
  if (f.productCode !== undefined && typeof f.productCode !== 'string') return false;
  if (f.product !== undefined) {
    if (!f.product || typeof f.product !== 'object') return false;
    const p = f.product as Record<string, unknown>;
    if (typeof p.rollPrice !== 'number' || typeof p.widthCm !== 'number' || typeof p.lengthM !== 'number') return false;
    if (p.repeatCm !== undefined && typeof p.repeatCm !== 'number') return false;
  }
  // 실제 사고가 났던 그 칸 — 배열이어야 하고, 안의 방 하나하나도 모양이 맞아야 한다
  if (f.preciseRooms !== undefined && (!Array.isArray(f.preciseRooms) || !f.preciseRooms.every(isValidPreciseRoom))) {
    return false;
  }
  if (f.lengthOpenings !== undefined && (!Array.isArray(f.lengthOpenings) || !f.lengthOpenings.every(isValidOpening))) {
    return false;
  }
  return true;
}

/**
 * 2026-09-29: touched가 "단계 이름(key) → 손댔는지" 사전인지 검사한다(옛 판은 배열이었다 —
 * SESSION_VERSION을 올려서 애초에 옛 데이터는 여기까지 안 오지만, 혹시 몰라 모양도 한 번 더 본다).
 */
function isValidTouchedMap(v: unknown): v is Record<string, boolean> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((t) => typeof t === 'boolean');
}

function isValidWallpaperSession(v: unknown): v is WallpaperSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (!isValidWallpaperFormState(s.form)) return false;
  if (!isValidTouchedMap(s.touched)) return false;
  if (typeof s.userPickedMode !== 'boolean') return false;
  if (typeof s.bayTouched !== 'boolean') return false;
  if (typeof s.scopeTouched !== 'boolean') return false;
  return true;
}

/** 제목 줄 모드 전환 옵션 — 값은 폼 상태 view와 그대로 맞춘다 */
const VIEW_OPTIONS = [
  { value: 'simple' as const, label: '간단하게' },
  { value: 'precise' as const, label: '정확하게' },
];

export default function WallpaperCalculator({ products }: WallpaperCalculatorProps) {
  const searchParams = useSearchParams();
  const hasSharedLink = !!searchParams.get('d');

  // 공유 링크(?d=)가 있으면 그 값이 최우선(지시서 4-4절). 없으면 세션에 남은 값을 복원하고,
  // 그마저 없으면 기본값(간단 모드, 벽지 미선택)으로 시작한다.
  // 2026-09-27 검사관 지적 11번: 읽은 값의 모양을 검사하고(isValidWallpaperSession), 복원
  // 도중 무엇이 터지더라도(try/catch) 계산기 화면 자체는 반드시 뜨게 한다 — 둘 다 걸리면
  // 그냥 null(기본 상태)로 시작한다.
  const restored = useMemo<WallpaperSession | null>(() => {
    if (hasSharedLink) return null;
    try {
      const loaded = loadSessionState<unknown>(SESSION_KEY, SESSION_VERSION);
      return isValidWallpaperSession(loaded) ? loaded : null;
    } catch {
      return null;
    }
  }, [hasSharedLink]);

  const initial = useMemo<WallpaperFormState>(() => {
    const shared = decodeWallpaperForm(searchParams.get('d'));
    return shared ?? restored?.form ?? DEFAULT_CALC_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 폼 상태는 이 컴포넌트 한 곳에서만 들고 있는다. 자식은 값과 onChange만 받는다.
  const [form, setForm] = useState<WallpaperFormState>(initial);
  // 모바일 하단 고정 요약 바의 "자세히"가 스크롤해서 이동할 대상
  const resultRef = useRef<HTMLDivElement>(null);

  // 모드(간단/정확)를 이미 골랐는지 — 공유 링크나 세션 복원 값이 있으면 처음부터 true
  const [userPickedMode, setUserPickedMode] = useState(hasSharedLink || !!restored?.userPickedMode);
  const modeChosen = hasSharedLink || userPickedMode;

  // 조정 칩(베이·범위)을 사용자가 직접 건드렸는지 — 계산 담당의 touched.bay·touched.scope로 넘긴다.
  // 공유 링크(?d=)는 그 안의 베이·범위 값도 사용자가 이미 정해서 인코딩한 값이므로, 단계처럼
  // "손댄 것"으로 본다(4-4절 "공유값이 우선이고 전부 완료 상태로 시작" — 조정 칩까지 확장 적용).
  const [bayTouched, setBayTouched] = useState(hasSharedLink || !!restored?.bayTouched);
  const [scopeTouched, setScopeTouched] = useState(hasSharedLink || !!restored?.scopeTouched);

  // 제품 목록 시트 열림 여부 — 2026-09-27 검사관 7차 지적(치명) 수리로 이 최상위(절대
  // 언마운트 안 되는) 계산기 부품이 직접 갖는다. 예전엔 PaperPicker(시트를 담은 부품)
  // 안에 있었는데, 모드 카드로 돌아가면 PaperPicker가 통째로 사라져(리액트 언마운트)
  // 뒤로 가기 스택에 쌓아 둔 "앞으로=다시 열기" 클로저가 죽은 인스턴스를 가리키게 되는
  // 사고가 있었다. 여기서 관리하면 모드 카드를 오가도 이 값과 그걸 바꾸는 함수 둘 다
  // 살아남는다.
  const [sheetOpen, setSheetOpen] = useState(false);

  // GA4 — 도배 계산기 화면에 들어왔다는 이벤트를 딱 1번만 보낸다(마운트 시점)
  useEffect(() => {
    track('calc_view', { process: 'wallpaper' });
  }, []);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<WallpaperFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  /**
   * 벽지 목록 시트에서 무언가를 골랐을 때(목록 제품·"[종류] 아직 안 정했어요"·직접 입력 [적용])
   * 부르는 유일한 통로 — 2026-10-29 합지/실크 단계를 없애면서 setPaperType 대신 생겼다.
   * 종류·제품 코드·직접 입력 값을 늘 한꺼번에 바꿔서, 화면에 보이는 제품과 계산에 쓰는
   * 종류가 서로 어긋나는 일(검사관 지적 1번과 같은 사고)이 생길 틈을 없앤다.
   */
  function selectPaper(v: PaperSelectionChange) {
    patch({ paperType: v.paperType, productCode: v.productCode, product: v.product });
    touch('product');
  }

  const view = form.view ?? 'simple';

  // 2026-09-29: 3번째 단계는 모드에 따라 뜻이 다르다(간단="면적" vs 정확="실측") — 손댐을
  // 자리 번호가 아니라 이름(key)으로 구분해야 하므로, 모드별로 다른 key를 쓴다. 벽지
  // 종류(paperType)·제품(product)은 두 모드가 공유하는 뜻이라 key도 그대로 공유한다.
  const areaStepKey = view === 'simple' ? 'area' : 'measure';

  // ── 1단계(벽지)·2단계(면적/실측) 값 유효 여부(dataComplete) ──
  // 2026-10-29: 벽지 단계는 종류(paperType)가 정해져 있으면 유효하다 — 목록 제품·"[종류] 아직
  // 안 정했어요"·직접 입력 셋 다 종류를 같이 정하므로, 무엇을 골랐든 종류만 있으면 된다.
  // 실제 "완료" 여부는 touched로 갈린다.
  const step1Valid = !!form.paperType;
  // 2026-09-29 지적 2번: 서버 허용 범위(평 5~200 · ㎡ 20~300)를 벗어난 값은 "적었지만
  // 계산에 못 쓰는 값"이라 완료로 치지 않는다 — 그래야 그 단계가 미완료로 남아 가정값
  // (34평)으로 계산되고, 결과 공유도 숨는다(칸 아래 안내는 QuickAnswer가 그린다).
  const simpleAreaInRange =
    form.areaUnit === '㎡'
      ? isWithinRange(form.exclusiveSqm, MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM)
      : isWithinRange(form.pyeong, MIN_SUPPLY_PYEONG, MAX_SUPPLY_PYEONG);
  // 2026-09-30 지휘관 긴급 전달(중요 1) — 공통 높이(모든 방에 같이 적용)와 문·창 크기는
  // 화면 검사가 아예 없어서, 서버 범위를 벗어나면(높이 10m, 문·창 5cm/5000cm 등) 서버가
  // 거절해 "마지막 계산에 실패해 이전 값이에요"가 떴다 — 그 상태에서도 공유 버튼이 그대로
  // 보였다(별도로 error 상태에서 공유 숨김도 고침, 아래 canShare 참고).
  const heightInRange = isWithinRange(form.heightM, ROOM_HEIGHT_M_MIN, ROOM_HEIGHT_M_MAX);
  const roomsOpeningsValid = (form.preciseRooms ?? []).every((r) => r.openings.every((o) => isOpeningDimValid(o.w, o.h)));
  const lengthOpeningsValid = (form.lengthOpenings ?? []).every((o) => isOpeningDimValid(o.w, o.h));

  const step2Valid =
    view === 'simple'
      ? (form.areaUnit === '㎡' ? !!form.exclusiveSqm : !!form.pyeong) && simpleAreaInRange
      : describePreciseInput(form) !== null &&
        heightInRange &&
        (form.preciseRooms ?? []).every((r) => isRoomDimValid(r.w, r.d, r.h)) &&
        roomsOpeningsValid &&
        lengthOpeningsValid;

  // 정확 모드에서 계산 담당(useWallpaperCalc)에 넘길 값 — 범위를 벗어난 값"만" 빼고
  // 나머지로 계산한다(지적 2번 + 2026-09-30 지휘관 긴급 전달 "가정 표시 통일": 방·구역·
  // 문창 전부 같은 규칙 — 범인만 빼고 남은 것으로 계산). 방 자체 치수(가로·세로·높이)가
  // 범위 밖이면 그 방을 통째로 뺀다. 문·창은 범위 밖인 그 줄만 빼고 방은 남긴다(방까지
  // 통째로 빼면 멀쩡한 벽 면적까지 같이 사라진다). 공통 높이가 범위 밖이면 그 값만 안
  // 보내 엔진이 기본 높이(2.3m)를 쓰게 한다. 남은 게 없어지면 엔진이 기존 규칙대로
  // "실측이 비었다"로 보고 34평 가정으로 계산한다(엔진 파일은 안 건드렸다).
  const roomsForCalc = (form.preciseRooms ?? [])
    .filter((r) => isRoomDimValid(r.w, r.d, r.h))
    .map((r) => ({ ...r, openings: r.openings.filter((o) => isOpeningDimValid(o.w, o.h)) }));
  const lengthOpeningsForCalc = (form.lengthOpenings ?? []).filter((o) => isOpeningDimValid(o.w, o.h));
  const formForCalc =
    view === 'precise'
      ? {
          ...form,
          heightM: heightInRange ? form.heightM : undefined,
          preciseRooms: roomsForCalc,
          lengthOpenings: lengthOpeningsForCalc,
        }
      : form;

  // 단계 이름+유효성 — useFlowSteps에 넘기는 값과 아래 떠날 때 추적(calc_step_leave)에
  // 쓰는 값을 하나로 합친다(타일 계산기와 같은 방식, 따로 두 번 적지 않는다)
  const stepDefs = [
    { key: 'product', valid: step1Valid },
    { key: areaStepKey, valid: step2Valid },
  ];

  const { activeIndex, allDone, completeFlags, touchedMap, touch } = useFlowSteps({
    steps: stepDefs,
    allTouched: hasSharedLink,
    initialTouched: restored?.touched,
  });

  // 뒤로·앞으로 가기 배선 — 모드를 고를 때만 방문 기록에 쌓는다(4-3절). 2026-09-27 형아
  // 결정(끝낸 단계를 접지 않기)으로 단계 진행은 더 이상 여기 안 쌓는다 — 끝낸 단계도
  // 화면에서 안 접히므로 "뒤로 = 직전 단계 다시 열기"가 눈에 보이는 변화가 없어졌기
  // 때문이다(useFlowBackNav.ts 주석 참고). onReenterMode는 onExitToModePicker의
  // 정반대(모드를 다시 고른 것처럼)다.
  useFlowBackNav({
    calcId: CALC_ID,
    modeChosen,
    onExitToModePicker: () => {
      setUserPickedMode(false);
      // 모드 카드로 돌아가면 시트도 방어적으로 닫아 둔다(화면상 안 보이는 상태로 맞춤 —
      // 모드 카드 화면일 때는 어차피 시트를 안 그리지만, 값 자체도 false로 되돌려 둬야
      // 다음에 모드를 다시 골랐을 때 "시트가 열린 채로 시작"하는 일이 없다)
      setSheetOpen(false);
    },
    onReenterMode: () => setUserPickedMode(true),
  });

  // 제품 시트의 뒤로·앞으로 가기 감시 — 반드시 이 최상위(절대 언마운트 안 되는) 계산기가
  // 직접 부른다(useSheetBackNav.ts 주석 참고, 7차 검사 치명 수리의 핵심).
  useSheetBackNav({
    calcId: CALC_ID,
    open: sheetOpen,
    onClose: () => setSheetOpen(false),
    onReopen: () => setSheetOpen(true),
  });

  // 새로 고침 복원 — 공유 링크로 들어온 게 아니면 값이 바뀔 때마다 세션에 저장해 둔다.
  // 저장소를 못 쓰는 환경에서도(사생활 보호 창 등) saveSessionState 내부가 try/catch로 감싸
  // 화면 동작에는 지장이 없다.
  useEffect(() => {
    if (hasSharedLink) return;
    saveSessionState<WallpaperSession>(SESSION_KEY, SESSION_VERSION, {
      form,
      touched: touchedMap,
      userPickedMode,
      bayTouched,
      scopeTouched,
    });
  }, [form, touchedMap, userPickedMode, bayTouched, scopeTouched, hasSharedLink]);

  // ── 계산 담당 훅: touched를 넘겨야 가정 목록(assumed)이 화면 손댐 여부를 정확히 반영한다 ──
  // 2026-09-29: 'area' key로 직접 꺼낸다(자리 번호가 아니라 "간단 모드의 면적 단계" 그
  // 자체) — 정확 모드에서 'measure'를 아무리 손대도 이 값은 안 바뀐다. 계산 담당(엔진)도
  // touched.area는 view==='simple'일 때만 보므로, 정확 모드에선 이 값이 쓰이지 않는다.
  // 지적 2번: 범위를 벗어났으면 손댔어도 "안 손댄 것"으로 넘긴다 — 그래야 엔진이 폼의
  // 잘못된 값(예: 999평) 대신 34평 가정으로 계산한다(서버로 안 보내니 400도 안 난다).
  const { result, range, loading, error, stale, assumed: assumedFromEngine } = useWallpaperCalc(formForCalc, products, {
    touched: { area: touchedMap.area && simpleAreaInRange, bay: bayTouched, scope: scopeTouched },
  });
  // 2026-09-30 지휘관 긴급 전달(중요 2 + 가정 표시 통일) — 정확 모드에서 방·문창·공통
  // 높이 중 하나라도 범위 밖이라 빠지면, 엔진은 "남은 값만 보면 실측이 다 채워져 있다"고
  // 판단해 'measuring'(실측 입력 중) 가정을 안 넣어 준다(엔진은 걸러지기 전 사정을 모른다
  // — 엔진 파일은 안 건드렸다). 그래서 화면이 그 사정을 알고 있는 채로 'measuring'을
  // 직접 더해서 내려보낸다 — 기존 describeWallpaperAreaAssumptionLine·canShare가 이미
  // 'measuring'을 보고 "실측 입력 중" 표시·공유 숨김을 처리하고 있어서, 이 값 하나만
  // 더해 주면 나머지는 전부 기존 로직 그대로 맞아떨어진다. 방 수만 보면 놓치는 경우
  // (방은 그대로 남았는데 그 안의 문·창 줄 하나만 빠진 경우)까지 잡으려고 문·창 개수도
  // 같이 비교한다.
  const openingsCountBefore = (form.preciseRooms ?? []).reduce((s, r) => s + r.openings.length, 0);
  const openingsCountAfter = roomsForCalc.reduce((s, r) => s + r.openings.length, 0);
  const lengthOpeningsCountBefore = (form.lengthOpenings ?? []).length;
  const preciseFilteredDueToRange =
    view === 'precise' &&
    ((form.preciseRooms ?? []).length > roomsForCalc.length ||
      openingsCountAfter < openingsCountBefore ||
      lengthOpeningsForCalc.length < lengthOpeningsCountBefore ||
      !heightInRange);
  const assumed = preciseFilteredDueToRange && !assumedFromEngine.includes('measuring')
    ? [...assumedFromEngine, 'measuring' as const]
    : assumedFromEngine;

  // ── 2026-10-29 형아 지시: 면적을 사용자가 정하기 전에는 금액을 어디에도 안 보인다 ──
  // 기본값(34평)은 그대로 두고 "사용자가 골랐는지"로만 판단한다. 간단 모드는 면적 단계를
  // 손댔고 값이 범위 안일 때, 정확 모드는 실측 단계를 손댔을 때를 "골랐다"로 본다.
  // 공유 링크로 들어오면 useFlowSteps가 전부 손댄 것으로 시작하므로 골랐다고 친다.
  // 지금 보이는 결과가 아직 34평 가정으로 계산된 것이면(assumed에 'area' — 새 결과 도착 전
  // 잠깐) 그것도 금액을 숨긴다. 그래야 사용자가 고른 면적과 다른 금액이 한순간도 안 보인다.
  const areaChosen = view === 'simple' ? !!touchedMap.area && simpleAreaInRange : !!touchedMap.measure;
  const areaPending = !areaChosen || assumed.includes('area');
  // 금액 자리에 대신 보여 줄 한 줄(설명글 최소화 — 캡션 한 줄)
  const areaPendingText = view === 'simple' ? '면적을 고르면 바로 나와요' : '실측을 넣으면 바로 나와요';

  // 떠날 때(탭 닫기·다른 페이지로 이동) 어느 단계에 있었는지 1번 — 어디서 많이 그만두는지
  // 보려고(타일 계산기와 같은 이름·파라미터)
  const stepCount = stepDefs.length;
  const leaveRef = useRef({ mode: 'picker', step: '', stepNo: 0, done: false, hasResult: false });
  const leaveStep = stepDefs[Math.min(activeIndex, stepDefs.length - 1)]?.key ?? '';
  const leaveMode = !modeChosen ? 'picker' : view === 'precise' ? 'precise' : 'quick';
  const hasResult = !!result;
  // 최신 단계를 기억만 해 둔다(그릴 때가 아니라 그린 뒤에 적는다)
  useEffect(() => {
    leaveRef.current = { mode: leaveMode, step: leaveStep, stepNo: Math.min(activeIndex + 1, stepCount), done: allDone, hasResult };
  }, [leaveMode, leaveStep, activeIndex, stepCount, allDone, hasResult]);
  useEffect(() => {
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      const s = leaveRef.current;
      track('calc_step_leave', { process: 'wallpaper', mode: s.mode, step: s.step, step_no: s.stepNo, done: s.done, has_result: s.hasResult });
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') send();
    };
    window.addEventListener('pagehide', send);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', send);
      document.removeEventListener('visibilitychange', onHide);
      // 같은 사이트 안에서 다른 화면으로 넘어갈 때(화면이 사라질 때)도 1번
      send();
    };
  }, []);

  /** 폼 상태를 바꾸면서 동시에 "지금 모드의 면적/실측 단계를 손댔다"고 표시하는 도우미(3단계 전용) */
  function patchAreaStep(p: Partial<WallpaperFormState>) {
    patch(p);
    touch(areaStepKey);
  }

  /** 조정 칩 — 베이. 손댔다는 표시를 같이 남긴다(안 건드리면 계산 담당이 가정으로 본다) */
  function onBayChange(v: 2 | 3 | 4) {
    patch({ bay: v });
    setBayTouched(true);
  }
  /** 조정 칩 — 범위(벽·천장) */
  function onTargetChange(v: 'wall' | 'ceiling' | 'both') {
    patch({ target: v });
    setScopeTouched(true);
  }

  // ── 단계 정의 배열 하나로 — FlowShell이 이 배열만 보고 화면을 그린다(지시서 4-5절) ──
  const steps: FlowStepDef[] = [
    {
      key: 'product',
      // 2026-10-29: 합지/실크 단계를 없애고 벽지 한 목록에서 바로 고른다(줄마다 [합지]/[실크])
      title: '벽지',
      valid: step1Valid,
      content: (
        <PaperPicker
          sheetOpen={sheetOpen}
          onSheetOpenChange={setSheetOpen}
          paperType={form.paperType}
          productCode={form.productCode}
          products={products}
          product={form.product}
          onSelect={selectPaper}
          touched={touchedMap.product}
        />
      ),
    },
    {
      key: areaStepKey,
      title: view === 'simple' ? '면적' : '실측',
      valid: step2Valid,
      content:
        view === 'simple' ? (
          <QuickAnswer
            pyeong={form.pyeong ?? ''}
            onPyeongChange={(v) => patchAreaStep({ pyeong: v === '' ? undefined : v })}
            areaUnit={form.areaUnit ?? '평'}
            // 2026-09-27 검사관 지적 9번: 단위(평/㎡)만 바꾸는 건 "면적을 골랐다"는 뜻이
            // 아니다 — patchAreaStep(=touch(2) 포함) 대신 그냥 patch만 써서 단계 완료
            // 처리를 안 하게 한다(칩을 누르거나 숫자를 직접 넣어야만 손댄 것으로 친다).
            onAreaUnitChange={(v) => patch({ areaUnit: v })}
            exclusiveSqm={form.exclusiveSqm ?? ''}
            onExclusiveSqmChange={(v) => patchAreaStep({ exclusiveSqm: v === '' ? undefined : v })}
            onEnterComplete={() => touch(areaStepKey)}
            untouched={!touchedMap[areaStepKey]}
          />
        ) : (
          <PreciseSection
            entry={form.entry ?? 'room'}
            onEntryChange={(v) => patchAreaStep({ entry: v })}
            unit={form.unit ?? 'm'}
            onUnitChange={(v) => patchAreaStep({ unit: v })}
            target={form.target ?? 'both'}
            heightM={form.heightM ?? ''}
            onHeightChange={(v) => patchAreaStep({ heightM: v === '' ? undefined : v })}
            rooms={form.preciseRooms ?? []}
            onRoomsChange={(v) => patchAreaStep({ preciseRooms: v })}
            wallLength={form.wallLength ?? ''}
            onWallLengthChange={(v) => patchAreaStep({ wallLength: v === '' ? undefined : v })}
            directCeilingSqm={form.directCeilingSqm ?? ''}
            onDirectCeilingSqmChange={(v) => patchAreaStep({ directCeilingSqm: v === '' ? undefined : v })}
            lengthOpenings={form.lengthOpenings ?? []}
            onLengthOpeningsChange={(v) => patchAreaStep({ lengthOpenings: v })}
          />
        ),
    },
  ];

  // ── 조정 칩 — 결과가 있을 때만 보인다(3-12절). 간단 모드만 베이 칩이 붙는다(6절 표) ──
  const adjustGroups = [
    {
      key: 'scope',
      label: '범위',
      // 범위(벽·천장)는 각각 따로 켜고 끄는 묶음이다(둘 다 켤 수 있음) — ChipGroup에
      // role="group"으로 알려 준다(2026-09-29 지적 1번, AdjustChips가 multi를 본다)
      multi: true,
      children: <ConditionChips target={form.target ?? 'both'} onTargetChange={onTargetChange} />,
    },
    ...(view === 'simple'
      ? [
          {
            key: 'bay',
            label: '베이',
            children: (
              <>
                {[2, 3, 4].map((b) => (
                  <Chip key={b} asRadio selected={form.bay === b} onClick={() => onBayChange(b as 2 | 3 | 4)}>
                    {b}베이
                  </Chip>
                ))}
              </>
            ),
          },
        ]
      : []),
  ];

  /** 하단 고정 바 "자세히" — 결과 카드로 부드럽게 스크롤 */
  function scrollToResult() {
    track('calc_cta_click', { process: 'wallpaper', target: 'result_view' });
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 계산이 완전히 실패해(결과가 아예 없음) 보여줄 값이 없을 때만 하단 바가 "실패" 모습이 된다.
  // 결과가 있는 채로 다음 계산만 실패했으면(예: 값을 바꾸다 잠깐) 기존 결과를 그대로 보여준다
  // (ResultPanel이 그 경우 "마지막 계산에 실패해 이전 값이에요"를 따로 알려준다).
  const bottomFailed = !!error && !result;
  const currentStepTitle = steps[Math.min(activeIndex, steps.length - 1)]?.title ?? '';

  // 광고 자리를 보일지 — 면적을 고르기 전(금액 숨김 상태)에는 자리도 숨긴다(2026-10-29)
  const adsShown = !!result && !areaPending;
  // 2026-10-29: 마지막 단계까지 끝나고 금액 결과가 처음 보일 때 한 번, 결과 카드로 부드럽게 옮긴다
  useResultReveal(resultRef, allDone, adsShown);
  const adProcess = CALC_AD_PROCESS.wallpaper;

  // 첫 화면 — 아직 모드를 안 골랐으면 질문 하나만 보여준다(결과 패널·하단 바 전부 숨김)
  if (!modeChosen) {
    return (
      <>
        <TopNav title="도배 계산기" backHref="/calc" as="p" />
        {/* 표시 모드(관리자)에서만 — 결과 전이라 일반 방문자에겐 자리가 없다 */}
        <CalcAdSlot id="AD-H" show={false} desktopOnly />
        <div className="px-5 lg:px-8 max-w-[1120px] mx-auto">
          <ModePicker
            onPick={(v: CalcViewMode) => {
              patch({ view: v });
              setUserPickedMode(true);
            }}
          />
          <CalcAdSlot id="AD-P" processGroup={adProcess} show={false} />
          <CalcAdSlot id="AD-R" show={false} />
        </div>
      </>
    );
  }

  return (
    <>
      {/* 제목 줄(모바일 전용) 오른쪽에 작은 [간단|정확] 전환 — 3-10절. 본문 상단의 큰
          세그먼트+캡션은 삭제했다. as="p": 검색엔진용 진짜 h1은 page.tsx(서버)에 따로 있다 */}
      <TopNav
        title="도배 계산기"
        backHref="/calc"
        as="p"
        rightSlot={
          <Segment size="sm" options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} className="w-[136px]" ariaLabel="계산 모드" />
        }
      />

      {/* 광고 자리 AD-H — PC 에만(728×90), 상단바 아래. 휴대폰엔 넣지 않는다(형아 결정) */}
      <CalcAdSlot id="AD-H" show={adsShown} desktopOnly />

      <div className="px-5 lg:px-8 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        {/* 왼쪽 — 입력. 데스크톱은 제목 줄이 없으니(TopNav가 lg:hidden) 모드 전환을 여기 작게 둔다 */}
        <div className="flex flex-col gap-4">
          <Segment
            size="sm"
            options={VIEW_OPTIONS}
            value={view}
            onChange={(v) => patch({ view: v })}
            className="hidden lg:flex w-[160px]"
            ariaLabel="계산 모드"
          />
          <FlowShell steps={steps} activeIndex={activeIndex} completeFlags={completeFlags} />
        </div>

        {/* 오른쪽 — 조정 칩 + 결과. 모바일에선 flex-col이라 왼쪽 아래에 그대로 이어 보인다(3-1절
            순서: 단계 → 조정 칩 → 결과 카드). PC(lg)에선 오른쪽 패널 맨 위에 조정 칩이 온다(3-14절) */}
        <div
          ref={resultRef}
          // 2026-09-29 지적 3번: 결과 카드 구역에도 flowFocusScope를 줘서 토글·버튼·시트
          // 안 입력 칸의 초점 테두리가 전부 새 틀 강조색(--accent)으로 통일되게 한다
          // (예전엔 이 구역이 범위 밖이라 진한 갈색 그대로였다)
          className="scroll-mt-[112px] lg:scroll-mt-20 flex flex-col gap-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto flowFocusScope"
        >
          {/* 조정 칩도 결과의 일부라 면적을 고르기 전에는 숨긴다(2026-10-29) */}
          <AdjustChips visible={!!result && !areaPending} groups={adjustGroups} />
          {/* 3-13절: 첫 단계(벽지 종류)를 고르기 전에는 결과 카드를 그리지 않는다 — result가
              null이면(= 아직 종류를 안 골랐거나 계산 담당이 계산할 게 없다고 판단) 아무것도 안 그린다 */}
          {/* 2026-10-29: 벽지를 골랐어도 면적을 아직 안 정했으면 금액 카드 대신 한 줄만 보인다 */}
          {areaPending && form.paperType ? (
            <AreaPendingCard text={areaPendingText} />
          ) : (
            <ResultPanel
              result={result}
              range={range}
              loading={loading}
              error={error}
              stale={stale}
              assumed={assumed}
              allDone={allDone}
              form={form}
              onRemoveOldChange={(v) => patch({ removeOld: v })}
              adAfterCard={adsShown ? <CalcAdSlot id="AD-P" processGroup={adProcess} show /> : undefined}
              adAfterActions={adsShown ? <CalcAdSlot id="AD-R" show /> : undefined}
            />
          )}
          {/* 결과 전: 표시 모드(관리자)에서만 자리 위치를 보여 준다 */}
          {!adsShown && (
            <>
              <CalcAdSlot id="AD-P" processGroup={adProcess} show={false} />
              <CalcAdSlot id="AD-R" show={false} />
            </>
          )}
        </div>
      </div>

      {/* 모바일 하단 고정 바 — 진행 표시와 금액만(3-9절) */}
      <BottomBar
        stepNumber={Math.min(activeIndex + 1, steps.length)}
        stepCount={steps.length}
        stepTitle={currentStepTitle}
        // 면적을 고르기 전에는 금액을 안 넘긴다 → 하단 바는 "단계 번호 · 단계 제목"만 보인다(2026-10-29)
        amountText={range && !areaPending ? formatManRange(range.min, range.max) : undefined}
        assumedNote={areaPending ? undefined : (describeWallpaperBottomBarAssumption(assumed) ?? undefined)}
        allDone={allDone}
        calculating={loading || stale}
        failed={bottomFailed}
        onDetail={scrollToResult}
        onRetry={() => window.location.reload()}
      />
    </>
  );
}
