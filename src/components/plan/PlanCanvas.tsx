// ──────────────────────────────────────────────
// 공용 2D 도면 부품 — 도면 그림판(SVG)
//
// 타일·붙박이장·냉장고장 계산기가 같이 쓰는 "그림판"이다. 이 부품은 모양을 그리기만 하고
// 무엇을 깔지(타일·가구 칸)는 모른다. 깔 것은 children(그림 그리는 함수)으로 받아
// 방 모양 안쪽에만 보이게 잘라서(clipPath) 그린다 — 이것이 "플러그인" 자리다.
//
// 그리는 것:
//   - 바깥 모양(방 평면 또는 벽 전개도 사각형)과 구멍(벽 전개도의 문·창)
//   - 평면 위 문(여닫이 호)·창(겹선) 표시
//   - 치수선(벽마다 길이 mm) — 벽 바깥에 띄워 그린다
//   - 벽 번호 동그라미(누르면 그 벽을 고른다 — 벽 전개도 보기에서 씀)
//
// 손가락 조작(휴대폰이 주 기기):
//   - 확대/축소: 두 손가락 벌리기·오므리기, 또는 +/− 단추(손가락 정밀도가 낮아 단추를 꼭 둔다)
//   - 이동: 확대한 상태에서만 한 손가락으로 끌기. 확대 전에는 화면 세로 스크롤을 막지 않는다
//     (그림 위에서 쓸어 내려도 페이지가 내려가야 해서 — 안 그러면 그림판에 갇힌다)
//   - PC: Ctrl+휠 확대, 끌어서 이동
//   - "맞춤" 단추: 처음 크기로
//
// PNG 저장은 exportPng.ts 가 이 SVG 를 복제해서 만든다. 그래서 색은 class 가 아니라
// fill/stroke 속성에 직접 적는다(복제한 SVG 는 페이지 CSS 를 못 읽으니까).
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { bbox, outwardNormal, rectToPts, signedArea, toPath, wallOf, fitOpening, type Opening, type Pt, type Rect } from './geometry';

/** 도면 색 — SVG 속성에 직접 쓰므로 여기 모아 둔다(globals.css 토큰과 같은 값) */
export const PLAN_COLORS = {
  wall: '#2A2018', // 벽선 — --ink
  dim: '#6B5D4F', // 치수선·글자 — --ink-2
  accent: '#C0613A', // 고른 벽·강조 — --accent
  hole: '#FFFFFF', // 구멍(문·창) 바탕
  holeLine: '#A79C90', // 구멍 표시선
  grid: '#EFE7DC', // 바탕 격자
  bg: '#FFFFFF',
};

/** 보기 창(viewBox) — mm 단위 */
interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 플러그인이 그림 그릴 때 받는 값 */
export interface PlanLayerCtx {
  /** 글자·선 굵기 기준 길이(mm) — 도면 크기에 맞춰 커진다 */
  unit: number;
}

export interface PlanCanvasProps {
  /** 바깥 모양(mm) */
  outline: Pt[];
  /** 빼는 구멍(벽 전개도의 문·창) */
  holes?: Rect[];
  /** 구멍 이름표(holes 와 같은 순서, 예: "문") */
  holeLabels?: string[];
  /** 평면 위 문·창 표시 */
  marks?: Opening[];
  /** 벽 번호 동그라미를 그릴지 */
  wallNumbers?: boolean;
  /** 강조할 벽(번호 동그라미를 진하게) */
  activeWall?: number;
  /** 벽 번호를 누르면 */
  onWallTap?: (i: number) => void;
  /** 흐리게 그릴 벽(예: 타일 안 붙이는 벽) */
  dimWalls?: number[];
  /** 치수선 — 'walls' 벽마다, 'box' 전체 가로·세로만 */
  dims?: 'walls' | 'box';
  /** 방 안쪽에 그릴 플러그인 그림(타일·가구 칸) — 방 모양으로 잘려 보인다 */
  children?: (ctx: PlanLayerCtx) => ReactNode;
  /** 그림 아래 표시용 접근성 이름 */
  ariaLabel: string;
  /** PNG 저장용으로 SVG 요소를 밖에서 잡을 때 */
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
}

/** 두 손가락 사이 거리 */
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function PlanCanvas({
  outline,
  holes = [],
  holeLabels = [],
  marks = [],
  wallNumbers = false,
  activeWall,
  onWallTap,
  dimWalls = [],
  dims = 'walls',
  children,
  ariaLabel,
  svgRef,
  className = '',
}: PlanCanvasProps) {
  const clipId = `plan-clip-${useId().replace(/:/g, '')}`;
  const box = useMemo(() => bbox(outline), [outline]);
  // 글자 크기 기준 — 도면 긴 변의 1/26 (작은 욕실도 큰 거실도 비슷한 비율로 보이게)
  const unit = Math.max(Math.max(box.w, box.h) / 26, 40);
  // 치수선·번호가 들어갈 여백
  const pad = unit * 3.6;
  // 처음(맞춤) 보기 창
  const fit: View = useMemo(
    () => ({ x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }),
    [box.x, box.y, box.w, box.h, pad],
  );
  const [view, setView] = useState<View>(fit);
  // 모양이 바뀌면 맞춤 보기로 돌아간다(치수를 바꿨는데 엉뚱한 곳을 보고 있지 않게)
  const fitKey = `${fit.x}|${fit.y}|${fit.w}|${fit.h}`;
  const [lastFitKey, setLastFitKey] = useState(fitKey);
  if (lastFitKey !== fitKey) {
    setLastFitKey(fitKey);
    setView(fit);
  }
  const zoomed = view.w < fit.w * 0.98;

  // ── 손가락·마우스 조작 ──
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; dist: number; mid: { x: number; y: number } } | null>(null);

  /** 화면 px → mm 배율 */
  const pxToMm = () => {
    const el = wrapRef.current;
    return el && el.clientWidth > 0 ? view.w / el.clientWidth : 1;
  };

  /** 보기 창을 가운데 기준 k 배 확대(k>1 이면 확대) */
  const zoomBy = (k: number, center?: { x: number; y: number }) => {
    setView((v) => {
      const nw = Math.min(Math.max(v.w / k, fit.w / 8), fit.w * 1.5);
      const ratio = nw / v.w;
      const cx = center ? center.x : v.x + v.w / 2;
      const cy = center ? center.y : v.y + v.h / 2;
      return { x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio, w: nw, h: v.h * ratio };
    });
  };

  // PC: Ctrl(또는 Cmd)+휠로 확대. 그냥 휠은 페이지 스크롤에 양보한다
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit.w]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = { view, dist: dist(pts[0], pts[1]), mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
    } else if (pts.length === 1) {
      gesture.current = { view, dist: 0, mid: pts[0] };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    const k = pxToMm();
    if (pts.length >= 2 && g.dist > 0) {
      // 두 손가락: 벌린 비율만큼 확대
      const d = dist(pts[0], pts[1]);
      const scale = g.dist / Math.max(d, 1);
      const nw = Math.min(Math.max(g.view.w * scale, fit.w / 8), fit.w * 1.5);
      const r = nw / g.view.w;
      const cx = g.view.x + g.view.w / 2;
      const cy = g.view.y + g.view.h / 2;
      setView({ x: cx - (g.view.w * r) / 2, y: cy - (g.view.h * r) / 2, w: nw, h: g.view.h * r });
    } else if (pts.length === 1 && (zoomed || e.pointerType === 'mouse')) {
      // 한 손가락(확대 상태)·마우스: 끈 만큼 이동
      const dx = (pts[0].x - g.mid.x) * k;
      const dy = (pts[0].y - g.mid.y) * k;
      setView({ ...g.view, x: g.view.x - dx, y: g.view.y - dy });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.values()];
    gesture.current = pts.length === 1 ? { view, dist: 0, mid: pts[0] } : null;
  };

  // ── 그림 재료 ──
  const cw = signedArea(outline) > 0;
  const holePath = holes.map((h) => toPath(rectToPts(h))).join(' ');
  const sw = unit * 0.09; // 얇은 선
  const wallW = unit * 0.16; // 벽선
  const fs = unit * 0.95; // 치수 글자(휴대폰 390px 에서 11px 안팎)

  /** 치수선 하나(점 a→b, 바깥 방향 n 으로 off 만큼 띄움) */
  const dimLine = (a: Pt, b: Pt, n: Pt, off: number, key: string, label?: string) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) return null;
    const p1 = { x: a.x + n.x * off, y: a.y + n.y * off };
    const p2 = { x: b.x + n.x * off, y: b.y + n.y * off };
    const mx = (p1.x + p2.x) / 2 + n.x * fs * 0.75;
    const my = (p1.y + p2.y) / 2 + n.y * fs * 0.75;
    let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    // 글자가 거꾸로 서지 않게 −90~90도로
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    const tick = unit * 0.35;
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    // 끝 표시는 건축 도면처럼 45도 빗금
    const slash = (p: Pt) => `M${p.x - (tx + n.x) * tick * 0.5} ${p.y - (ty + n.y) * tick * 0.5} L${p.x + (tx + n.x) * tick * 0.5} ${p.y + (ty + n.y) * tick * 0.5}`;
    return (
      <g key={key}>
        <line x1={a.x + n.x * off * 0.25} y1={a.y + n.y * off * 0.25} x2={p1.x + n.x * tick} y2={p1.y + n.y * tick} stroke={PLAN_COLORS.dim} strokeWidth={sw * 0.7} />
        <line x1={b.x + n.x * off * 0.25} y1={b.y + n.y * off * 0.25} x2={p2.x + n.x * tick} y2={p2.y + n.y * tick} stroke={PLAN_COLORS.dim} strokeWidth={sw * 0.7} />
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={PLAN_COLORS.dim} strokeWidth={sw} />
        <path d={`${slash(p1)} ${slash(p2)}`} stroke={PLAN_COLORS.dim} strokeWidth={sw * 1.4} />
        <text
          x={mx}
          y={my}
          fontSize={fs}
          fill={PLAN_COLORS.dim}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${ang} ${mx} ${my})`}
          fontFamily="Pretendard, -apple-system, sans-serif"
        >
          {label ?? Math.round(len).toLocaleString('ko-KR')}
        </text>
      </g>
    );
  };

  // 치수선 목록
  const dimEls: ReactNode[] = [];
  if (dims === 'walls') {
    outline.forEach((_, i) => {
      const { a, b } = wallOf(outline, i);
      dimEls.push(dimLine(a, b, outwardNormal(outline, i), unit * 1.2, `d${i}`));
    });
  } else {
    // 전체 가로(위)·세로(왼쪽)만
    dimEls.push(dimLine({ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: 0, y: -1 }, unit * 1.3, 'bw'));
    dimEls.push(dimLine({ x: box.x, y: box.y + box.h }, { x: box.x, y: box.y }, { x: -1, y: 0 }, unit * 1.3, 'bh'));
  }

  // 평면 위 문·창 표시
  const markEls = marks.map((m0, k) => {
    if (m0.wall >= outline.length) return null;
    const { a, b, len } = wallOf(outline, m0.wall);
    if (len < 1) return null;
    const m = fitOpening(m0, len);
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    const n = outwardNormal(outline, m0.wall);
    const p1 = { x: a.x + tx * m.offset, y: a.y + ty * m.offset };
    const p2 = { x: a.x + tx * (m.offset + m.width), y: a.y + ty * (m.offset + m.width) };
    const gap = <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={PLAN_COLORS.bg} strokeWidth={wallW * 1.6} />;
    if (m.kind === 'window') {
      const o = wallW * 0.9;
      return (
        <g key={`m${k}`}>
          {gap}
          <line x1={p1.x + n.x * o} y1={p1.y + n.y * o} x2={p2.x + n.x * o} y2={p2.y + n.y * o} stroke={PLAN_COLORS.wall} strokeWidth={sw} />
          <line x1={p1.x - n.x * o} y1={p1.y - n.y * o} x2={p2.x - n.x * o} y2={p2.y - n.y * o} stroke={PLAN_COLORS.wall} strokeWidth={sw} />
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={PLAN_COLORS.wall} strokeWidth={sw * 0.7} />
        </g>
      );
    }
    // 문 — p1 에 경첩, 방 안쪽으로 열리는 문짝 + 4분의 1 호
    const inX = -n.x;
    const inY = -n.y;
    const leaf = { x: p1.x + inX * m.width, y: p1.y + inY * m.width };
    // 호의 방향(시계/반시계)은 벽 진행 방향과 안쪽 방향의 외적으로 정한다
    const sweep = tx * inY - ty * inX > 0 ? 0 : 1;
    return (
      <g key={`m${k}`}>
        {gap}
        <line x1={p1.x} y1={p1.y} x2={leaf.x} y2={leaf.y} stroke={PLAN_COLORS.wall} strokeWidth={sw * 1.2} />
        <path d={`M${leaf.x} ${leaf.y} A${m.width} ${m.width} 0 0 ${sweep} ${p2.x} ${p2.y}`} fill="none" stroke={PLAN_COLORS.dim} strokeWidth={sw * 0.8} strokeDasharray={`${unit * 0.25} ${unit * 0.2}`} />
      </g>
    );
  });

  // 벽 번호 동그라미 — 벽 가운데에서 방 안쪽으로 조금
  const numEls = wallNumbers
    ? outline.map((_, i) => {
        const { a, b, len } = wallOf(outline, i);
        if (len < 1) return null;
        const n = outwardNormal(outline, i);
        const cx = (a.x + b.x) / 2 - n.x * unit * 1.1;
        const cy = (a.y + b.y) / 2 - n.y * unit * 1.1;
        const on = activeWall === i;
        const off = dimWalls.includes(i);
        return (
          <g
            key={`n${i}`}
            onClick={onWallTap ? () => onWallTap(i) : undefined}
            style={onWallTap ? { cursor: 'pointer' } : undefined}
            role={onWallTap ? 'button' : undefined}
            aria-label={onWallTap ? `벽 ${i + 1} 고르기` : undefined}
          >
            {/* 손가락으로 누르기 쉽게 보이는 원보다 넓은 투명 원 */}
            <circle cx={cx} cy={cy} r={unit * 1.1} fill="transparent" />
            <circle cx={cx} cy={cy} r={unit * 0.62} fill={on ? PLAN_COLORS.accent : PLAN_COLORS.bg} stroke={off ? PLAN_COLORS.holeLine : PLAN_COLORS.accent} strokeWidth={sw} />
            <text x={cx} y={cy} fontSize={unit * 0.66} fill={on ? '#FFFFFF' : off ? PLAN_COLORS.holeLine : PLAN_COLORS.accent} textAnchor="middle" dominantBaseline="central" fontWeight={700} fontFamily="Pretendard, -apple-system, sans-serif">
              {i + 1}
            </text>
          </g>
        );
      })
    : null;

  // 바탕 격자 — 1m 간격(전문가가 눈대중으로 크기를 읽게)
  const gridLines: ReactNode[] = [];
  const step = 1000;
  for (let x = Math.ceil(fit.x / step) * step; x <= fit.x + fit.w; x += step) {
    gridLines.push(<line key={`gx${x}`} x1={x} y1={fit.y} x2={x} y2={fit.y + fit.h} stroke={PLAN_COLORS.grid} strokeWidth={sw} />);
  }
  for (let y = Math.ceil(fit.y / step) * step; y <= fit.y + fit.h; y += step) {
    gridLines.push(<line key={`gy${y}`} x1={fit.x} y1={y} x2={fit.x + fit.w} y2={y} stroke={PLAN_COLORS.grid} strokeWidth={sw} />);
  }

  // 화면 비율 — 도면 모양에 맞추되 너무 길쭉해지지 않게 3:4 ~ 4:3 안으로
  const aspect = Math.min(Math.max(fit.w / fit.h, 0.75), 1.6);

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={wrapRef}
        className="w-full select-none"
        style={{ aspectRatio: String(aspect), touchAction: zoomed ? 'none' : 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onPointerUp(e)}
      >
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block"
          role="img"
          aria-label={ariaLabel}
          data-fit={`${fit.x} ${fit.y} ${fit.w} ${fit.h}`}
        >
          <defs>
            <clipPath id={clipId}>
              {/* 바깥 모양에서 구멍을 뺀 영역(evenodd) — 플러그인 그림은 이 안에만 보인다 */}
              <path d={`${toPath(cw ? outline : [...outline].reverse())} ${holePath}`} clipRule="evenodd" />
            </clipPath>
          </defs>
          <rect x={fit.x - fit.w} y={fit.y - fit.h} width={fit.w * 3} height={fit.h * 3} fill={PLAN_COLORS.bg} />
          {gridLines}
          <path d={toPath(outline)} fill="#FBF8F3" />
          {children && <g clipPath={`url(#${clipId})`}>{children({ unit })}</g>}
          {/* 구멍(문·창) — 흰 바탕 + X 표시 + 이름 */}
          {holes.map((h, i) => (
            <g key={`h${i}`}>
              <rect x={h.x} y={h.y} width={h.w} height={h.h} fill={PLAN_COLORS.hole} stroke={PLAN_COLORS.holeLine} strokeWidth={sw} />
              <path d={`M${h.x} ${h.y} L${h.x + h.w} ${h.y + h.h} M${h.x + h.w} ${h.y} L${h.x} ${h.y + h.h}`} stroke={PLAN_COLORS.grid} strokeWidth={sw} />
              {holeLabels[i] && (
                <text x={h.x + h.w / 2} y={h.y + h.h / 2} fontSize={fs} fill={PLAN_COLORS.dim} textAnchor="middle" dominantBaseline="central" fontFamily="Pretendard, -apple-system, sans-serif">
                  {holeLabels[i]}
                </text>
              )}
            </g>
          ))}
          {/* 벽선 — 흐리게 그릴 벽은 회색 */}
          {outline.map((_, i) => {
            const { a, b } = wallOf(outline, i);
            const off = dimWalls.includes(i);
            return <line key={`w${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={off ? PLAN_COLORS.holeLine : activeWall === i ? PLAN_COLORS.accent : PLAN_COLORS.wall} strokeWidth={wallW} strokeLinecap="square" />;
          })}
          {markEls}
          {dimEls}
          {numEls}
        </svg>
      </div>
      {/* 확대·축소·맞춤 단추 — 손가락 정밀도가 낮아 두 손가락 조작과 별도로 꼭 둔다.
          도면 위에 띄우면 치수 글자를 가려서 그림 아래 한 줄에 둔다 */}
      <div className="flex justify-end gap-1 px-2 pb-2" data-plan-ui>
        {[
          { label: '+', aria: '확대', on: () => zoomBy(1.4) },
          { label: '−', aria: '축소', on: () => zoomBy(1 / 1.4) },
          { label: '맞춤', aria: '처음 크기로', on: () => setView(fit) },
        ].map((b) => (
          <button
            key={b.aria}
            type="button"
            onClick={b.on}
            aria-label={b.aria}
            className="h-8 min-w-8 px-2 rounded-full bg-white border border-v1-line-3 text-[13px] text-ink-2 active:bg-v1-card-soft"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
