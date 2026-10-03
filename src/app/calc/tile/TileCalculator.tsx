// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 오케스트레이터(클라이언트)
//
// 미장 계산기(MortarCalculator)와 같은 틀(설계서 §5):
//   첫 화면 모드 카드 [간단하게 | 정확하게] → 단계 칩 → 즉답 결과 → 조정 칩 → 결과 카드
//   간단 — [공간 → 공법 → 규격], 조정 칩: 시공(맡김/셀프)·평형(거실·현관·베란다)·패턴·등급
//   정확 — [실(치수) → 타일(규격·박스당 장 수) → 시공 조건(공법·패턴·줄눈·붙임)], 조정 칩: 시공·등급
//
// 첫 칩(공간)만 골라도 결과가 나온다 — 안 고른 값은 서버가 기본값으로 계산하고 "가정"으로 보여 준다.
// 공간을 바꾸면 공법·규격은 공간마다 선택지가 달라서 값과 손댐 표시를 함께 되돌린다(매인 관계).
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Segment from '@/components/v1/Segment';
import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import NumberField from '@/components/v1/NumberField';
import { DEFAULT_TILE_FORM, decodeTileForm, type TileFormState } from '@/lib/v1/tileQuery';
import { sanitizeTileForm, roomsStepComplete, needsWallTile, needsFloorTile } from '@/lib/v1/tileEngineInput';
import { useTileCalc } from '@/lib/v1/useTileCalc';
import {
  TILE_SCOPES,
  TILE_PATTERNS,
  TILE_GRADES,
  TILE_SIZES,
  TILE_PYEONG_CHIPS,
  GROUT_MM_CHIPS,
  TILE_PIECES_MIN,
  TILE_PIECES_MAX,
  methodOptionsFor,
  sizeChipsFor,
  sizeCaption,
  bathFloorCodeFor,
  findTileSize,
  isBathScope,
  type TileScope,
  type TileMethod,
} from '@/lib/v1/tilePresets';
import { formatManRange, formatNum } from '@/lib/v1/money';
import FlowShell from '../_components/flow/FlowShell';
import AdjustChips from '../_components/flow/AdjustChips';
import BottomBar from '../_components/flow/BottomBar';
import { useFlowSteps } from '../_components/flow/useFlowSteps';
import { useFlowBackNav } from '../_components/flow/useFlowBackNav';
import { loadSessionState, saveSessionState } from '../_components/flow/sessionPersist';
import type { AdjustChipGroup, FlowStepDef } from '../_components/flow/types';
import ModePicker, { type CalcViewMode } from '../_components/ModePicker';
import { isWithinRange, rangeCaption } from '../_components/inputRanges';
import TileRooms from './TileRooms';
import ResultPanel from './ResultPanel';

/** 새로 고침 복원 열쇠·판 번호 */
const SESSION_KEY = 'calc:tile:v1';
const SESSION_VERSION = 1;
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

/** 모드 카드 캡션(설계서 §5-2) */
const MODE_OPTIONS = [
  { value: 'simple' as const, title: '간단하게', caption: '공간만 고르면 바로' },
  { value: 'precise' as const, title: '정확하게', caption: '치수와 타일 규격까지' },
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
  const rooms = form.rooms ?? [];

  // ── 단계 완료 판정(값 검증만 — 손댐은 useFlowSteps가 따로 본다) ──
  const wallNeeded = needsWallTile(rooms);
  const floorNeeded = needsFloorTile(rooms);
  const piecesOk = (v: number | undefined) => v === undefined || (Number.isInteger(v) && isWithinRange(v, TILE_PIECES_MIN, TILE_PIECES_MAX));
  const stepDefs =
    view === 'simple'
      ? [
          { key: 'space', valid: !!form.scope },
          { key: 'method', valid: !!form.method },
          { key: 'size', valid: !!form.sizeCode },
        ]
      : [
          { key: 'rooms', valid: roomsStepComplete(rooms) },
          {
            key: 'tiles',
            valid: (!wallNeeded || (!!form.wallSizeCode && piecesOk(form.wallPieces))) && (!floorNeeded || (!!form.floorSizeCode && piecesOk(form.floorPieces))),
          },
          { key: 'conditions', valid: !!form.method },
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

  // 정확 모드는 실 카드를 한 번이라도 만지기 전엔 계산하지 않는다(첫 단계부터 시작)
  const formForCalc: TileFormState = view === 'precise' && !touchedMap.rooms ? { ...form, rooms: [] } : form;
  const { result, loading, error, stale } = useTileCalc(formForCalc);

  // ── 간단 모드 손잡이 ──
  /** 공간 고르기 — 바뀌면 공법·규격 값과 손댐 표시를 되돌린다 */
  function selectScope(s: TileScope) {
    if (s !== form.scope) {
      patch({ scope: s, method: undefined, sizeCode: undefined });
      resetTouched(['method', 'size']);
    }
    touch('space');
  }
  function selectMethod(m: TileMethod, stepKey: 'method' | 'conditions') {
    patch({ method: m });
    touch(stepKey);
  }
  function selectSize(code: string) {
    patch({ sizeCode: code });
    touch('size');
  }

  // ── 정확 모드 손잡이 ──
  function changeRooms(next: TileFormState['rooms']) {
    patch({ rooms: next });
    touch('rooms');
  }

  // ── 단계 내용 ──
  const scope = form.scope;
  const sizeCaptionText = (() => {
    const code = form.sizeCode;
    if (!code) return null;
    const base = sizeCaption(code);
    return isBathScope(scope) ? `${base} · 바닥 ${findTileSize(bathFloorCodeFor(code))?.label}` : base;
  })();

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
      key: 'method',
      title: '공법',
      valid: !!form.method,
      content: (
        <ChipGroup role="radiogroup" ariaLabel="공법" className="flex flex-wrap gap-2">
          {methodOptionsFor(scope).map((o) => (
            <Chip key={o.value} asRadio selected={form.method === o.value} onClick={() => selectMethod(o.value, 'method')}>
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
      ),
    },
    {
      key: 'size',
      title: '타일 규격',
      valid: !!form.sizeCode,
      content: (
        <div className="flex flex-col gap-2">
          <ChipGroup role="radiogroup" ariaLabel="타일 규격" className="flex flex-wrap gap-2">
            {sizeChipsFor(scope).map((code) => (
              <Chip key={code} asRadio selected={form.sizeCode === code} onClick={() => selectSize(code)}>
                {findTileSize(code)?.label}
              </Chip>
            ))}
          </ChipGroup>
          {sizeCaptionText && <p className="t-sub text-ink-2">{sizeCaptionText}</p>}
        </div>
      ),
    },
  ];

  /** 정확 모드 — 벽·바닥 규격 칩 + 박스당 장 수 칸 한 묶음 */
  function tilePicker(side: 'wall' | 'floor') {
    const codeKey = side === 'wall' ? 'wallSizeCode' : 'floorSizeCode';
    const piecesKey = side === 'wall' ? 'wallPieces' : 'floorPieces';
    const code = form[codeKey];
    const preset = findTileSize(code);
    const pieces = form[piecesKey];
    const caption = rangeCaption(pieces, TILE_PIECES_MIN, TILE_PIECES_MAX, '장');
    const label = side === 'wall' ? '벽' : '바닥';
    return (
      <div className="flex flex-col gap-2">
        <span className="t-sub text-ink-2">{label}</span>
        <ChipGroup role="radiogroup" ariaLabel={`${label} 타일 규격`} className="grid grid-cols-3 gap-2">
          {TILE_SIZES.map((s) => (
            <Chip
              key={s.code}
              asRadio
              selected={code === s.code}
              className="w-full justify-center"
              style={{ fontSize: '13px' }}
              onClick={() => {
                // 규격을 바꾸면 박스당 장 수는 그 규격 관례값으로 다시 채운다
                patch({ [codeKey]: s.code, [piecesKey]: s.piecesPerBox } as Partial<TileFormState>);
                touch('tiles');
              }}
            >
              {s.label}
            </Chip>
          ))}
        </ChipGroup>
        {preset && (
          <div className="flex items-center gap-2">
            <NumberField
              value={pieces ?? preset.piecesPerBox}
              onChange={(v) => {
                patch({ [piecesKey]: v === '' ? undefined : v } as Partial<TileFormState>);
                touch('tiles');
              }}
              suffix="장/박스"
              aria-label={`${label} 박스당 장 수`}
              className="flex-1 min-w-0"
            />
            <span className="t-sub text-ink-2 flex-none">{preset.piecesEstimated ? '상자 표기 확인' : '상자 표기와 다르면 고치기'}</span>
          </div>
        )}
        {caption && <p className="t-sub text-danger">{caption}</p>}
      </div>
    );
  }

  const preciseSteps: FlowStepDef[] = [
    {
      key: 'rooms',
      title: '실',
      valid: roomsStepComplete(rooms),
      content: <TileRooms rooms={rooms} unit={form.unit ?? 'mm'} onRoomsChange={changeRooms} onUnitChange={(u) => patch({ unit: u })} />,
    },
    {
      key: 'tiles',
      title: '타일',
      valid: stepDefs[1].valid,
      content: (
        <div className="flex flex-col gap-4">
          {wallNeeded && tilePicker('wall')}
          {floorNeeded && tilePicker('floor')}
        </div>
      ),
    },
    {
      key: 'conditions',
      title: '시공 조건',
      valid: !!form.method,
      content: (
        <div className="flex flex-col gap-3">
          <ChipGroup role="radiogroup" ariaLabel="공법" className="flex flex-wrap gap-2">
            {methodOptionsFor(undefined).map((o) => (
              <Chip key={o.value} asRadio selected={form.method === o.value} onClick={() => selectMethod(o.value, 'conditions')}>
                {o.label}
              </Chip>
            ))}
          </ChipGroup>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="t-sub text-ink-2 w-9 flex-none">패턴</span>
            <ChipGroup role="radiogroup" ariaLabel="패턴" className="flex flex-wrap gap-2">
              {TILE_PATTERNS.map((p) => (
                <Chip key={p.value} size="sm" shape="square" asRadio selected={(form.pattern ?? 'straight') === p.value} onClick={() => patch({ pattern: p.value })}>
                  {p.label}
                </Chip>
              ))}
            </ChipGroup>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="t-sub text-ink-2 w-9 flex-none">줄눈</span>
            <ChipGroup role="radiogroup" ariaLabel="줄눈 폭" className="flex flex-wrap gap-2">
              {GROUT_MM_CHIPS.map((mm) => (
                <Chip key={mm} size="sm" shape="square" asRadio selected={(form.groutMm ?? 2) === mm} onClick={() => patch({ groutMm: mm })}>
                  {mm}mm
                </Chip>
              ))}
            </ChipGroup>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="t-sub text-ink-2 w-9 flex-none">붙임</span>
            <ChipGroup role="radiogroup" ariaLabel="붙임 공법" className="flex flex-wrap gap-2">
              <Chip size="sm" shape="square" asRadio selected={(form.setting ?? 'press') === 'press'} onClick={() => patch({ setting: 'press' })}>
                압착
              </Chip>
              <Chip size="sm" shape="square" asRadio selected={form.setting === 'mortar'} onClick={() => patch({ setting: 'mortar' })}>
                떠붙임
              </Chip>
            </ChipGroup>
          </div>
        </div>
      ),
    },
  ];

  const steps = view === 'simple' ? simpleSteps : preciseSteps;

  // ── 결과 위 조정 칩 — 기본값이 선택된 모습으로 보인다(값을 바꾸면 바로 다시 계산) ──
  const service = form.service ?? 'pro';
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
  if (view === 'simple' && scope && !isBathScope(scope)) {
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
  if (view === 'simple') {
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
  }
  adjustGroups.push({
    key: 'grade',
    label: '등급',
    children: (
      <>
        {TILE_GRADES.map((g) => (
          <Chip key={g.value} shape="square" asRadio selected={(form.grade ?? 'mid') === g.value} onClick={() => patch({ grade: g.value })}>
            {g.label}
          </Chip>
        ))}
      </>
    ),
  });

  const emptyMessage = view === 'simple' ? '공간을 고르면 바로 나와요' : '치수를 넣으면 바로 나와요';
  const currentStepTitle = steps[Math.min(activeIndex, steps.length - 1)]?.title ?? '';

  // 하단 바 — 맡김이면 금액, 셀프면 박스 수
  const bottomText = (() => {
    if (!result) return undefined;
    if (result.resolved.service === 'self') {
      const parts = [result.quantity.wall ? `벽 ${formatNum(result.quantity.wall.boxes)}` : null, result.quantity.floor ? `바닥 ${formatNum(result.quantity.floor.boxes)}` : null].filter(Boolean);
      return `${parts.join(' · ')}박스`;
    }
    return formatManRange(result.cost.min, result.cost.max);
  })();

  function scrollToResult() {
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 첫 화면 — 모드를 아직 안 골랐으면 질문 하나만
  if (!modeChosen) {
    return (
      <>
        <TopNav title="타일 계산기" backHref="/calc" as="p" />
        <div className="px-5 lg:px-8 max-w-[1120px] mx-auto">
          <ModePicker
            options={MODE_OPTIONS}
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
        title="타일 계산기"
        backHref="/calc"
        as="p"
        rightSlot={<Segment size="sm" options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} className="w-[136px]" ariaLabel="계산 모드" />}
      />

      <div className="px-5 lg:px-8 py-4 pb-20 lg:pb-8 max-w-[1120px] mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,560px)_1fr] lg:gap-8 lg:items-start">
        <div className="flex flex-col gap-4">
          <Segment size="sm" options={VIEW_OPTIONS} value={view} onChange={(v) => patch({ view: v })} className="hidden lg:flex w-[160px]" ariaLabel="계산 모드" />
          <FlowShell steps={steps} activeIndex={activeIndex} completeFlags={completeFlags} />
        </div>

        <div
          ref={resultRef}
          className="scroll-mt-16 flex flex-col gap-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-81px-1rem)] lg:overflow-y-auto flowFocusScope"
        >
          <AdjustChips visible={!!result} groups={adjustGroups} />
          <ResultPanel result={result} loading={loading} error={error} stale={stale} allDone={allDone} form={form} emptyMessage={emptyMessage} />
        </div>
      </div>

      <BottomBar
        stepNumber={Math.min(activeIndex + 1, steps.length)}
        stepCount={steps.length}
        stepTitle={currentStepTitle}
        amountText={bottomText}
        allDone={allDone}
        calculating={loading || stale}
        failed={!result && !!error}
        onDetail={scrollToResult}
        onRetry={() => window.location.reload()}
      />
    </>
  );
}
