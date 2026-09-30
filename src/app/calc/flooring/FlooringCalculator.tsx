// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 오케스트레이터 (클라이언트)
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9장 적용 — 도배 WallpaperCalculator.tsx(1차
// 작업)가 이미 새 공용 틀(flow/*)로 짠 방식을 그대로 옮겨 왔다. 새로 발명하지 않았다.
//   · 좁혀가기: 자재 하나만 골라도 바로 결과가 뜬다. 안 고른 값은 계산 담당
//     (useFlooringCalc)이 가정값(34평·자재 전체 범위·3베이 등)으로 채워 계산하고,
//     "무엇을 가정했는지"를 assumed 목록으로 돌려준다.
//   · 범위(전체·방만·거실주방)·베이는 단계에서 빼서 "조정 칩"(결과 위)으로 옮겼다 —
//     단, 지시서 9-2절: 정확 모드는 조정 칩이 아예 없다(실측 방 목록이라 범위·베이가
//     뜻이 없다).
//   · 제품은 목록 드롭다운 대신 시트(ProductSheet)로 고른다.
//   · 뒤로 가기·새로 고침 복원(flow/useFlowBackNav·flow/sessionPersist)을 새로 붙였다.
//
// 옛 부품(StepFlow.tsx·useStepFlow.ts)은 이 작업으로 미장이 아직 쓰고 있을 수 있어 손대지
// 않는다 — 둘 다 쓰는 곳이 0이 되면 마지막에 지운다(지시서 9-5절).
//
// 작성일: 2026년 09월 10일
// 튜토리얼식 단계 안내: 2026년 09월 16일
// 단계 흐름 2판(좁혀가기·조정 칩·제품 시트·뒤로 가기·새로 고침 복원): 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Segment from '@/components/v1/Segment';
import Chip from '@/components/v1/Chip';
import {
  DEFAULT_FLOORING_FORM,
  decodeFlooringForm,
  type FlooringFormState,
  type FlooringKind,
  type FlooringProductOption,
} from '@/lib/v1/flooringQuery';
import { useFlooringCalc } from '@/lib/v1/useFlooringCalc';
import { MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM } from '@/lib/v1/flooringEngineInput';
import { MIN_SUPPLY_PYEONG, MAX_SUPPLY_PYEONG, isWithinRange, isRoomDimValid } from '../_components/inputRanges';
import { formatManRange } from '@/lib/v1/money';
// GA4 — 계산기 화면 진입 이벤트(마운트 1번만)
import { track } from '@/lib/analytics';
import QuickAnswer from './QuickAnswer';
import PreciseSection from './PreciseSection';
import MaterialPicker from './MaterialPicker';
import ScopeChips from './ScopeChips';
import ResultPanel from './ResultPanel';
import { describeFlooringBottomBarAssumption } from '../_components/assumptionText';
import FlowShell from '../_components/flow/FlowShell';
import AdjustChips from '../_components/flow/AdjustChips';
import BottomBar from '../_components/flow/BottomBar';
import { useFlowSteps } from '../_components/flow/useFlowSteps';
import { useFlowBackNav } from '../_components/flow/useFlowBackNav';
import { useSheetBackNav } from '../_components/flow/useSheetBackNav';
import { loadSessionState, saveSessionState } from '../_components/flow/sessionPersist';
import type { FlowStepDef } from '../_components/flow/types';
import ModePicker, { type CalcViewMode } from '../_components/ModePicker';

interface FlooringCalculatorProps {
  /** page.tsx(서버 컴포넌트)가 제품 마스터에서 골라 내려주는 화면용 제품 목록 */
  products: FlooringProductOption[];
}

/**
 * 새로 고침 복원(sessionStorage) 열쇠·판 번호 — 모양이 바뀌면 SESSION_VERSION을 올려서 옛 값을 버린다.
 * 2026-09-29: touched 저장 모양을 자리 번호 배열 → 단계 이름(key) 사전으로 바꿔서 1→2로 올렸다
 * (모드 전환 손댐 오판정 수리). 옛 배열 값은 버전이 안 맞아 loadSessionState가 null로 취급하므로
 * 에러 없이 기본 상태로 시작한다.
 */
const SESSION_KEY = 'calc:flooring:v1';
const SESSION_VERSION = 2;

/** 뒤로 가기 스택에서 "이 계산기가 쌓은 몫"을 구분하는 값 */
const CALC_ID = 'flooring';

/** 세션에 저장하는 값의 모양 */
interface FlooringSession {
  form: FlooringFormState;
  /** 단계 이름(key)별로 실제로 손댔는지 — 2026-09-29부터 이름 기준(useFlowSteps의 touchedMap) */
  touched: Record<string, boolean>;
  userPickedMode: boolean;
  bayTouched: boolean;
  scopeTouched: boolean;
}

/** 정확 모드 방 하나(FlooringPreciseRoom)의 모양 검사 — w·d 둘 다 숫자여야 한다 */
function isValidFlooringPreciseRoom(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.w === 'number' && typeof r.d === 'number';
}

/**
 * 세션에 저장된 폼 상태(FlooringFormState) 자체의 모양을 검사한다(도배 검사관 지적 3번과
 * 같은 이유 — 폼 안쪽 칸 하나 때문에 화면이 통째로 멈추는 사고를 막는다). 하나라도
 * 어긋나면 세션 전체를 버리고 기본 상태로 시작한다.
 */
function isValidFlooringFormState(v: unknown): v is FlooringFormState {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;

  if (f.view !== undefined && f.view !== 'simple' && f.view !== 'precise') return false;
  if (f.kind !== undefined && f.kind !== '마루' && f.kind !== '장판' && f.kind !== '데코타일') return false;
  if (f.productCode !== undefined && typeof f.productCode !== 'string') return false;
  if (f.product !== undefined) {
    if (!f.product || typeof f.product !== 'object') return false;
    const p = f.product as Record<string, unknown>;
    const nums: (keyof typeof p)[] = ['pricePerBox', 'sqmPerBox', 'widthMm', 'lengthMm', 'pricePerM', 'rollWidthM'];
    for (const key of nums) {
      if (p[key] !== undefined && typeof p[key] !== 'number') return false;
    }
  }
  if (f.pyeong !== undefined && typeof f.pyeong !== 'number') return false;
  if (f.bay !== undefined && f.bay !== 2 && f.bay !== 3 && f.bay !== 4) return false;
  if (f.areaUnit !== undefined && f.areaUnit !== '평' && f.areaUnit !== '㎡') return false;
  if (f.exclusiveSqm !== undefined && typeof f.exclusiveSqm !== 'number') return false;
  if (f.scope !== undefined && f.scope !== '전체' && f.scope !== '방만' && f.scope !== '거실주방') return false;
  if (f.unit !== undefined && f.unit !== 'mm' && f.unit !== 'm') return false;
  if (f.preciseRooms !== undefined && (!Array.isArray(f.preciseRooms) || !f.preciseRooms.every(isValidFlooringPreciseRoom))) {
    return false;
  }
  if (f.removeOld !== undefined && typeof f.removeOld !== 'boolean') return false;
  if (f.baseboard !== undefined && typeof f.baseboard !== 'boolean') return false;
  return true;
}

/** 2026-09-29: touched가 "단계 이름(key) → 손댔는지" 사전인지 검사한다(옛 판은 배열이었다) */
function isValidTouchedMap(v: unknown): v is Record<string, boolean> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((t) => typeof t === 'boolean');
}

function isValidFlooringSession(v: unknown): v is FlooringSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (!isValidFlooringFormState(s.form)) return false;
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

export default function FlooringCalculator({ products }: FlooringCalculatorProps) {
  const searchParams = useSearchParams();
  const hasSharedLink = !!searchParams.get('d');

  // 공유 링크(?d=)가 있으면 그 값이 최우선. 없으면 세션에 남은 값을 복원하고, 그마저
  // 없으면 기본값(간단 모드, 자재 미선택)으로 시작한다. 복원 도중 무엇이 터지더라도
  // (try/catch) 계산기 화면 자체는 반드시 뜨게 한다.
  const restored = useMemo<FlooringSession | null>(() => {
    if (hasSharedLink) return null;
    try {
      const loaded = loadSessionState<unknown>(SESSION_KEY, SESSION_VERSION);
      return isValidFlooringSession(loaded) ? loaded : null;
    } catch {
      return null;
    }
  }, [hasSharedLink]);

  const initial = useMemo<FlooringFormState>(() => {
    const shared = decodeFlooringForm(searchParams.get('d'));
    return shared ?? restored?.form ?? DEFAULT_FLOORING_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 폼 상태는 이 컴포넌트 한 곳에서만 들고 있는다. 자식은 값과 onChange만 받는다.
  const [form, setForm] = useState<FlooringFormState>(initial);
  // 모바일 하단 고정 요약 바의 "자세히"가 스크롤해서 이동할 대상
  const resultRef = useRef<HTMLDivElement>(null);

  // 모드(간단/정확)를 이미 골랐는지 — 공유 링크나 세션 복원 값이 있으면 처음부터 true
  const [userPickedMode, setUserPickedMode] = useState(hasSharedLink || !!restored?.userPickedMode);
  const modeChosen = hasSharedLink || userPickedMode;

  // 조정 칩(베이·범위)을 사용자가 직접 건드렸는지 — 계산 담당의 touched.bay·touched.scope로 넘긴다.
  const [bayTouched, setBayTouched] = useState(hasSharedLink || !!restored?.bayTouched);
  const [scopeTouched, setScopeTouched] = useState(hasSharedLink || !!restored?.scopeTouched);

  // 제품 목록 시트 열림 여부 — 지휘관 지시(2026-09-27): 이 상태는 시트를 그리는 부품
  // (MaterialPicker)이 아니라 여기(맨 위 계산기)가 들고 있다. 모드 카드 화면으로 돌아가면
  // MaterialPicker는 화면에서 사라지지만 이 컴포넌트(FlooringCalculator) 자체는 계속
  // 마운트된 채라, 뒤로 가기 스택이 쥔 "시트 다시 열기" 콜백이 죽은 컴포넌트 인스턴스를
  // 가리키는 사고(도배에서 실제로 난 결함)가 안 생긴다.
  const [sheetOpen, setSheetOpen] = useState(false);


  // GA4 — 바닥재 계산기 화면에 들어왔다는 이벤트를 딱 1번만 보낸다(마운트 시점)
  useEffect(() => {
    track('calc_view', { process: 'flooring' });
  }, []);

  /** 폼 상태 부분 갱신 도우미 — 자식 컴포넌트는 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<FlooringFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  /**
   * 바닥재 종류가 바뀌는 유일한 통로. 종류만 바꾸고 이전에 고른 제품(productCode·product)을
   * 안 지우면 화면엔 새 종류가 선택된 것처럼 보여도 계산은 옛 제품 규격·가격으로 되는
   * 치명 버그였다(도배 setPaperType과 같은 이유). 종류가 "실제로" 바뀔 때만 제품(1단계)을
   * 지우고 그 단계 손댐 표시도 되돌린다(resetTouched).
   */
  function setKind(v: FlooringKind | undefined) {
    if (v === form.kind) return; // 값이 안 바뀌었으면 할 일이 없다
    patch({ kind: v, productCode: undefined, product: undefined });
    touch('kind');
    resetTouched(['product']);
  }

  const view = form.view ?? 'simple';

  // 2026-09-29: 3번째 단계는 모드에 따라 뜻이 다르다(간단="면적" vs 정확="실측") — 자리
  // 번호가 아니라 이름(key)으로 손댐을 구분한다. 자재(kind)·제품(product)은 두 모드가
  // 공유하는 뜻이라 key도 그대로 공유한다.
  const areaStepKey = view === 'simple' ? 'area' : 'measure';

  // ── 1단계(자재)·2단계(제품)·3단계(면적/실측) 값 유효 여부(dataComplete) ──
  // 2단계(제품)는 무엇을 골랐든 항상 유효하다("아직 안 정했어요"도 정당한 선택) — 실제
  // "완료" 여부는 touched로만 갈린다(도배와 같은 규칙).
  const step0Valid = !!form.kind;
  const step1Valid = true;
  // 2026-09-29 지적 2번: 서버 허용 범위(평 5~200 · ㎡ 20~300)를 벗어난 값은 완료로 치지
  // 않는다 — 그래야 미완료로 남아 34평 가정으로 계산되고 공유가 숨는다.
  const simpleAreaInRange =
    form.areaUnit === '㎡'
      ? isWithinRange(form.exclusiveSqm, MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM)
      : isWithinRange(form.pyeong, MIN_SUPPLY_PYEONG, MAX_SUPPLY_PYEONG);
  const step2Valid =
    view === 'simple'
      ? (form.areaUnit === '㎡' ? !!form.exclusiveSqm : !!form.pyeong) && simpleAreaInRange
      : (form.preciseRooms ?? []).some((r) => r.w > 0 && r.d > 0) &&
        (form.preciseRooms ?? []).every((r) => isRoomDimValid(r.w, r.d));

  // 정확 모드에서 계산 담당(useFlooringCalc)에 넘길 방 목록 — 범위 밖 방은 빼고 넘긴다
  // ("그 값으로는 계산하지 않는다", 지적 2번). 엔진 파일은 안 건드렸다.
  const roomsForCalc = (form.preciseRooms ?? []).filter((r) => isRoomDimValid(r.w, r.d));
  const formForCalc = view === 'precise' ? { ...form, preciseRooms: roomsForCalc } : form;

  const { activeIndex, allDone, completeFlags, touchedMap, touch, resetTouched } = useFlowSteps({
    steps: [
      { key: 'kind', valid: step0Valid },
      { key: 'product', valid: step1Valid },
      { key: areaStepKey, valid: step2Valid },
    ],
    allTouched: hasSharedLink,
    initialTouched: restored?.touched,
  });

  // 뒤로·앞으로 가기 배선 — 모드를 고를 때만 방문 기록에 쌓는다(도배와 같은 규칙).
  // 모드 카드로 돌아갈 때는 열려 있던 제품 시트도 같이 닫는다(지휘관 지시).
  useFlowBackNav({
    calcId: CALC_ID,
    modeChosen,
    onExitToModePicker: () => {
      setUserPickedMode(false);
      setSheetOpen(false);
    },
    onReenterMode: () => setUserPickedMode(true),
  });

  // 제품 시트의 뒤로·앞으로 가기 감시 — 반드시 이 최상위(절대 언마운트 안 되는) 계산기가
  // 직접 부른다(useSheetBackNav.ts 주석 참고, 도배 7차 검사 치명 수리와 같은 이유 —
  // MaterialPicker처럼 모드 카드로 돌아가면 사라지는 부품 안에서 부르면 안 된다).
  useSheetBackNav({
    calcId: CALC_ID,
    open: sheetOpen,
    onClose: () => setSheetOpen(false),
    onReopen: () => setSheetOpen(true),
  });

  // 새로 고침 복원 — 공유 링크로 들어온 게 아니면 값이 바뀔 때마다 세션에 저장해 둔다.
  useEffect(() => {
    if (hasSharedLink) return;
    saveSessionState<FlooringSession>(SESSION_KEY, SESSION_VERSION, {
      form,
      touched: touchedMap,
      userPickedMode,
      bayTouched,
      scopeTouched,
    });
  }, [form, touchedMap, userPickedMode, bayTouched, scopeTouched, hasSharedLink]);

  // ── 계산 담당 훅: touched를 넘겨야 가정 목록(assumed)이 화면 손댐 여부를 정확히 반영한다 ──
  // 2026-09-29: 'area' key로 직접 꺼낸다(자리 번호가 아니라 "간단 모드의 면적 단계" 그 자체) —
  // 정확 모드에서 'measure'를 손대도 이 값은 안 바뀐다(엔진도 view==='simple'일 때만 본다).
  // 지적 2번: 범위를 벗어났으면 손댔어도 "안 손댄 것"으로 넘긴다 — 엔진이 34평 가정으로
  // 계산하게 해서, 서버가 거절할 값(예: 999평)을 애초에 안 보낸다.
  const { result, range, loading, error, stale, assumed: assumedFromEngine } = useFlooringCalc(formForCalc, products, {
    touched: { area: touchedMap.area && simpleAreaInRange, bay: bayTouched, scope: scopeTouched },
  });
  // 2026-09-30 지휘관 긴급 전달(중요 2) — 정확 모드에서 방 일부가 범위 밖이라 빠지면
  // (roomsForCalc가 원래 방 수보다 적음), 엔진은 남은 방만 보고 "실측이 다 채워졌다"고
  // 판단해 'measuring' 가정을 안 넣어 준다. 화면이 그 사정을 알고 있으니 직접 더해서
  // 내려보낸다(도배와 같은 규칙 — describeFlooringAreaAssumptionLine·canShare가 이미
  // 'measuring'을 처리하고 있어서 이 값만 더하면 나머지는 기존 로직 그대로 맞는다).
  const roomsFilteredDueToRange = view === 'precise' && (form.preciseRooms ?? []).length > roomsForCalc.length;
  const assumed = roomsFilteredDueToRange && !assumedFromEngine.includes('measuring')
    ? [...assumedFromEngine, 'measuring' as const]
    : assumedFromEngine;

  /** 폼 상태를 바꾸면서 동시에 "지금 모드의 면적/실측 단계를 손댔다"고 표시하는 도우미(3단계 전용) */
  function patchAreaStep(p: Partial<FlooringFormState>) {
    patch(p);
    touch(areaStepKey);
  }

  /** 조정 칩 — 베이. 손댔다는 표시를 같이 남긴다(안 건드리면 계산 담당이 가정으로 본다) */
  function onBayChange(v: 2 | 3 | 4) {
    patch({ bay: v });
    setBayTouched(true);
  }
  /** 조정 칩 — 범위(전체·방만·거실주방) */
  function onScopeChange(v: FlooringFormState['scope']) {
    patch({ scope: v });
    setScopeTouched(true);
  }

  // ── 단계 정의 배열 하나로 — FlowShell이 이 배열만 보고 화면을 그린다 ──
  const steps: FlowStepDef[] = [
    {
      key: 'kind',
      title: '자재',
      valid: step0Valid,
      content: (
        <MaterialPicker
          part="kind"
          kind={form.kind}
          onKindChange={setKind}
          productCode={form.productCode}
          onProductCodeChange={(v) => patch({ productCode: v })}
          products={products}
          product={form.product}
          onProductChange={(v) => patch({ product: v })}
          sheetOpen={sheetOpen}
          onSheetOpenChange={setSheetOpen}
        />
      ),
    },
    {
      key: 'product',
      title: '제품',
      valid: step1Valid,
      content: (
        <MaterialPicker
          part="product"
          kind={form.kind}
          onKindChange={setKind}
          productCode={form.productCode}
          onProductCodeChange={(v) => {
            patch({ productCode: v });
            touch('product');
          }}
          products={products}
          product={form.product}
          onProductChange={(v) => {
            patch({ product: v });
            // 직접 입력 칸이 다 차서 진짜 값이 생겼을 때만 손댔다고 본다(입력 도중엔 건너뛴다)
            if (v !== undefined) touch('product');
          }}
          touched={touchedMap.product}
          sheetOpen={sheetOpen}
          onSheetOpenChange={setSheetOpen}
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
            // 단위(평/㎡)만 바꾸는 건 "면적을 골랐다"는 뜻이 아니다 — patch만 써서 단계
            // 완료 처리를 안 하게 한다(도배와 같은 규칙)
            onAreaUnitChange={(v) => patch({ areaUnit: v })}
            exclusiveSqm={form.exclusiveSqm ?? ''}
            onExclusiveSqmChange={(v) => patchAreaStep({ exclusiveSqm: v === '' ? undefined : v })}
            onEnterComplete={() => touch(areaStepKey)}
            untouched={!touchedMap[areaStepKey]}
          />
        ) : (
          <PreciseSection
            unit={form.unit ?? 'm'}
            onUnitChange={(v) => patchAreaStep({ unit: v })}
            rooms={form.preciseRooms ?? []}
            onRoomsChange={(v) => patchAreaStep({ preciseRooms: v })}
          />
        ),
    },
  ];

  // ── 조정 칩 — 결과가 있을 때만 보인다. 간단 모드에만 있다(정확 모드는 없음, 지시서
  //     9-2절 — 실측 방 목록이라 범위·베이가 뜻이 없다) ──
  const adjustGroups =
    view === 'simple'
      ? [
          {
            key: 'scope',
            label: '범위',
            children: <ScopeChips scope={form.scope ?? '전체'} onScopeChange={onScopeChange} />,
          },
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
      : [];

  /** 하단 고정 바 "자세히" — 결과 카드로 부드럽게 스크롤 */
  function scrollToResult() {
    track('calc_cta_click', { process: 'flooring', target: 'result_view' });
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 계산이 완전히 실패해(결과가 아예 없음) 보여줄 값이 없을 때만 하단 바가 "실패" 모습이 된다.
  const bottomFailed = !!error && !result;
  const currentStepTitle = steps[Math.min(activeIndex, steps.length - 1)]?.title ?? '';

  // 첫 화면 — 아직 모드를 안 골랐으면 질문 하나만 보여준다(결과 패널·하단 바 전부 숨김)
  if (!modeChosen) {
    return (
      <>
        <TopNav title="바닥재 계산기" backHref="/calc" as="p" />
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
      {/* 제목 줄(모바일 전용) 오른쪽에 작은 [간단|정확] 전환. as="p": 검색엔진용 진짜 h1은
          page.tsx(서버)에 따로 있다 */}
      <TopNav
        title="바닥재 계산기"
        backHref="/calc"
        as="p"
        rightSlot={
          <Segment size="sm" options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} className="w-[136px]" ariaLabel="계산 모드" />
        }
      />

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

        {/* 오른쪽 — 조정 칩 + 결과 */}
        <div
          ref={resultRef}
          // 2026-09-29 지적 3번: 결과 카드 구역에도 flowFocusScope를 줘서 토글·버튼·시트
          // 안 입력 칸의 초점 테두리가 전부 새 틀 강조색(--accent)으로 통일되게 한다
          // (예전엔 이 구역이 범위 밖이라 진한 갈색 그대로였다)
          className="scroll-mt-16 flex flex-col gap-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto flowFocusScope"
        >
          <AdjustChips visible={!!result} groups={adjustGroups} />
          {/* 첫 단계(자재)를 고르기 전에는 결과 카드를 그리지 않는다 */}
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
            onBaseboardChange={(v) => patch({ baseboard: v })}
          />
        </div>
      </div>

      {/* 모바일 하단 고정 바 — 진행 표시와 금액만 */}
      <BottomBar
        stepNumber={Math.min(activeIndex + 1, steps.length)}
        stepCount={steps.length}
        stepTitle={currentStepTitle}
        amountText={range ? formatManRange(range.min, range.max) : undefined}
        assumedNote={describeFlooringBottomBarAssumption(assumed) ?? undefined}
        allDone={allDone}
        calculating={loading || stale}
        failed={bottomFailed}
        onDetail={scrollToResult}
        onRetry={() => window.location.reload()}
      />
    </>
  );
}
