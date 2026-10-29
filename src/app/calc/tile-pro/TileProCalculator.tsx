// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 — 화면(클라이언트)
//
// 누구를 위한 화면: 타일 기술자·현장 실장이 "몇 장, 몇 박스, 컷 몇 장"만 빨리 뽑으러 온다.
//   금액은 없다. 소비자용(/calc/tile)과 달리 단계별 질문 없이 한 화면에 입력·도면·물량표를 다 둔다.
//
// 화면 순서(모바일 위에서 아래로):
//   [바닥 | 벽] → 도면(타일 배치 그림, 확대·이동) → 방 치수 → 문·창 → 타일 조건 → 물량표 → [PNG 저장][링크 복사]
//   PC(lg 이상)는 왼쪽에 도면을 붙여 두고(sticky) 오른쪽에서 입력·물량표를 본다.
//
// 공용 도면 부품(src/components/plan)을 쓰고, 타일만의 일은 TileLayer(그림)와
// src/lib/tilepro(계산)가 맡는다 — 붙박이장·냉장고장도 같은 도면 부품 위에 자기 플러그인을 얹으면 된다.
//
// 입력값은 주소(?d=)에 늘 담아 둔다(history.replaceState) — "링크 복사"는 지금 주소를 그대로 복사.
//
// 추적(GA4, 다른 계산기와 같은 이름): calc_view(들어옴 1번) · calc_run(입력이 멈추고 1.5초 뒤 1번씩)
//   · calc_cta_click(png·share) · calc_cost_input(자재비 첫 입력 때 1번)
//
// 자재비(2026-10-28 추가): 물량표 아래 CostPanel. 단가는 사용자가 직접 넣고(기본 비어 있음),
//   기기(localStorage)에 기억해 다음 방에도 채운다. 링크(?c=)에는 "단가 포함"을 켠 때만 단가를 담는다.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Segment from '@/components/v1/Segment';
import Chip from '@/components/v1/Chip';
import ChipGroup from '@/components/v1/ChipGroup';
import Container from '@/components/layout/Container';
import PlanCanvas from '@/components/plan/PlanCanvas';
import RoomShapeInput from '@/components/plan/RoomShapeInput';
import OpeningsInput from '@/components/plan/OpeningsInput';
import MmField from '@/components/plan/MmField';
import { exportPlanPng } from '@/components/plan/exportPng';
import { buildRoom, polygonArea } from '@/components/plan/geometry';
import {
  ADHESIVE_OPTIONS,
  DEFAULT_TILE_PRO,
  JOINT_CHIPS,
  ORIGIN_OPTIONS,
  PATTERN_OPTIONS,
  PRO_TILE_SIZES,
  REUSE_OPTIONS,
  decodeTileProForm,
  encodeTileProForm,
  type TileProForm,
} from '@/lib/tilepro/form';
import { computeTilePro } from '@/lib/tilepro/quantity';
import { track } from '@/lib/analytics';
import CostPanel from './CostPanel';
import { DEFAULT_COST, buildCostRows, decodeCost, encodeCost, summarizeCost, type CostState } from '@/lib/tilepro/cost';
import TileLayer, { TILE_COLORS } from './TileLayer';
// 광고 자리(2026-10-29) — 광고 전역 스위치가 꺼져 있으면 일반 방문자에겐 아무것도 안 보인다
import CalcAdSlot from '@/components/ads/CalcAdSlot';

/** 단가 기억 저장 이름(기기 안) */
const PRICE_STORE_KEY = 'tilepro_prices_v1';

/** 숫자 → "1,234" */
const n0 = (v: number) => Math.round(v).toLocaleString('ko-KR');
/** 숫자 → 소수 1자리 */
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('ko-KR');
/** 숫자 → 소수 2자리 */
const n2 = (v: number) => v.toFixed(2);

/** 화면 칸 제목(작은 갈색 글자) — 카드 속 카드를 만들지 않으려고 제목+내용만 쌓는다 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-section text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function TileProCalculator() {
  const searchParams = useSearchParams();
  // 공유 링크로 들어왔으면 그 값으로 시작, 아니면 기본값
  const [form, setForm] = useState<TileProForm>(() => decodeTileProForm(searchParams.get('d')) ?? DEFAULT_TILE_PRO);
  /** 일부 값만 바꾸기 */
  const set = (patch: Partial<TileProForm>) => setForm((f) => ({ ...f, ...patch }));

  // ── 자재비 상태 ──
  const [cost, setCost] = useState<CostState>(() => decodeCost(searchParams.get('c')) ?? DEFAULT_COST);
  const setCostPatch = (patch: Partial<CostState>) => setCost((c) => ({ ...c, ...patch }));
  // 링크에 단가를 담을지(기본 아니오 — 업체가 노출 방지)
  const [shareWithPrices, setShareWithPrices] = useState(false);
  // 기기에 기억한 단가 불러오기 — 처음 한 번, 링크로 받은 단가가 있으면 그것이 우선
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PRICE_STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const prices: Record<string, number> = {};
      Object.entries(saved).forEach(([k, v]) => {
        if (/^[a-z_]{1,20}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) prices[k] = v;
      });
      setCost((c) => ({ ...c, prices: { ...prices, ...c.prices } }));
    } catch {
      /* 저장소를 못 읽어도 화면은 그대로 */
    }
  }, []);
  /** 단가 바꾸기 + 기기에 기억(직접 고친 때만 저장 — 링크로 받은 남의 단가가 내 기억을 덮지 않게) */
  const setPrice = (key: string, v: number) => {
    if (!key) return;
    setCost((c) => {
      const prices = { ...c.prices };
      if (v > 0) prices[key] = v;
      else delete prices[key];
      try {
        const raw = window.localStorage.getItem(PRICE_STORE_KEY);
        const saved = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        if (v > 0) saved[key] = v;
        else delete saved[key];
        window.localStorage.setItem(PRICE_STORE_KEY, JSON.stringify(saved));
      } catch {
        /* 저장 실패는 무시 */
      }
      return { ...c, prices };
    });
  };
  // 자재비 첫 입력 때 1번만 추적
  const costTouched = useRef(false);
  const onCostTouch = () => {
    if (costTouched.current) return;
    costTouched.current = true;
    track('calc_cost_input', { process: 'tile_pro', mode: form.surface });
  };

  // 벽 전개도에서 지금 보고 있는 벽(-1 = 평면 보기, -2 = 자동: 첫 시공 벽)
  const [viewWall, setViewWall] = useState<number>(-2);
  const svgRef = useRef<SVGSVGElement>(null);
  const [toast, setToast] = useState('');

  // ── 계산(순수 함수) ──
  const room = useMemo(() => buildRoom(form.shape), [form.shape]);
  const result = useMemo(() => computeTilePro(form), [form]);
  const costRows = useMemo(() => buildCostRows(form, result, cost), [form, result, cost]);
  const costSummary = useMemo(() => summarizeCost(costRows, cost.vat), [costRows, cost.vat]);
  const tile = useMemo(() => ({ w: form.tileW, h: form.tileH, joint: form.joint }), [form.tileW, form.tileH, form.joint]);

  // 벽 모드에서 고른 벽이 빠졌거나 사라졌으면 첫 시공 벽으로
  const wallRegions = result.regions.filter((r) => r.wall >= 0);
  const shownWall =
    form.surface !== 'wall'
      ? -1
      : viewWall >= 0 && wallRegions.some((r) => r.wall === viewWall)
        ? viewWall
        : viewWall === -1
          ? -1
          : (wallRegions[0]?.wall ?? -1);
  const shownRegion = form.surface === 'floor' ? result.regions[0] : wallRegions.find((r) => r.wall === shownWall);

  // ── 주소에 입력값 담기(링크 공유용) ──
  useEffect(() => {
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('d', encodeTileProForm(form));
      url.searchParams.set('c', encodeCost(cost, shareWithPrices));
      window.history.replaceState(window.history.state, '', url.toString());
    }, 400);
    return () => clearTimeout(t);
  }, [form, cost, shareWithPrices]);

  // ── 추적 ──
  useEffect(() => {
    track('calc_view', { process: 'tile_pro' });
  }, []);
  const firstRun = useRef(true);
  useEffect(() => {
    // 처음 그려질 때(기본값)는 세지 않는다 — 공유 링크로 들어온 경우만 1번 센다
    if (firstRun.current) {
      firstRun.current = false;
      if (!searchParams.get('d')) return;
    }
    const t = setTimeout(() => {
      track('calc_run', { process: 'tile_pro', mode: form.surface, tile_pattern: form.pattern });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  /** 잠깐 뜨는 알림 */
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  /** 그림 아래 붙일 물량 요약 글줄(PNG·복사 공용) */
  const summaryLines = () => [
    `${form.surface === 'floor' ? '바닥' : '벽'} ${n2(result.netSqm)}㎡ · 타일 ${form.tileW}×${form.tileH} · 줄눈 ${form.joint}mm · ${PATTERN_OPTIONS.find((p) => p.value === form.pattern)?.label}`,
    `필요 ${n0(result.total)}장 (${n0(result.boxes)}박스, 박스당 ${form.perBox}장) · 온장 ${n0(result.full)} · 컷 ${n0(result.cut)} · 로스 ${n1(result.lossPct)}%`,
    `줄눈재 ${n1(result.grout.kg)}kg · ${ADHESIVE_OPTIONS.find((a) => a.value === form.adhesive)?.label} ${n0(result.adhesive.kg)}kg (${result.adhesive.packKg}kg ${result.adhesive.packs}${form.adhesive === 'bond' ? '통' : '포'})`,
  ];

  /** PNG 아래 자재 목록표 — 단가를 넣은 줄은 금액까지, 합계는 단가가 하나라도 있을 때만 */
  const costTable = () => {
    const rows: { cols: [string, string, string]; bold?: boolean }[] = costRows
      .filter((r) => r.qty > 0)
      .map((r) => ({
        cols: [r.name, `${n1(r.qty)} ${r.unit}`, r.price > 0 ? `${n0(r.amount)}원` : ''] as [string, string, string],
      }));
    if (costSummary.hasPrice) {
      if (cost.vat) rows.push({ cols: ['부가세 10%', '', `${n0(costSummary.vat)}원`] });
      rows.push({ cols: [cost.vat ? '합계(부가세 포함)' : '합계', '', `${n0(costSummary.total)}원`], bold: true });
    }
    return { title: '자재 목록', rows };
  };

  /** PNG 저장 */
  const onPng = async () => {
    track('calc_cta_click', { process: 'tile_pro', target: 'png' });
    const title = form.surface === 'floor' ? '타일 배치도 — 바닥' : `타일 배치도 — ${shownRegion ? shownRegion.label : '평면'}`;
    const ok = await exportPlanPng(svgRef.current, { fileName: `타일물량_${form.tileW}x${form.tileH}`, title, lines: summaryLines(), table: costTable() });
    if (!ok) flash('그림 저장에 실패했어요');
  };

  /** 링크 복사 */
  const onShare = async () => {
    track('calc_cta_click', { process: 'tile_pro', target: 'share' });
    const url = new URL(window.location.href);
    url.searchParams.set('d', encodeTileProForm(form));
    url.searchParams.set('c', encodeCost(cost, shareWithPrices));
    try {
      await navigator.clipboard.writeText(url.toString());
      flash('링크를 복사했어요');
    } catch {
      flash('주소창의 링크를 복사해 주세요');
    }
  };

  // 지금 고른 규격 칩(직접 넣은 값이면 없음) — 가로·세로 바꿔 놓은 것도 같은 규격으로 본다
  const sizeCode = PRO_TILE_SIZES.find(
    (s) => (s.w === form.tileW && s.h === form.tileH) || (s.w === form.tileH && s.h === form.tileW),
  )?.code;

  // ── 도면 ──
  const drawing =
    form.surface === 'floor' || shownWall < 0 ? (
      <PlanCanvas
        svgRef={svgRef}
        outline={room}
        marks={form.openings}
        wallNumbers
        dimWalls={form.surface === 'wall' ? form.wallsOff : []}
        onWallTap={form.surface === 'wall' ? (i) => setViewWall(i) : undefined}
        ariaLabel={`방 평면도 — 넓이 ${n2(polygonArea(room) / 1e6)}㎡`}
      >
        {form.surface === 'floor' && result.regions[0]
          ? ({ unit }) => <TileLayer layout={result.regions[0].layout} tile={tile} unit={unit} />
          : undefined}
      </PlanCanvas>
    ) : shownRegion ? (
      <PlanCanvas
        svgRef={svgRef}
        outline={shownRegion.outline}
        holes={shownRegion.holes}
        holeLabels={form.openings.filter((o) => o.wall === shownRegion.wall).map((o) => (o.kind === 'door' ? '문' : '창'))}
        dims="box"
        ariaLabel={`${shownRegion.label} 전개도`}
      >
        {({ unit }) => <TileLayer layout={shownRegion.layout} tile={tile} unit={unit} />}
      </PlanCanvas>
    ) : null;

  return (
    <>
      <TopNav title="타일 물량 계산기" backHref="/calc" as="p" />

      {/* 광고 자리 AD-H — PC 에만(728×90), 상단바 아래(2026-10-29). 물량 계산기는 공정 스폰서 자리 없음 */}
      <CalcAdSlot id="AD-H" show desktopOnly />

      <Container as="div" className="py-4 pb-24 lg:py-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          {/* ── 왼쪽(모바일 위): 바닥/벽 + 도면 ── */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
            <p className="hidden lg:block t-page text-ink">타일 물량 계산기</p>
            <Segment
              ariaLabel="시공 면"
              options={[
                { value: 'floor' as const, label: '바닥' },
                { value: 'wall' as const, label: '벽' },
              ]}
              value={form.surface}
              // 벽으로 바꾸면 시작 기준은 바닥선 모서리(현장 관행)로 맞춘다. 바닥은 고른 값 그대로
              onChange={(surface) => set(surface === 'wall' ? { surface, origin: 'corner' } : { surface })}
            />

            {/* 벽 모드: 평면 / 벽 N 고르기 */}
            {form.surface === 'wall' && (
              <ChipGroup role="radiogroup" ariaLabel="보는 면" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <Chip size="sm" asRadio selected={shownWall < 0} onClick={() => setViewWall(-1)}>
                  평면
                </Chip>
                {wallRegions.map((r) => (
                  <Chip key={r.wall} size="sm" asRadio selected={shownWall === r.wall} onClick={() => setViewWall(r.wall)}>
                    {r.label}
                  </Chip>
                ))}
              </ChipGroup>
            )}

            <div className="rounded-card overflow-hidden bg-white border border-v1-line-2">{drawing}</div>

            {/* 그림 범례 + 지금 보는 면의 장 수 */}
            <div className="flex items-center gap-3 t-sub text-ink-2 flex-wrap">
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded-[2px]" style={{ background: TILE_COLORS.full, border: `1px solid ${TILE_COLORS.line}` }} />
                온장
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded-[2px]" style={{ background: TILE_COLORS.cut, border: `1px solid ${TILE_COLORS.line}` }} />
                컷
              </span>
              {shownRegion ? (
                <span className="ml-auto tabular-nums">
                  {shownRegion.label} {n2(shownRegion.layout.netAreaMm2 / 1e6)}㎡ · 온장 {shownRegion.layout.full} · 컷 {shownRegion.layout.cut}
                </span>
              ) : (
                <span className="ml-auto">벽 번호를 누르면 전개도</span>
              )}
            </div>
          </div>

          {/* ── 오른쪽(모바일 아래): 입력 + 물량표 ── */}
          <div className="flex flex-col gap-7 mt-6 lg:mt-0">
            <Section title="방 치수">
              <RoomShapeInput value={form.shape} onChange={(shape) => set({ shape })} />
              {form.surface === 'wall' && (
                <>
                  <MmField label="시공 높이" value={form.wallH} min={300} max={6000} onChange={(wallH) => set({ wallH })} className="max-w-[50%]" />
                  <div className="flex flex-col gap-2">
                    <span className="t-sub text-ink-2">붙이는 벽</span>
                    <ChipGroup role="group" ariaLabel="붙이는 벽" className="flex gap-2 flex-wrap">
                      {room.map((_, i) => {
                        const on = !form.wallsOff.includes(i);
                        return (
                          <Chip
                            key={i}
                            size="sm"
                            selected={on}
                            onClick={() => set({ wallsOff: on ? [...form.wallsOff, i] : form.wallsOff.filter((w) => w !== i) })}
                          >
                            벽 {i + 1}
                          </Chip>
                        );
                      })}
                    </ChipGroup>
                  </div>
                </>
              )}
            </Section>

            <Section title="문·창">
              <OpeningsInput
                value={form.openings}
                onChange={(openings) => set({ openings })}
                wallCount={room.length}
                showHeight={form.surface === 'wall'}
              />
            </Section>

            <Section title="타일">
              <ChipGroup role="radiogroup" ariaLabel="타일 규격" className="flex gap-2 flex-wrap">
                {PRO_TILE_SIZES.map((s) => (
                  <Chip
                    key={s.code}
                    asRadio
                    shape="square"
                    selected={sizeCode === s.code}
                    onClick={() => set({ tileW: s.w, tileH: s.h, perBox: s.perBox, thick: s.thick })}
                  >
                    {s.code.replace('x', '×')}
                  </Chip>
                ))}
              </ChipGroup>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <MmField label="가로" value={form.tileW} min={50} max={3200} onChange={(tileW) => set({ tileW })} />
                <MmField label="세로" value={form.tileH} min={50} max={3200} onChange={(tileH) => set({ tileH })} />
                <button
                  type="button"
                  onClick={() => set({ tileW: form.tileH, tileH: form.tileW })}
                  className="h-11 px-3 rounded-[10px] border border-v1-line-3 bg-white t-sub text-ink-2 active:bg-v1-card-soft"
                  aria-label="타일 가로세로 방향 바꾸기"
                >
                  ↻ 방향
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="t-sub text-ink-2">패턴</span>
                <ChipGroup role="radiogroup" ariaLabel="패턴" className="flex gap-2 flex-wrap">
                  {PATTERN_OPTIONS.map((p) => (
                    <Chip key={p.value} asRadio selected={form.pattern === p.value} onClick={() => set({ pattern: p.value })}>
                      {p.label}
                    </Chip>
                  ))}
                </ChipGroup>
              </div>

              <div className="flex flex-col gap-2">
                <span className="t-sub text-ink-2">시작 기준</span>
                <ChipGroup role="radiogroup" ariaLabel="시작 기준" className="flex gap-2 flex-wrap">
                  {ORIGIN_OPTIONS.map((o) => (
                    <Chip key={o.value} asRadio selected={form.origin === o.value} onClick={() => set({ origin: o.value })}>
                      {o.label}
                    </Chip>
                  ))}
                </ChipGroup>
              </div>

              <div className="flex flex-col gap-2">
                <span className="t-sub text-ink-2">줄눈</span>
                <ChipGroup role="radiogroup" ariaLabel="줄눈 폭" className="flex gap-2 flex-wrap">
                  {JOINT_CHIPS.map((j) => (
                    <Chip key={j} size="sm" asRadio selected={form.joint === j} onClick={() => set({ joint: j })}>
                      {j}mm
                    </Chip>
                  ))}
                </ChipGroup>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <MmField label="박스당" suffix="장" value={form.perBox} min={1} max={200} onChange={(perBox) => set({ perBox })} />
                <MmField label="두께" value={form.thick} min={3} max={30} onChange={(thick) => set({ thick })} />
                <MmField label="파손 여유" suffix="%" value={form.spare} min={0} max={30} onChange={(spare) => set({ spare })} />
              </div>

              <div className="flex flex-col gap-2">
                <span className="t-sub text-ink-2">접착</span>
                <ChipGroup role="radiogroup" ariaLabel="접착 방식" className="flex gap-2 flex-wrap">
                  {ADHESIVE_OPTIONS.map((a) => (
                    <Chip key={a.value} size="sm" asRadio selected={form.adhesive === a.value} onClick={() => set({ adhesive: a.value })}>
                      {a.label}
                    </Chip>
                  ))}
                </ChipGroup>
              </div>

              <div className="flex flex-col gap-2">
                <span className="t-sub text-ink-2">자투리 재사용</span>
                <ChipGroup role="radiogroup" ariaLabel="자투리 재사용" className="flex gap-2 flex-wrap">
                  {REUSE_OPTIONS.map((o) => (
                    <Chip key={o.value} size="sm" asRadio selected={form.reuse === o.value} onClick={() => set({ reuse: o.value })}>
                      {o.label}
                    </Chip>
                  ))}
                </ChipGroup>
              </div>
            </Section>

            {/* ── 물량표(결과 카드 하나) ── */}
            <section aria-label="물량표" className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4" id="tilepro-result">
              <div>
                <p className="t-sub text-ink-2">필요 수량</p>
                <p className="text-[28px] font-bold text-ink tabular-nums leading-tight">
                  {n0(result.total)}장 <span className="text-[20px] text-ink-2">· {n0(result.boxes)}박스</span>
                </p>
              </div>
              <table className="w-full text-[14px] tabular-nums">
                <tbody>
                  {[
                    ['시공 면적', `${n2(result.netSqm)}㎡`],
                    ['온장', `${n0(result.full)}장`],
                    ['컷 자리', `${n0(result.cut)}곳 → 타일 ${n0(result.cutTiles)}장${form.reuse !== 'off' ? ` (자투리 ${REUSE_OPTIONS.find((o) => o.value === form.reuse)?.label})` : ''}`],
                    ['파손 여유', `${n0(result.spareTiles)}장 (${form.spare}%)`],
                    ['로스율', `${n1(result.lossPct)}%`],
                    ['박스', `${n0(result.boxes)}박스 (박스당 ${form.perBox}장)`],
                    ['줄눈재', `${n1(result.grout.kg)}kg (${result.grout.packKg}kg ${result.grout.packs}포)`],
                    [
                      ADHESIVE_OPTIONS.find((a) => a.value === form.adhesive)?.label ?? '접착제',
                      `${n0(result.adhesive.kg)}kg (${result.adhesive.packKg}kg ${result.adhesive.packs}${form.adhesive === 'bond' ? '통' : '포'})`,
                    ],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t border-v1-line-2">
                      <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2 whitespace-nowrap">
                        {k}
                      </th>
                      <td className="py-2 text-right text-ink">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 벽 모드: 벽별 내역 */}
              {form.surface === 'wall' && wallRegions.length > 0 && (
                <table className="w-full text-[13px] tabular-nums">
                  <thead>
                    <tr className="text-v1-text-label">
                      <th scope="col" className="py-1 text-left font-normal">벽</th>
                      <th scope="col" className="py-1 text-right font-normal">면적</th>
                      <th scope="col" className="py-1 text-right font-normal">온장</th>
                      <th scope="col" className="py-1 text-right font-normal">컷</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallRegions.map((r) => (
                      <tr key={r.wall} className="border-t border-v1-line-2">
                        <td className="py-1">{r.label}</td>
                        <td className="py-1 text-right">{n2(r.layout.netAreaMm2 / 1e6)}㎡</td>
                        <td className="py-1 text-right">{r.layout.full}</td>
                        <td className="py-1 text-right">{r.layout.cut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* 로스율 정의 — 기술자가 자기 셈과 맞춰 볼 수 있게 식을 그대로 적는다 */}
              <p className="t-sub text-v1-text-disabled -mt-2">로스율 = (필요 장 수 × 타일 면적 − 시공 면적) ÷ 시공 면적</p>
              {/* 로스가 이상하게 크면(40% 넘음) 이유 한 줄 */}
              {result.lossPct > 40 && (
                <p className="t-sub text-accent">
                  {form.origin === 'center'
                    ? '가운데 시작이라 가장자리 컷이 많아요 — 모서리 시작을 추천'
                    : form.reuse === 'off'
                      ? '컷 조각을 전부 새 타일로 셌어요 — 자투리 "같은 치수"를 켜 보세요'
                      : '방에 비해 타일이 커서 컷이 많아요'}
                </p>
              )}
              {result.truncated && <p className="t-sub text-danger">타일이 너무 많아 일부만 셌어요. 규격을 확인하세요.</p>}
              <p className="t-sub text-v1-text-disabled">줄눈재·접착제는 표준 소요량 기준 대략값</p>

            </section>

            <CostPanel form={form} cost={cost} rows={costRows} summary={costSummary} onTouch={onCostTouch} onChange={setCostPatch} onPrice={setPrice} />

            {/* 광고 자리 AD-R — 자재비 아래(2026-10-29) */}
            <CalcAdSlot id="AD-R" show />

            <div className="flex flex-col gap-3">
              <Chip size="sm" className="self-start" selected={shareWithPrices} onClick={() => setShareWithPrices((v) => !v)}>
                링크에 단가 포함
              </Chip>
              <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onPng}
                className="h-12 rounded-[12px] bg-accent active:bg-accent-press text-white text-[15px] font-semibold"
              >
                도면 PNG 저장
              </button>
              <button
                type="button"
                onClick={onShare}
                className="h-12 rounded-[12px] border border-v1-line-3 bg-white text-[15px] text-ink font-semibold active:bg-v1-card-soft"
              >
                링크 복사
              </button>
            </div>
            </div>
          </div>
        </div>
      </Container>

      {/* 알림(2초) */}
      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-full bg-ink/90 text-white text-[14px] px-4 py-2">
          {toast}
        </div>
      )}
    </>
  );
}
