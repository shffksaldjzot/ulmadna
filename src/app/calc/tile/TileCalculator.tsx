// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 오케스트레이터(클라이언트)
//
// 2026-10-08 개편(형아 "너무 허접" → 토리 설계). 공용 틀(FlowShell·AdjustChips·BottomBar)은 그대로 쓰고
// 단계·결과만 새로 짰다 — 토스식 "한 화면 한 질문", 첫 칩만 골라도 즉답, 그 뒤로 좁혀 간다.
//   간단 — [공간 → 타일 종류 → 규격] 3단 (붙임 공법은 자동 추천)
//   정확 — [공간 → 치수 → 타일 종류 → 크기 → 공법(자동 추천·바꿀 수 있음)] 5단
//          공간만 골라도 공간 기본 치수로 즉답하고 "치수 미입력 — 기본 치수 가정"을 붙인다
//   시공 조건(철거·방수·바닥 난방·줄눈 색/에폭시·코너비드·실리콘·패턴·맡김/셀프)은 총액 카드 바로 아래 조정 칩
//   — 기본값이 이미 좋은 값이라 "좁히기" 자리에 둔다(도배·바닥재와 같은 규칙)
//   등급(보급·중급·고급)은 결과 카드 맨 위 3단 칸을 눌러 바꾼다
//
// 2026-10-28 정리(형아 승인): "일반인이 모르는 걸 묻는다" 문제 해결 —
//   간단 — [공간 → 범위(전체·바닥만·벽만, 공간에 맞는 것만) → 등급(가성비·중급·고급)] 3단, 고르면 바로 결과.
//          타일 종류·크기는 등급별 기본값(tilePresets.gradeTileDefault)으로 정한다.
//   정확 — [공간 → 치수 → 타일(종류+크기)] 3단. 전문 칩(공법·시공·기존·패턴·줄눈·방수 등)은 맨 뒤 "세부 조정"에 접는다(기본 접힘).
//
// 모바일에선 입력하는 동안 금액 범위를 화면 위(제목줄 아래)에 고정해 보여 준다.
// 매인 관계: 공간을 바꾸면 그 면에 못 쓰는 종류·규격·공법은 값과 손댐 표시를 함께 되돌린다.
//
// 추적(GA4, 도배 계산기와 같은 이름): calc_view(들어옴) · calc_result_view(결과) · calc_cta_click(자세히·공유·등급·글)
//   · calc_detail_open(접힘 펼침) + calc_step_leave(떠날 때 어느 단계였는지 1번)
//
// 작성일: 2026년 10월 03일
// 개편: 2026년 10월 08일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Segment from '@/components/v1/Segment';
import Chip from '@/components/v1/Chip';
import Collapsible from '@/components/v1/Collapsible';
import ChipGroup from '@/components/v1/ChipGroup';
import { DEFAULT_TILE_FORM, decodeTileForm, type TileFormState } from '@/lib/v1/tileQuery';
import { sanitizeTileForm, dimsComplete, kindAllowed, sizeAllowed, surfaceOf, simpleRangeOf } from '@/lib/v1/tileEngineInput';
import { useTileCalc } from '@/lib/v1/useTileCalc';
import {
  TILE_SCOPES,
  TILE_RANGE_LABEL,
  SIMPLE_GRADE_LABEL,
  rangeOptionsFor,
  gradeAreaOf,
  gradeTileDefault,
  TILE_SPACES,
  TILE_PATTERNS,
  TILE_PYEONG_CHIPS,
  TILE_SETTINGS,
  TILE_GROUT_TYPES,
  GROUT_MM_CHIPS,
  bathFloorCodeFor,
  defaultKindFor,
  findTileSize,
  isBathScope,
  kindCaption,
  kindLabel,
  kindOptionsFor,
  methodOptionsFor,
  recommendSetting,
  scopeSurface,
  sizeCaption,
  sizeOptionsForKind,
  spaceSurface,
  type TileKind,
  type TileScope,
  type TileSetting,
  type TileSpace,
  type TileGrade,
} from '@/lib/v1/tilePresets';
import { formatManRange, formatNum } from '@/lib/v1/money';
import { track } from '@/lib/analytics';
import FlowShell from '../_components/flow/FlowShell';
import AdjustChips from '../_components/flow/AdjustChips';
import BottomBar from '../_components/flow/BottomBar';
import { useFlowSteps } from '../_components/flow/useFlowSteps';
import { useFlowBackNav } from '../_components/flow/useFlowBackNav';
import { loadSessionState, saveSessionState } from '../_components/flow/sessionPersist';
import type { AdjustChipGroup, FlowStepDef } from '../_components/flow/types';
import ModePicker, { type CalcViewMode } from '../_components/ModePicker';
import TileDims from './TileDims';
import ResultPanel from './ResultPanel';
import AreaPendingCard from '../_components/AreaPendingCard';
// 광고 자리(2026-10-29): 결과가 보일 때만 — 표시 모드(관리자)는 결과 전에도
import CalcAdSlot from '@/components/ads/CalcAdSlot';
import { CALC_AD_PROCESS } from '@/lib/ads/pricing';

/** 새로 고침 복원 열쇠·판 번호(2026-10-28 간단 단계가 바뀌어 3으로 올림 — 옛 저장값은 버린다) */
const SESSION_KEY = 'calc:tile:v1';
const SESSION_VERSION = 3;
/** 뒤로 가기 스택에서 이 계산기 몫을 구분하는 값 */
const CALC_ID = 'tile';

/** 세션에 저장하는 값 */
interface TileSession {
  form: TileFormState;
  touched: Record<string, boolean>;
  userPickedMode: boolean;
}

/** 화면 모드 세그먼트 */
const VIEW_OPTIONS = [
  { value: 'simple' as const, label: '간단하게' },
  { value: 'precise' as const, label: '정확하게' },
];

/** 모드 카드 캡션 */
const MODE_OPTIONS = [
  { value: 'simple' as const, title: '간단하게', caption: '공간만 고르면 바로' },
  { value: 'precise' as const, title: '정확하게', caption: '치수·타일 종류·공법까지' },
];

/** 세션 값 모양 검사 — 틀리면 버리고 처음 상태로 */
function readSession(): TileSession | null {
  try {
    const s = loadSessionState<unknown>(SESSION_KEY, SESSION_VERSION);
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    if (!o.touched || typeof o.touched !== 'object' || Array.isArray(o.touched)) return null;
    if (!Object.values(o.touched as Record<string, unknown>).every((v) => typeof v === 'boolean')) return null;
    return { form: sanitizeTileForm(o.form), touched: o.touched as Record<string, boolean>, userPickedMode: o.userPickedMode === true };
  } catch {
    return null;
  }
}

export default function TileCalculator() {
  const searchParams = useSearchParams();
  const hasSharedLink = !!searchParams.get('d');

  // 공유 링크 > 세션 복원 > 처음 상태 순서로 시작값을 고른다(밖에서 온 값은 모양 검사 후)
  const restored = useMemo(() => (hasSharedLink ? null : readSession()), [hasSharedLink]);
  const initial = useMemo<TileFormState>(() => {
    const shared = decodeTileForm(searchParams.get('d'));
    if (shared) return sanitizeTileForm(shared);
    return restored?.form ?? DEFAULT_TILE_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [form, setForm] = useState<TileFormState>(initial);
  const [userPickedMode, setUserPickedMode] = useState(hasSharedLink || !!restored?.userPickedMode);
  const modeChosen = hasSharedLink || userPickedMode;
  const resultRef = useRef<HTMLDivElement>(null);

  /** 폼 부분 갱신 — 자식은 항상 이 함수로만 상태를 바꾼다 */
  function patch(p: Partial<TileFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  const view = form.view ?? 'simple';
  const surface = surfaceOf(form);
  // 종류·규격 칩을 그릴 기준 면 — 공간을 아직 안 골랐으면 욕실(벽+바닥) 기준으로 보여 준다
  const surfaceForChips = surface ?? 'both';
  const place: TileScope | TileSpace | undefined = view === 'simple' ? form.scope : form.space;
  const recommendedKind: TileKind = defaultKindFor(surfaceForChips, place);
  const effectiveKind: TileKind = kindAllowed(form) ? (form.tileKind as TileKind) : recommendedKind;
  // 공법 추천은 "대표 면"(욕실 간단은 벽) 기준
  const mainSurface: 'wall' | 'floor' = surfaceForChips === 'floor' ? 'floor' : 'wall';
  const rec = recommendSetting(mainSurface, effectiveKind);

  // ── 단계 완료 판정(값 검증만 — 손댐은 useFlowSteps가 따로 본다) ──
  const rangeOpts = rangeOptionsFor(form.scope);
  const tileValid = kindAllowed(form) && sizeAllowed(form);
  const stepDefs =
    view === 'simple'
      ? [
          { key: 'space', valid: !!form.scope },
          { key: 'range', valid: !!form.scope && !!form.range && rangeOpts.includes(form.range) },
          { key: 'grade', valid: !!form.grade },
        ]
      : [
          { key: 'pspace', valid: !!form.space },
          { key: 'dims', valid: dimsComplete(form) },
          { key: 'tile', valid: tileValid },
        ];

  const { activeIndex, allDone, completeFlags, touchedMap, touch, resetTouched } = useFlowSteps({
    steps: stepDefs,
    allTouched: hasSharedLink,
    initialTouched: restored?.touched,
  });

  // 뒤로·앞으로 가기 — 모드를 고를 때만 방문 기록에 쌓는다(다른 계산기와 같은 규칙)
  useFlowBackNav({
    calcId: CALC_ID,
    modeChosen,
    onExitToModePicker: () => setUserPickedMode(false),
    onReenterMode: () => setUserPickedMode(true),
  });

  // 새로 고침 복원 저장
  useEffect(() => {
    if (hasSharedLink) return;
    saveSessionState<TileSession>(SESSION_KEY, SESSION_VERSION, { form, touched: touchedMap, userPickedMode });
  }, [form, touchedMap, userPickedMode, hasSharedLink]);

  const { result, loading, error, stale, dimsAssumed } = useTileCalc(form);

  // 지금 화면에 올라와 있는 결과가 "기본 치수로 계산한 결과"였는지(2026-10-29 — 면적 전 금액 숨김용).
  // 결과가 최신(stale 아님)일 때만 그 순간의 dimsAssumed로 갱신한다.
  const [shownDimsAssumed, setShownDimsAssumed] = useState(false);
  useEffect(() => {
    if (result && !stale) setShownDimsAssumed(dimsAssumed);
  }, [result, stale, dimsAssumed]);

  // ── 추적 ──
  // GA4 — 타일 계산기 화면에 들어왔다는 이벤트를 1번(마운트 시점)
  useEffect(() => {
    track('calc_view', { process: 'tile' });
  }, []);

  // 떠날 때(탭 닫기·다른 페이지) 어느 단계에 있었는지 1번 — 어디서 많이 그만두는지 보려고
  const steps = 3;
  const leaveRef = useRef({ mode: 'picker', step: '', stepNo: 0, done: false, hasResult: false });
  const leaveStep = stepDefs[Math.min(activeIndex, stepDefs.length - 1)]?.key ?? '';
  const leaveMode = !modeChosen ? 'picker' : view === 'precise' ? 'precise' : 'quick';
  const hasResult = !!result;
  // 최신 단계를 기억만 해 둔다(그릴 때가 아니라 그린 뒤에 적는다)
  useEffect(() => {
    leaveRef.current = { mode: leaveMode, step: leaveStep, stepNo: Math.min(activeIndex + 1, steps), done: allDone, hasResult };
  }, [leaveMode, leaveStep, activeIndex, steps, allDone, hasResult]);
  useEffect(() => {
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      const s = leaveRef.current;
      track('calc_step_leave', { process: 'tile', mode: s.mode, step: s.step, step_no: s.stepNo, done: s.done, has_result: s.hasResult });
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

  // ── 손잡이 ──
  /** 간단 공간 고르기 — 범위는 그 공간에 맞게 되돌린다(선택지가 하나뿐이면 자동으로 고른다), 공법은 공간 기본값으로 */
  function selectScope(s: TileScope) {
    if (s !== form.scope) {
      const opts = rangeOptionsFor(s);
      const next: Partial<TileFormState> = { scope: s, method: undefined };
      if (opts.length === 1) {
        next.range = opts[0];
        touch('range');
      } else {
        next.range = undefined;
        resetTouched(['range']);
      }
      patch(next);
    }
    touch('space');
  }
  function selectRange(r: 'all' | 'floor' | 'wall') {
    patch({ range: r, method: undefined });
    touch('range');
  }
  function selectGrade(g: TileGrade) {
    patch({ grade: g });
    touch('grade');
  }
  /** 정확 공간 고르기 — 면이 바뀌면 종류(못 쓰면)·공법을 되돌린다 */
  function selectSpace(s: TileSpace) {
    if (s !== form.space) {
      const next: Partial<TileFormState> = { space: s, method: undefined };
      const newSurface = spaceSurface(s);
      const oldSurface = form.space ? spaceSurface(form.space) : null;
      if (form.tileKind && !kindOptionsFor(newSurface).includes(form.tileKind)) {
        next.tileKind = undefined;
        next.sizeCode = undefined;
        resetTouched(['tile']);
      }
      if (oldSurface !== newSurface && form.setting) next.setting = undefined;
      patch(next);
    }
    touch('pspace');
  }
  /** 종류 고르기 — 그 종류에 없는 규격이면 규격을 되돌린다 */
  function selectKind(k: TileKind) {
    const next: Partial<TileFormState> = { tileKind: k };
    if (form.sizeCode && !sizeOptionsForKind(k).includes(form.sizeCode)) {
      next.sizeCode = undefined;
    }
    patch(next);
    touch('tile');
  }
  function selectSize(code: string) {
    patch({ sizeCode: code });
    touch('tile');
  }
  function selectSetting(s: TileSetting) {
    patch({ setting: s });
  }
  function changeGrade(g: TileGrade) {
    patch({ grade: g });
  }

  // ── 단계 내용 ──
  /** 타일 종류 칩 + 캡션 1줄 */
  const kindStep = (
    <div className="flex flex-col gap-2">
      <ChipGroup role="radiogroup" ariaLabel="타일 종류" className="flex flex-wrap gap-2">
        {kindOptionsFor(surfaceForChips).map((k) => (
          <Chip key={k} asRadio selected={form.tileKind === k} onClick={() => selectKind(k)}>
            {kindLabel(k)}
          </Chip>
        ))}
      </ChipGroup>
      <p className="t-sub text-ink-2">{kindAllowed(form) ? kindCaption(effectiveKind) : `추천 ${kindLabel(recommendedKind)} · ${kindCaption(recommendedKind)}`}</p>
    </div>
  );

  /** 규격 칩 + 캡션 1줄(욕실 간단은 바닥 규격도) */
  const sizeCaptionText = sizeAllowed(form) && form.sizeCode ? sizeCaption(form.sizeCode) : null;
  const sizeStep = (
    <div className="flex flex-col gap-2">
      <ChipGroup role="radiogroup" ariaLabel="타일 크기" className="flex flex-wrap gap-2">
        {sizeOptionsForKind(effectiveKind).map((code) => (
          <Chip key={code} asRadio selected={form.sizeCode === code} onClick={() => selectSize(code)}>
            {findTileSize(code)?.label}
          </Chip>
        ))}
      </ChipGroup>
      {sizeCaptionText && <p className="t-sub text-ink-2">{sizeCaptionText}</p>}
    </div>
  );

  // 등급 기본 타일 한 줄 설명(예: "도기질 300×600") — 고른 등급이 어떤 타일인지만 보여 준다
  const gradeArea = form.scope ? gradeAreaOf(form.scope, simpleRangeOf(form)) : null;
  const gradeCaption = (g: TileGrade) => {
    if (!gradeArea) return '';
    const t = gradeTileDefault(g, gradeArea);
    return `${kindLabel(t.kind)} ${findTileSize(t.size)?.label ?? ''}`;
  };

  const simpleSteps: FlowStepDef[] = [
    {
      key: 'space',
      title: '공간',
      valid: !!form.scope,
      content: (
        <ChipGroup role="radiogroup" ariaLabel="공간" className="flex flex-wrap gap-2">
          {TILE_SCOPES.map((s) => (
            <Chip key={s.value} asRadio selected={form.scope === s.value} onClick={() => selectScope(s.value)}>
              {s.label}
            </Chip>
          ))}
        </ChipGroup>
      ),
    },
    {
      key: 'range',
      title: '범위',
      valid: !!form.scope && !!form.range && rangeOpts.includes(form.range),
      content: !form.scope ? (
        <p className="t-sub text-ink-2">공간을 먼저 골라 주세요</p>
      ) : (
        <ChipGroup role="radiogroup" ariaLabel="범위" className="flex flex-wrap gap-2">
          {rangeOpts.map((r) => (
            <Chip key={r} asRadio selected={simpleRangeOf(form) === r && !!form.range} onClick={() => selectRange(r)}>
              {TILE_RANGE_LABEL[r]}
            </Chip>
          ))}
        </ChipGroup>
      ),
    },
    {
      key: 'grade',
      title: '등급',
      valid: !!form.grade,
      content: (
        <div className="flex flex-col gap-2">
          <ChipGroup role="radiogroup" ariaLabel="등급" className="flex flex-wrap gap-2">
            {(['basic', 'mid', 'high'] as const).map((g) => (
              <Chip key={g} asRadio selected={form.grade === g} onClick={() => selectGrade(g)}>
                {SIMPLE_GRADE_LABEL[g]}
              </Chip>
            ))}
          </ChipGroup>
          {form.grade && <p className="t-sub text-ink-2">{gradeCaption(form.grade)}</p>}
        </div>
      ),
    },
  ];

  const preciseSteps: FlowStepDef[] = [
    {
      key: 'pspace',
      title: '공간',
      valid: !!form.space,
      content: (
        <ChipGroup role="radiogroup" ariaLabel="공간" className="flex flex-wrap gap-2">
          {TILE_SPACES.map((s) => (
            <Chip key={s.value} asRadio selected={form.space === s.value} onClick={() => selectSpace(s.value)}>
              {s.label}
            </Chip>
          ))}
        </ChipGroup>
      ),
    },
    {
      key: 'dims',
      title: '치수',
      valid: dimsComplete(form),
      content: form.space ? (
        <TileDims
          space={form.space}
          form={form}
          onChange={(p) => {
            patch(p);
            touch('dims');
          }}
          onUnitChange={(u) => patch({ unit: u })}
        />
      ) : (
        <p className="t-sub text-ink-2">공간을 먼저 골라 주세요</p>
      ),
    },
    {
      key: 'tile',
      title: '타일',
      valid: tileValid,
      content: (
        <div className="flex flex-col gap-3">
          {kindStep}
          {sizeStep}
        </div>
      ),
    },
  ];

  const flowSteps = view === 'simple' ? simpleSteps : preciseSteps;

  // ── 결과 위 조정 칩(시공 조건) — 기본값이 선택된 모습으로 보인다(값을 바꾸면 바로 다시 계산) ──
  const r = result?.resolved;
  const service = form.service ?? 'pro';
  const isLivingPlace = form.view === 'precise' ? form.space === 'livingFloor' : form.scope === 'living';
  const adjustGroups: AdjustChipGroup[] = [
    {
      key: 'service',
      label: '시공',
      children: (
        <>
          <Chip shape="square" asRadio selected={service === 'pro'} onClick={() => patch({ service: 'pro' })}>
            맡김
          </Chip>
          <Chip shape="square" asRadio selected={service === 'self'} onClick={() => patch({ service: 'self' })}>
            셀프(자재만)
          </Chip>
        </>
      ),
    },
  ];
  // 붙임 공법 — 정확 모드에서 예전엔 단계였지만 추천값이 이미 좋아 세부 조정으로 옮겼다
  if (view === 'precise') {
    adjustGroups.unshift({
      key: 'setting',
      label: '공법',
      children: (
        <>
          {TILE_SETTINGS.map((o) => (
            <Chip key={o.value} shape="square" asRadio selected={(form.setting ?? rec.setting) === o.value} onClick={() => selectSetting(o.value)}>
              {o.label}
              {o.value === rec.setting && <span className="ml-1 text-[12px] font-normal opacity-80">추천</span>}
            </Chip>
          ))}
        </>
      ),
    });
  }
  if (service === 'pro') {
    adjustGroups.push({
      key: 'method',
      label: '기존',
      children: (
        <>
          {methodOptionsFor(isLivingPlace ? 'living' : undefined).map((o) => (
            <Chip key={o.value} shape="square" asRadio selected={(form.method ?? r?.method) === o.value} onClick={() => patch({ method: o.value })}>
              {o.label}
            </Chip>
          ))}
        </>
      ),
    });
  }
  if (view === 'simple' && form.scope && !isBathScope(form.scope)) {
    adjustGroups.push({
      key: 'pyeong',
      label: '평형',
      children: (
        <>
          {TILE_PYEONG_CHIPS.map((p) => (
            <Chip key={p} shape="square" asRadio selected={(form.pyeong ?? 34) === p} onClick={() => patch({ pyeong: p })}>
              {p}평
            </Chip>
          ))}
        </>
      ),
    });
  }
  adjustGroups.push({
    key: 'pattern',
    label: '패턴',
    children: (
      <>
        {TILE_PATTERNS.map((p) => (
          <Chip key={p.value} shape="square" asRadio selected={(form.pattern ?? 'straight') === p.value} onClick={() => patch({ pattern: p.value })}>
            {p.label}
          </Chip>
        ))}
      </>
    ),
  });
  adjustGroups.push({
    key: 'grout',
    label: '줄눈',
    children: (
      <>
        {TILE_GROUT_TYPES.map((g) => (
          <Chip key={g.value} shape="square" asRadio selected={(form.groutType ?? 'cement') === g.value} onClick={() => patch({ groutType: g.value })}>
            {g.label}
          </Chip>
        ))}
      </>
    ),
  });
  if (view === 'precise') {
    adjustGroups.push({
      key: 'groutMm',
      label: '줄눈 폭',
      children: (
        <>
          {GROUT_MM_CHIPS.map((mm) => (
            <Chip key={mm} shape="square" asRadio selected={(form.groutMm ?? 2) === mm} onClick={() => patch({ groutMm: mm })}>
              {mm}mm
            </Chip>
          ))}
        </>
      ),
    });
  }
  // 켜고 끄는 조건 — 면에 뜻 있는 것만(난방=바닥, 코너비드=벽). 안 고른 값은 서버 기본값(결과의 resolved)으로 보인다
  const extras: { key: 'waterproof' | 'heated' | 'cornerBead' | 'silicone'; label: string; on: boolean }[] = [];
  if (r) {
    if (service === 'pro') extras.push({ key: 'waterproof', label: '방수', on: form.waterproof ?? r.waterproof });
    if (surfaceForChips !== 'wall') extras.push({ key: 'heated', label: '바닥 난방 위', on: form.heated ?? r.heated });
    if (surfaceForChips !== 'floor') extras.push({ key: 'cornerBead', label: '코너비드', on: form.cornerBead ?? r.cornerBead });
    extras.push({ key: 'silicone', label: '실리콘', on: form.silicone ?? r.silicone });
  }
  if (extras.length > 0) {
    adjustGroups.push({
      key: 'extras',
      label: '추가',
      multi: true,
      children: (
        <>
          {extras.map((x) => (
            <Chip key={x.key} shape="square" selected={x.on} onClick={() => patch({ [x.key]: !x.on } as Partial<TileFormState>)}>
              {x.label}
            </Chip>
          ))}
        </>
      ),
    });
  }

  // ── 2026-10-29 형아 지시: 면적(정확 모드는 치수)을 사용자가 넣기 전에는 금액을 어디에도 안 보인다 ──
  // 간단 모드는 첫 칩(공간)이 곧 면적을 정하는 입력이라(욕실 1칸 등 공간마다 기준 면적) 공간을
  // 고르기 전엔 원래부터 결과가 없다 — 그대로 둔다. 정확 모드는 공간만 고르면 기본 치수로
  // 즉답하던 것(dimsAssumed)을, 치수를 다 넣을 때까지 금액 대신 한 줄로 바꾼다.
  // 치수를 다 넣은 직후에는 새 결과가 오기 전까지 "기본 치수로 계산한 옛 결과"가 잠깐 남아 있다 —
  // 그 옛 결과가 기본 치수 결과였는지 기억해 두고(shownDimsAssumed), 그동안에도 금액을 숨긴다.
  const areaPending = view === 'precise' && !!result && (dimsAssumed || (stale && shownDimsAssumed));
  const areaPendingText = '치수를 넣으면 바로 나와요';

  const emptyMessage = view === 'simple' ? '공간·범위·등급을 고르면 바로 나와요' : '공간을 고르면 바로 나와요';
  const currentStepTitle = flowSteps[Math.min(activeIndex, flowSteps.length - 1)]?.title ?? '';

  // 금액 한 줄 — 맡김이면 총액, 셀프면 박스 수
  const amountText = (() => {
    if (!result) return undefined;
    if (result.resolved.service === 'self') {
      const parts = [result.quantity.wall ? `벽 ${formatNum(result.quantity.wall.boxes)}` : null, result.quantity.floor ? `바닥 ${formatNum(result.quantity.floor.boxes)}` : null].filter(Boolean);
      return `${parts.join(' · ')}박스`;
    }
    return formatManRange(result.cost.min, result.cost.max);
  })();

  function scrollToResult() {
    track('calc_cta_click', { process: 'tile', target: 'result_view' });
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 광고 자리를 보일지 — 치수를 넣기 전(금액 숨김 상태)이나 결과가 없을 때는 자리도 숨긴다(2026-10-29)
  const adsShown = !!result && !areaPending;
  const adProcess = CALC_AD_PROCESS.tile;

  // 첫 화면 — 모드를 아직 안 골랐으면 질문 하나만
  if (!modeChosen) {
    return (
      <>
        {/* 2026-10-29: 화면 제목을 허브 카드 이름(타일)과 같게 "타일 계산기"로 — 검색용 h1은 page.tsx 그대로 */}
        <TopNav title="타일 계산기" backHref="/calc" as="p" />
        {/* 표시 모드(관리자)에서만 — 결과 전이라 일반 방문자에겐 자리가 없다 */}
        <CalcAdSlot id="AD-H" show={false} desktopOnly />
        <div className="px-5 lg:px-8 max-w-[1120px] mx-auto">
          <ModePicker
            options={MODE_OPTIONS}
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
      <TopNav
        title="타일 계산기"
        backHref="/calc"
        as="p"
        rightSlot={<Segment size="sm" options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} className="w-[136px]" ariaLabel="계산 모드" />}
      />

      {/* 모바일 — 입력하는 동안 금액 범위를 제목줄 아래에 고정(누르면 결과로). 다 끝나면 하단 바가 대신 보여 준다 */}
      {/* 면적(치수)을 넣기 전에는 이 띠도 안 보인다(2026-10-29) */}
      {amountText && !allDone && !areaPending && (
        <button
          type="button"
          onClick={scrollToResult}
          className={`lg:hidden sticky top-[100px] z-30 w-full h-10 px-5 bg-surface border-b border-line flex items-center justify-between gap-2 transition-opacity ${loading || stale ? 'opacity-60' : ''}`}
          aria-label={`지금 금액 ${amountText} — 결과 보기`}
        >
          <span className="t-sub text-ink-2 flex-none">{result?.resolved.service === 'self' ? '필요 수량' : '지금 견적'}</span>
          <span className="t-body font-semibold text-brown tabular-nums truncate">{amountText}</span>
        </button>
      )}

      {/* 광고 자리 AD-H — PC 에만(728×90), 상단바 아래. 휴대폰엔 넣지 않는다(형아 결정) */}
      <CalcAdSlot id="AD-H" show={adsShown} desktopOnly />

      <div className="px-5 lg:px-8 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        <div className="flex flex-col gap-4">
          <Segment size="sm" options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} className="hidden lg:flex w-[160px]" ariaLabel="계산 모드" />
          <FlowShell steps={flowSteps} activeIndex={activeIndex} completeFlags={completeFlags} />
        </div>

        <div
          ref={resultRef}
          className="scroll-mt-28 flex flex-col gap-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto flowFocusScope"
        >
          {/* 2026-10-29: 정확 모드에서 치수를 다 넣기 전에는 금액 카드 대신 한 줄만 보인다 */}
          {areaPending ? (
            <AreaPendingCard text={areaPendingText} />
          ) : (
            <ResultPanel
              result={result}
              loading={loading}
              error={error}
              stale={stale}
              allDone={allDone}
              form={form}
              emptyMessage={emptyMessage}
              dimsAssumed={dimsAssumed}
              onGradeChange={changeGrade}
              adjust={
                result ? (
                  // 전문 칩은 한 칸에 접어 둔다(기본 접힘) — 펼침은 calc_detail_open으로 센다
                  <Collapsible title="세부 조정" onOpen={() => track('calc_detail_open', { process: 'tile', section: 'adjust' })}>
                    <div className="pt-2 pb-1">
                      <AdjustChips visible groups={adjustGroups} />
                    </div>
                  </Collapsible>
                ) : null
              }
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

      <BottomBar
        stepNumber={Math.min(activeIndex + 1, flowSteps.length)}
        stepCount={flowSteps.length}
        stepTitle={currentStepTitle}
        // 다 끝났을 때만 금액 — 면적(치수)을 넣기 전이면 다 끝날 수 없지만 한 번 더 막아 둔다(2026-10-29)
        amountText={allDone && !areaPending ? amountText : undefined}
        allDone={allDone}
        calculating={loading || stale}
        failed={!result && !!error}
        onDetail={scrollToResult}
        onRetry={() => window.location.reload()}
      />
    </>
  );
}
