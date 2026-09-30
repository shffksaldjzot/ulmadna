// ──────────────────────────────────────────────
// v1 허브 — 미장(레미탈·셀프레벨링) 계산기 오케스트레이터 (클라이언트)
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9장 적용 — 도배·바닥재가 이미 새 공용 틀
// (flow/*)로 짠 방식을 그대로 옮겨 왔다. 지시서 9-2절 단계 구성:
//   간단 — [용도 → 면적 → 두께], 조정 칩: 공법(레미탈만)
//   정확 — [용도 → 구역(㎡ 목록) → 두께], 조정 칩: 공법 + 세부 조정(접힘)
//
// 용도(방통·셀프레벨링) 칩은 두 모드가 공유하는 1단계다. 미장 1단계는 **아무것도
// 선택되지 않은 채** 시작한다 — 속에 기본값(방통전체)이 있어도 칩에 선택 표시를 하지
// 않는다(touchedMap.usage로 표시 여부를 가린다).
//
// 두 훅을 쓴다(예전과 같음):
//   useMortarQuickCalc  즉시 계산(서버 응답 없이 포수·체적·현장배합을 바로 계산)
//   useMortarCalc       서버 계산(비용·인건 — 400ms 디바운스 + API 호출)
// 둘 다 같은 options({ touched })를 넘겨야 가정값이 어긋나지 않는다(계산 담당 약속).
//
// 옛 부품(StepFlow.tsx·useStepFlow.ts)은 이 작업으로 미장도 새 틀로 옮겨졌으니 더 안
// 쓴다 — 도배·바닥재도 이미 새 틀이라, 이제 쓰는 곳이 0이면 지시서 9-5절대로 지운다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 피드백 — 즉답 분리)
// 화면 재배치(용도 칩으로 모드 흡수): 2026년 09월 15일 (디자인 통일 작업 B)
// 용도 칩 2개로 축소: 2026년 09월 16일
// 단계 흐름 2판(좁혀가기·조정 칩·세부 조정·뒤로 가기·새로 고침 복원): 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Segment from '@/components/v1/Segment';
import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import Collapsible from '@/components/v1/Collapsible';
import { DEFAULT_MORTAR_FORM, decodeMortarForm, type MortarFormState } from '@/lib/v1/mortarQuery';
import type { MortarProductOption } from '@/lib/v1/mortarProductOptions';
import { productCoversThickness, recommendSelfLevelProduct } from '@/lib/v1/mortarProductOptions';
import { useMortarCalc } from '@/lib/v1/useMortarCalc';
import { useMortarQuickCalc } from '@/lib/v1/useMortarQuickCalc';
import { formatManRange } from '@/lib/v1/money';
import {
  sanitizeMortarFormState,
  usesSupplyAreaConvention,
  presetThicknessMm,
  assumedAreaSqm,
} from '@/lib/v1/mortarEngineInput';
import { pyeongToExclusiveSqm, SQM_PER_PYEONG } from '@/lib/v1/areaUnits';
import { USAGE_PRESET, SELF_LEVEL_USAGE_PRESET, THICKNESS_MM_MIN, thicknessMmMax, MONEY_INPUT_WON_MAX } from '@/lib/v1/mortarPresets';
import { useLastValidNumber } from '../_components/useLastValidNumber';
import {
  MORTAR_AREA_SQM_MIN,
  MORTAR_AREA_SQM_MAX,
  isWithinRange,
  rangeCaption,
  mortarThicknessUxMin,
  resolveSimpleAreaSqmRaw,
  mortarZonesValidity,
} from '../_components/inputRanges';
import QuickAnswer from './QuickAnswer';
import PreciseRooms from './PreciseRooms';
import PreciseSection from './PreciseSection';
import ResultPanel from './ResultPanel';
import { describeMortarBottomBarAssumption } from '../_components/assumptionText';
import FlowShell from '../_components/flow/FlowShell';
import AdjustChips from '../_components/flow/AdjustChips';
import BottomBar from '../_components/flow/BottomBar';
import { useFlowSteps } from '../_components/flow/useFlowSteps';
import { useFlowBackNav } from '../_components/flow/useFlowBackNav';
import { loadSessionState, saveSessionState } from '../_components/flow/sessionPersist';
import type { FlowStepDef } from '../_components/flow/types';
import ModePicker, { type CalcViewMode } from '../_components/ModePicker';

interface MortarCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: MortarProductOption[];
}

/**
 * 새로 고침 복원(sessionStorage) 열쇠·판 번호. 2026-09-29: touched 저장 모양을 자리 번호
 * 배열 → 단계 이름(key) 사전으로 바꿔서 1→2로 올렸다(모드 전환 손댐 오판정 수리). 옛
 * 배열 값은 버전이 안 맞아 loadSessionState가 null로 취급하므로 에러 없이 기본 상태로 시작한다.
 */
const SESSION_KEY = 'calc:mortar:v1';
const SESSION_VERSION = 2;

/** 뒤로 가기 스택에서 "이 계산기가 쌓은 몫"을 구분하는 값 */
const CALC_ID = 'mortar';

/** 세션에 저장하는 값의 모양 */
interface MortarSession {
  form: MortarFormState;
  /** 단계 이름(key)별로 실제로 손댔는지 — 2026-09-29부터 이름 기준(useFlowSteps의 touchedMap) */
  touched: Record<string, boolean>;
  userPickedMode: boolean;
  /** 조정 칩(공법)을 사용자가 직접 건드렸는지 */
  methodTouched: boolean;
}

/** 값이 유한 숫자인지 — 세션 검사용 */
function isFiniteNumberValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 세션에 저장된 폼 상태(MortarFormState) 자체의 모양을 검사한다(도배·바닥재와 같은 이유 —
 * 폼 안쪽 칸 하나 때문에 화면이 통째로 멈추는 사고를 막는다). */
function isValidMortarFormState(v: unknown): v is MortarFormState {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;

  if (f.view !== undefined && f.view !== 'simple' && f.view !== 'precise') return false;
  if (f.mode !== undefined && f.mode !== '레미탈' && f.mode !== '셀프레벨링') return false;
  if (f.areaInputMode !== undefined && f.areaInputMode !== 'area' && f.areaInputMode !== 'rect') return false;
  if (f.area !== undefined && !isFiniteNumberValue(f.area)) return false;
  if (f.areaUnit !== undefined && f.areaUnit !== '평' && f.areaUnit !== '㎡') return false;
  if (f.rectWidth !== undefined && !isFiniteNumberValue(f.rectWidth)) return false;
  if (f.rectDepth !== undefined && !isFiniteNumberValue(f.rectDepth)) return false;
  if (
    f.usage !== undefined &&
    f.usage !== '확장부바닥' &&
    f.usage !== '욕실현관구배' &&
    f.usage !== '마루철거보수' &&
    f.usage !== '방통전체'
  ) {
    return false;
  }
  if (f.selfLevelUsage !== undefined && f.selfLevelUsage !== '마루장판전' && f.selfLevelUsage !== '타일전' && f.selfLevelUsage !== '방통위마감') {
    return false;
  }
  if (f.thicknessMm !== undefined && !isFiniteNumberValue(f.thicknessMm)) return false;
  if (f.method !== undefined && f.method !== '장비타설' && f.method !== '손미장') return false;
  if (f.preciseRooms !== undefined) {
    if (!Array.isArray(f.preciseRooms)) return false;
    for (const r of f.preciseRooms) {
      if (!r || typeof r !== 'object') return false;
      const room = r as Record<string, unknown>;
      if (typeof room.name !== 'string' || !isFiniteNumberValue(room.areaSqm)) return false;
    }
  }
  if (f.mixRatio !== undefined && f.mixRatio !== '1:2' && f.mixRatio !== '1:3') return false;
  if (f.lossRate !== undefined && !isFiniteNumberValue(f.lossRate)) return false;
  if (f.wireMesh !== undefined && typeof f.wireMesh !== 'boolean') return false;
  if (f.primer !== undefined && typeof f.primer !== 'boolean') return false;
  if (f.productCode !== undefined && typeof f.productCode !== 'string') return false;
  if (f.product !== undefined) {
    if (!f.product || typeof f.product !== 'object') return false;
    const p = f.product as Record<string, unknown>;
    for (const key of ['kgPerMmSqm', 'bagKg', 'pricePerBag'] as const) {
      if (p[key] !== undefined && !isFiniteNumberValue(p[key])) return false;
    }
  }
  if (f.deliveryFeeWon !== undefined && !isFiniteNumberValue(f.deliveryFeeWon)) return false;
  if (f.forkliftFeeWon !== undefined && !isFiniteNumberValue(f.forkliftFeeWon)) return false;
  if (f.liftingFeeWon !== undefined && !isFiniteNumberValue(f.liftingFeeWon)) return false;
  return true;
}

/** 2026-09-29: touched가 "단계 이름(key) → 손댔는지" 사전인지 검사한다(옛 판은 배열이었다) */
function isValidTouchedMap(v: unknown): v is Record<string, boolean> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((t) => typeof t === 'boolean');
}

function isValidMortarSession(v: unknown): v is MortarSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (!isValidMortarFormState(s.form)) return false;
  if (!isValidTouchedMap(s.touched)) return false;
  if (typeof s.userPickedMode !== 'boolean') return false;
  if (typeof s.methodTouched !== 'boolean') return false;
  return true;
}

/** 화면 모드 세그먼트 옵션 */
const VIEW_OPTIONS = [
  { value: 'simple' as const, label: '간단하게' },
  { value: 'precise' as const, label: '정확하게' },
];

/**
 * 용도 칩 한 줄에 쓰는 값 — 방통(레미탈 대표 용도) + 셀프레벨링(모드 자체를 대표하는 칩).
 * 예전엔 레미탈 용도 4개 + 셀프레벨링 1개, 총 5개였는데 방통·셀프레벨링 2개만 남기고
 * 나머지 3개는 화면에서 뺐다(엔진 타입 MortarUsage 자체는 그대로 둔다).
 */
type TopUsage = '방통전체' | '셀프레벨링';
const TOP_USAGE_ORDER: TopUsage[] = ['방통전체', '셀프레벨링'];

/** 용도 칩에 보여줄 라벨 — "방통 전체"는 칩에서만 "방통"으로 줄인다 */
function topUsageLabel(u: TopUsage): string {
  return u === '셀프레벨링' ? '셀프레벨링' : '방통';
}

export default function MortarCalculator({ products }: MortarCalculatorProps) {
  const searchParams = useSearchParams();
  const hasSharedLink = !!searchParams.get('d');

  // 공유 링크(?d=)로 들어온 값을 그대로 초기 상태로 쓰면 화면 입력칸에 비정상 값(예:
  // 1e22 → "1e+22" 지수 표기)이 그대로 찍힐 수 있다 — sanitizeMortarFormState로 한 번
  // 걸러서 화면에 보여줄 안전한 값으로 만든 뒤에만 상태로 쓴다.
  const restored = useMemo<MortarSession | null>(() => {
    if (hasSharedLink) return null;
    try {
      const loaded = loadSessionState<unknown>(SESSION_KEY, SESSION_VERSION);
      return isValidMortarSession(loaded) ? loaded : null;
    } catch {
      return null;
    }
  }, [hasSharedLink]);

  const initial = useMemo<MortarFormState>(() => {
    const shared = decodeMortarForm(searchParams.get('d'));
    const base = shared ?? restored?.form ?? DEFAULT_MORTAR_FORM;
    return sanitizeMortarFormState(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [form, setForm] = useState<MortarFormState>(initial);
  const resultRef = useRef<HTMLDivElement>(null);

  const [userPickedMode, setUserPickedMode] = useState(hasSharedLink || !!restored?.userPickedMode);
  const modeChosen = hasSharedLink || userPickedMode;

  // 조정 칩(공법)을 사용자가 직접 건드렸는지
  const [methodTouched, setMethodTouched] = useState(hasSharedLink || !!restored?.methodTouched);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<MortarFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  const mode = form.mode ?? '레미탈';
  const view = form.view ?? 'simple';
  const currentTopUsage: TopUsage = mode === '셀프레벨링' ? '셀프레벨링' : '방통전체';

  const step0Valid = true; // 용도는 항상 유효한 값(기본 방통)이 있다 — touched로만 가린다

  // 2026-09-30 지휘관 긴급 전달(치명 2 수리) — resolveSimpleAreaSqm(엔진 파일)은 계산에
  // 쓸 값을 만드는 함수라 결과를 이미 0.5~500㎡로 잘라(clamp) 돌려준다. 그 "잘린" 값으로
  // 범위를 판정하면 늘 범위 안으로 나와 판정이 무의미해진다(152평=502㎡를 넣어도 통과해
  // 버린 실제 사고). 그래서 화면 쪽 판정에는 **자르기 전(raw) 값**(resolveSimpleAreaSqmRaw,
  // inputRanges.ts)을 따로 계산해서 쓴다 — 계산에 실제로 넘기는 값은 여전히 기존
  // resolveSimpleAreaSqm(clamp 있는 쪽)을 그대로 쓴다(엔진 파일은 안 건드림).
  const simpleAreaSqmRaw = resolveSimpleAreaSqmRaw(form, usesSupplyAreaConvention(form), pyeongToExclusiveSqm, SQM_PER_PYEONG);
  const simpleAreaInRange = simpleAreaSqmRaw !== null && isWithinRange(simpleAreaSqmRaw, MORTAR_AREA_SQM_MIN, MORTAR_AREA_SQM_MAX);
  // 2026-09-29 지적 4번: 범위 밖 안내 — 평/㎡·방통/셀프 환산이 갈려서 사용자가 지금 보는
  // 단위로 정확히 맞추기 번거로우니, 환산이 끝난 ㎡ 기준으로 안내한다("500㎡ 이하").
  // 칸이 비어 있으면(simpleAreaSqmRaw===null) 안내 대상이 아니다.
  const areaRangeCaption =
    simpleAreaSqmRaw !== null ? rangeCaption(simpleAreaSqmRaw, MORTAR_AREA_SQM_MIN, MORTAR_AREA_SQM_MAX, '㎡') : undefined;

  // 2026-09-30 긴급 전달(치명 3 수리) — 정확 모드 구역: 예전엔 "유효한 구역이 하나만
  // 있어도 완료"로 봐서, 범위 밖 구역만 조용히 빼고 나머지로 계산해 버렸다(구역1 300㎡ +
  // 구역2 600㎡ → 구역1만으로 계산, 가정 표시도 없이 공유까지 보임 — 그 공유 링크를
  // 열면 다른 금액이 나오는 사고). 이제 **개별 구역이 전부 범위 안이고 합계도 전체
  // 범위(0.5~500㎡) 안일 때만** 완료로 본다 — 하나라도 걸리면 목록 전체를 "아직 못
  // 믿을 값"으로 보고 계산에 아예 안 넘긴다(엔진이 "실측이 비었다" 규칙대로 가정값으로
  // 계산하게 한다).
  const zonesValidity = mortarZonesValidity(form.preciseRooms ?? []);
  const zonesFullyValid = zonesValidity.allInRange && zonesValidity.sumInRange;
  // 계산 담당에 넘길 구역 목록 — 일부라도 문제가 있으면 통째로 비워서 넘긴다(부분 계산 금지)
  const zonesForCalc = zonesFullyValid ? (form.preciseRooms ?? []).filter((r) => typeof r.areaSqm === 'number' && r.areaSqm > 0) : [];
  // 구역 목록 아래에 보여줄 "합계 초과" 안내 — 개별 구역 범위 안내는 PreciseRooms.tsx가
  // 구역마다 따로 보여주므로(지난 라운드에 이미 구현) 여기서는 합계 초과만 다룬다.
  const zoneSumCaption =
    zonesValidity.allInRange && !zonesValidity.sumInRange ? `합계 ${MORTAR_AREA_SQM_MAX}㎡ 이하` : undefined;
  // 값을 채운 구역이 있는데(hasFilled) 뭔가 범위를 벗어났으면 "실측 입력 중"으로 본다
  // (엔진의 'measuring' 판정은 "빈 칸"만 검사해서 이 경우는 안 잡아 준다 — 화면에서
  // 따로 표시한다. 계산은 엔진의 기존 "실측이 비었다" 가정값 규칙을 그대로 탄다).
  const zonesMeasuringInProgress = zonesValidity.hasFilled && !zonesFullyValid;

  const step1Valid = view === 'simple' ? simpleAreaInRange : zonesFullyValid;

  // 두께 — 화면 쪽 최솟값(레미탈 10mm)까지 포함해 mortar/QuickAnswer.tsx 캡션과 같은
  // 범위로 판정한다(캡션이 안 뜨는데 계산은 막히는 엇갈림 방지).
  const thicknessUxMin = mortarThicknessUxMin(mode, THICKNESS_MM_MIN);
  const thicknessMax = thicknessMmMax(mode);
  const thicknessInRange =
    typeof form.thicknessMm === 'number' && isWithinRange(form.thicknessMm, thicknessUxMin, thicknessMax);
  const step2Valid = typeof form.thicknessMm === 'number' && form.thicknessMm > 0 && thicknessInRange;

  // 2026-09-29: 2번째 단계는 모드에 따라 뜻이 다르다(간단="면적" vs 정확="구역 목록") —
  // 자리 번호가 아니라 이름(key)으로 손댐을 구분한다. 용도(usage)·두께(thickness)는 두
  // 모드가 공유하는 뜻이라 key도 그대로 공유한다(정확 모드에서 50mm를 넣고 간단으로
  // 돌아와도 두께는 그대로 이어져야 한다 — 지휘관 확인 항목).
  const areaStepKey = view === 'simple' ? 'area' : 'zones';

  const { activeIndex, allDone, completeFlags, touchedMap, touch, resetTouched } = useFlowSteps({
    steps: [
      { key: 'usage', valid: step0Valid },
      { key: areaStepKey, valid: step1Valid },
      { key: 'thickness', valid: step2Valid },
    ],
    allTouched: hasSharedLink,
    initialTouched: restored?.touched,
  });

  /**
   * 용도 칩을 고르는 유일한 통로 — 모드·용도·두께·제품을 한 번에 정리해야 옛 값이 남아
   * 화면과 계산이 어긋나는 사고를 막는다(도배 setPaperType과 같은 이유).
   *
   * 34평 의미 통일: 방통(공급 평형 규칙)과 셀프레벨링(작업 면적 그 자체) 사이를 넘나들 때는
   * 두 규칙의 "평"이 서로 다른 크기라 이전 면적 값을 그대로 두면 엉뚱한 크기로 계산된다 —
   * 그룹이 바뀔 때만 면적을 비우고 단위를 그 그룹 기본값으로 되돌린다.
   *
   * 매인 관계(지시서 4-2절): 용도를 바꾸면 면적·두께가 새 프리셋으로 바뀌므로, 두 단계
   * (면적·두께) 손댐 표시를 되돌려 다시 확인하게 한다(제품·공법도 값 자체를 초기화한다).
   */
  function selectTopUsage(u: TopUsage) {
    if (u === currentTopUsage) {
      // 값이 안 바뀌었어도 "용도를 손댔다"는 표시는 남겨야 한다(처음 고르는 경우)
      touch('usage');
      return;
    }
    const wasSupply = mode !== '셀프레벨링';
    const willSupply = u !== '셀프레벨링';
    const crossing = wasSupply !== willSupply;
    const areaReset = crossing
      ? { area: undefined, rectWidth: undefined, rectDepth: undefined, areaUnit: (willSupply ? '평' : '㎡') as '평' | '㎡' }
      : {};

    if (u === '셀프레벨링') {
      const defaultUsage = '마루장판전' as const;
      patch({
        mode: '셀프레벨링',
        usage: undefined,
        selfLevelUsage: defaultUsage,
        thicknessMm: SELF_LEVEL_USAGE_PRESET[defaultUsage].defaultMm,
        productCode: undefined,
        product: undefined,
        method: undefined,
        wireMesh: false,
        ...areaReset,
      });
    } else {
      patch({
        mode: '레미탈',
        usage: u,
        selfLevelUsage: undefined,
        thicknessMm: USAGE_PRESET[u].defaultMm,
        productCode: undefined,
        product: undefined,
        method: undefined,
        ...areaReset,
      });
    }
    touch('usage');
    // 매인 관계: 용도가 바뀌면 지금 보이는 모드의 면적/구역 단계와 두께 단계를 다시 확인하게
    // 한다. 다른 모드의 면적 key(예: 지금 간단이면 'zones')는 건드리지 않는다 — 구역 목록
    // 값은 용도(방통/셀프레벨링)와 무관한 순수 실측값이라 되돌릴 이유가 없다.
    resetTouched([areaStepKey, 'thickness']);
  }

  // 뒤로·앞으로 가기 배선 — 모드를 고를 때만 방문 기록에 쌓는다(도배·바닥재와 같은 규칙)
  useFlowBackNav({
    calcId: CALC_ID,
    modeChosen,
    onExitToModePicker: () => setUserPickedMode(false),
    onReenterMode: () => setUserPickedMode(true),
  });

  // 새로 고침 복원
  useEffect(() => {
    if (hasSharedLink) return;
    saveSessionState<MortarSession>(SESSION_KEY, SESSION_VERSION, {
      form,
      touched: touchedMap,
      userPickedMode,
      methodTouched,
    });
  }, [form, touchedMap, userPickedMode, methodTouched, hasSharedLink]);

  // 계산 담당 두 훅에 완전히 같은 options를 넘긴다(계산 담당 약속 — 9-3절).
  // 2026-09-29: area는 'area' key로 직접 꺼낸다(정확 모드의 'zones'와는 독립) — 엔진은
  // view==='simple'일 때만 이 값을 보므로, 정확 모드에선 어차피 안 쓰인다.
  // 지적 2번: 면적·두께가 범위를 벗어났으면 손댔어도 "안 손댄 것"으로 넘겨 엔진이 가정값
  // (34평/33㎡·용도 기본 두께)으로 계산하게 한다 — 서버가 거절할 값을 애초에 안 보낸다.
  const touchedOptions = {
    touched: {
      usage: touchedMap.usage,
      area: touchedMap.area && simpleAreaInRange,
      thickness: touchedMap.thickness && thicknessInRange,
      method: methodTouched,
    },
  };
  // 2026-09-29 지적 2번: 세부 조정의 배송비·지게차 하차비·양중비는 면적·두께와 달리
  // "선택 항목"이라 범위를 벗어나도 가정값으로 되돌리지 않는다 — 그냥 직전에 있었던
  // 정상 값을 그대로 계산에 쓴다(0원으로 떨어지지도, 가정 표시가 뜨지도 않는다). 화면
  // 입력 칸(PreciseSection.tsx)은 이 값과 무관하게 form 값을 그대로 보여준다(사용자가
  // 친 숫자가 안 지워진다) — 여기서 만든 값은 오직 계산 훅에 넘길 때만 쓴다.
  const deliveryFeeForCalc = useLastValidNumber(form.deliveryFeeWon, 0, MONEY_INPUT_WON_MAX);
  const liftingFeeForCalc = useLastValidNumber(form.liftingFeeWon, 0, MONEY_INPUT_WON_MAX);
  const forkliftFeeForCalc = useLastValidNumber(form.forkliftFeeWon, 0, MONEY_INPUT_WON_MAX);

  // 정확 모드에서 계산 담당에 넘길 구역 목록 — 범위 밖 구역은 빼고 넘긴다(위 zonesForCalc).
  // 남은 구역이 없어지면 엔진이 기존 규칙대로 "구역이 비었다"로 보고 가정 면적으로 계산한다.
  const formForCalc = {
    ...form,
    ...(view === 'precise' ? { preciseRooms: zonesForCalc } : {}),
    deliveryFeeWon: deliveryFeeForCalc,
    liftingFeeWon: liftingFeeForCalc,
    forkliftFeeWon: forkliftFeeForCalc,
  };
  // 즉답 — 서버 없이 바로 계산되는 포수·체적·현장배합(항상 최신 폼 상태를 즉시 반영)
  const quick = useMortarQuickCalc(formForCalc, products, touchedOptions);
  // 서버 — 비용·인건(디바운스 + API 호출, 늦게 오거나 실패할 수 있다)
  const { result, range, loading, error, stale, assumed } = useMortarCalc(formForCalc, products, touchedOptions);

  const emptyMessage = '용도를 고르면 바로 나와요';

  /** 폼 상태를 바꾸면서 동시에 "지금 모드의 면적/구역 단계를 손댔다"고 표시하는 도우미 */
  function patchArea(p: Partial<MortarFormState>) {
    patch(p);
    touch(areaStepKey);
  }

  /** 조정 칩 — 공법. 손댔다는 표시를 같이 남긴다 */
  function onMethodChange(v: '손미장' | '장비타설') {
    patch({ method: v });
    setMethodTouched(true);
  }

  // ── 정확 모드 두께 단계 — 셀프레벨링 자동 제품 전환 포함(예전 PreciseSection.tsx 로직 그대로) ──
  const modeProducts = products.filter((p) => p.mode === mode);
  const selectedProduct = form.productCode ? modeProducts.find((p) => p.code === form.productCode) : undefined;

  // QuickAnswer가 넘겨주는 값은 항상 number | undefined다('' 는 QuickAnswer 안에서
  // 이미 undefined로 바꿔서 넘긴다) — 시그니처를 그 모양에 맞춘다.
  function handlePreciseThicknessChange(mm: number | undefined) {
    if (mm === undefined) {
      patch({ thicknessMm: undefined });
      touch('thickness');
      return;
    }
    if (mode === '셀프레벨링' && selectedProduct && !productCoversThickness(selectedProduct, mm)) {
      const rec = recommendSelfLevelProduct(mm, products);
      patch({ thicknessMm: mm, productCode: rec?.code });
    } else {
      patch({ thicknessMm: mm });
    }
    touch('thickness');
  }

  // 가정 문구 — 용도(방통/셀프레벨링)에 따라 면적 가정값의 뜻이 달라 여기서 계산해 넘긴다.
  // 2026-09-30 치명 3: 정확 모드에서 구역 일부가 범위를 벗어나 통째로 못 믿을 값이 된
  // 경우("실측은 있는데 무효")는 "34평 가정"이 아니라 "실측 입력 중"으로 보여준다 —
  // 엔진 자체의 'measuring' 판정은 "빈 칸"만 봐서 이 경우를 못 잡아 주므로 화면에서
  // 문구만 바꿔치기한다(계산은 엔진의 기존 "실측 비었음" 가정값 규칙 그대로 탄다).
  const areaAssumedText = zonesMeasuringInProgress
    ? '실측 입력 중'
    : usesSupplyAreaConvention(form)
      ? '34평 가정'
      : `${Math.round(assumedAreaSqm(form))}㎡ 가정`;
  const thicknessAssumedText = `${presetThicknessMm(form)}mm 가정`;

  // ── 단계 정의 배열 — 용도 칩 줄은 두 모드가 공유한다 ──
  const usageStepContent = (
    // 2026-09-29 지시서 3-6절 다듬기 — 방향키로 옮겨 다닐 수 있게 ChipGroup으로 감싼다.
    // 하나만 고르는 묶음이라 role="radiogroup"(칩도 asRadio로 role="radio"를 낸다)
    <ChipGroup role="radiogroup" ariaLabel="용도" className="flex flex-wrap gap-2">
      {TOP_USAGE_ORDER.map((u) => (
        <Chip
          key={u}
          asRadio
          // 지시서 9-2절: 1단계는 아무것도 선택되지 않은 채 시작한다 — 손대기 전엔 칩에
          // 선택 표시를 하지 않는다(속에 기본값이 있어도)
          selected={touchedMap.usage && currentTopUsage === u}
          onClick={() => selectTopUsage(u)}
        >
          {topUsageLabel(u)}
        </Chip>
      ))}
    </ChipGroup>
  );

  const steps: FlowStepDef[] = [
    {
      key: 'usage',
      title: '용도',
      valid: step0Valid,
      content: usageStepContent,
    },
    {
      key: areaStepKey,
      title: view === 'simple' ? '면적' : '구역',
      valid: step1Valid,
      content:
        view === 'simple' ? (
          <QuickAnswer
            part="area"
            form={form}
            patch={patchArea}
            areaUntouched={!touchedMap.area}
            onAreaEnterComplete={() => touch('area')}
            areaRangeCaption={areaRangeCaption}
          />
        ) : (
          <PreciseRooms
            rooms={form.preciseRooms ?? []}
            onRoomsChange={(v) => patchArea({ preciseRooms: v })}
            sumCaption={zoneSumCaption}
          />
        ),
    },
    {
      key: 'thickness',
      title: '두께',
      valid: step2Valid,
      // 2026-09-27 저녁 지휘관 3차 검수 지적 6번: 정확 모드도 간단 모드와 완전히 같은
      // 모습(칩+숫자칸)을 쓴다. 정확 모드에서만 onThicknessChangeOverride를 넘겨
      // 셀프레벨링 자동 제품 전환 로직(handlePreciseThicknessChange)을 끼워 넣는다.
      // 두께는 두 모드가 공유하는 key라(위 areaStepKey와 다름) 정확 모드에서 50mm를
      // 손대면 간단 모드로 돌아와도 그대로 이어진다(지휘관 확인 항목).
      content: (
        <QuickAnswer
          part="thickness"
          form={form}
          patch={patch}
          thicknessUntouched={!touchedMap.thickness}
          onThicknessTouch={() => touch('thickness')}
          onThicknessChangeOverride={view === 'precise' ? handlePreciseThicknessChange : undefined}
        />
      ),
    },
  ];

  // ── 조정 칩 — 공법(레미탈만). 셀프레벨링은 조정 칩 구역 자체가 없다 ──
  const adjustGroups =
    mode === '레미탈'
      ? [
          {
            key: 'method',
            label: '공법',
            children: (
              <>
                <Chip
                  shape="square"
                  asRadio
                  selected={(form.method ?? (form.usage ? USAGE_PRESET[form.usage].defaultMethod : '손미장')) === '손미장'}
                  onClick={() => onMethodChange('손미장')}
                >
                  손미장
                </Chip>
                <Chip
                  shape="square"
                  asRadio
                  selected={(form.method ?? (form.usage ? USAGE_PRESET[form.usage].defaultMethod : '손미장')) === '장비타설'}
                  onClick={() => onMethodChange('장비타설')}
                >
                  장비 타설
                </Chip>
              </>
            ),
          },
        ]
      : [];

  function scrollToResult() {
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const bottomFailed = false; // quick이 있으면 실패 표시를 쓸 일이 없다(포수는 항상 즉시 나온다)
  const currentStepTitle = steps[Math.min(activeIndex, steps.length - 1)]?.title ?? '';

  // 첫 화면 — 아직 모드를 안 골랐으면 질문 하나만 보여준다
  if (!modeChosen) {
    return (
      <>
        <TopNav title="레미탈 계산기" backHref="/calc" as="p" />
        <div className="px-5 lg:px-8 max-w-[1120px] mx-auto">
          <ModePicker
            onPick={(v: CalcViewMode) => {
              patch({ view: v });
              setUserPickedMode(true);
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav
        title="레미탈 계산기"
        backHref="/calc"
        as="p"
        rightSlot={
          <Segment size="sm" options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} className="w-[136px]" ariaLabel="계산 모드" />
        }
      />

      <div className="px-5 lg:px-8 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
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

        <div
          ref={resultRef}
          // 2026-09-29 지적 3번: 결과 카드 구역에도 flowFocusScope를 줘서 토글·버튼·시트
          // 안 입력 칸의 초점 테두리가 전부 새 틀 강조색(--accent)으로 통일되게 한다
          // (예전엔 이 구역이 범위 밖이라 진한 갈색 그대로였다)
          className="scroll-mt-16 flex flex-col gap-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto flowFocusScope"
        >
          <AdjustChips visible={!!quick} groups={adjustGroups} />
          {/* 정확 모드 "세부 조정" — 조정 칩 아래, 결과 카드 위. 카드로 감싸지 않는다
              (테두리·배경 없음, 지시서 9-2절). 기존 입력 부품(PreciseSection.tsx)을
              그대로 옮겨서 쓴다. */}
          {view === 'precise' && quick && (
            <Collapsible title="세부 조정">
              <div className="pt-2">
                <PreciseSection form={form} patch={patch} products={products} result={result} />
              </div>
            </Collapsible>
          )}
          <ResultPanel
            quick={quick}
            result={result}
            range={range}
            loading={loading}
            error={error}
            stale={stale}
            assumed={assumed}
            allDone={allDone}
            form={form}
            areaAssumedText={areaAssumedText}
            thicknessAssumedText={thicknessAssumedText}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>

      {/* 2026-09-27 저녁 지휘관 3차 검수 지적 2번: 하단 바에 수량까지 넣으니 금액이
          잘렸다("40kg × 164포 · 161만~24…") — 도배·바닥재와 같이 진행 표시 + 금액 +
          (면적 가정일 때만) "34평 가정"만 보여준다. 수량은 결과 카드에서 보여준다. */}
      <BottomBar
        stepNumber={Math.min(activeIndex + 1, steps.length)}
        stepCount={steps.length}
        stepTitle={currentStepTitle}
        amountText={range ? formatManRange(range.min, range.max) : undefined}
        assumedNote={describeMortarBottomBarAssumption(assumed, areaAssumedText) ?? undefined}
        allDone={allDone}
        calculating={loading || stale}
        failed={bottomFailed}
        onDetail={scrollToResult}
        onRetry={() => window.location.reload()}
      />
    </>
  );
}
