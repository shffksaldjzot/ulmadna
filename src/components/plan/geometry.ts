// ──────────────────────────────────────────────
// 공용 2D 도면 부품 — 도형 계산(순수 함수, 화면 없음)
//
// 이 파일은 "방 모양"을 숫자로 다루는 바닥 공사다. 타일·붙박이장·냉장고장 계산기가 같이 쓴다.
//
// 좌표 약속(모든 도면 공통):
//   - 단위는 mm(밀리미터). 화면 픽셀이 아니다.
//   - 화면과 똑같이 x는 오른쪽으로, y는 아래쪽으로 커진다(SVG 좌표와 같다).
//   - 방(Room)은 꼭짓점 목록이다. 꼭짓점 i → i+1 을 잇는 선이 "벽 i+1"(사람에게 보이는 번호는 1부터).
//   - 문·창(Opening)은 "몇 번 벽의, 벽 시작점에서 몇 mm 떨어진 곳에, 폭 몇 mm" 로 적는다.
//     손가락으로 끌어다 놓기보다 숫자로 넣는 게 휴대폰에서 훨씬 정확해서 이렇게 정했다.
//
// 방 모양 만드는 법 3가지(입력 방식):
//   1) 사각형 — 가로·세로만
//   2) ㄱ자   — 전체 가로·세로 + 따낸 모서리 가로·세로 + 따낸 자리(네 모서리 중 하나)
//   3) 자유형 — 벽 길이를 차례로 넣고, 벽마다 끝에서 오른쪽/왼쪽으로 꺾는다. 마지막 벽은 자동으로 닫는다.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

/** 점 하나(mm) */
export interface Pt {
  x: number;
  y: number;
}

/** 축에 나란한 사각형(mm) — 벽 전개도의 문·창 구멍 등 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 방 모양 입력 방식 */
export type ShapeKind = 'rect' | 'L' | 'free';

/** ㄱ자 방에서 따낸 모서리 자리 — 왼위·오위·오아래·왼아래 */
export type NotchCorner = 'tl' | 'tr' | 'br' | 'bl';

/** 자유형 벽 한 칸 — 길이(mm)와, 그 벽 끝에서 꺾는 방향 */
export interface FreeWall {
  len: number;
  /** R = 오른쪽(시계 방향)으로 꺾기, L = 왼쪽으로 꺾기 */
  turn: 'R' | 'L';
}

/** 방 모양 입력값 전체(주소 공유·저장에 그대로 담기는 값) */
export interface ShapeInput {
  kind: ShapeKind;
  /** 사각형·ㄱ자: 전체 가로(mm) */
  w: number;
  /** 사각형·ㄱ자: 전체 세로(mm) */
  h: number;
  /** ㄱ자: 따낸 부분 가로(mm) */
  nw: number;
  /** ㄱ자: 따낸 부분 세로(mm) */
  nh: number;
  /** ㄱ자: 따낸 자리 */
  corner: NotchCorner;
  /** 자유형: 벽 목록(마지막 닫는 벽은 빼고 넣는다) */
  walls: FreeWall[];
}

/** 문·창 종류 */
export type OpeningKind = 'door' | 'window';

/** 문·창 하나 */
export interface Opening {
  kind: OpeningKind;
  /** 벽 번호(0부터). 화면에는 +1 해서 보여 준다 */
  wall: number;
  /** 벽 시작 꼭짓점에서 문·창 왼쪽 끝까지 거리(mm) */
  offset: number;
  /** 폭(mm) */
  width: number;
  /** 높이(mm) — 벽 전개도에서 뺄 때 쓴다 */
  height: number;
  /** 바닥에서 아래턱까지 높이(mm) — 문은 0, 창은 보통 900 */
  sill: number;
}

/** 처음 보여 줄 방 모양 — 욕실에 흔한 2100×1600 */
export const DEFAULT_SHAPE: ShapeInput = {
  kind: 'rect',
  w: 2100,
  h: 1600,
  nw: 800,
  nh: 600,
  corner: 'tr',
  walls: [
    { len: 3000, turn: 'R' },
    { len: 1200, turn: 'L' },
    { len: 1000, turn: 'R' },
    { len: 1800, turn: 'R' },
    { len: 4000, turn: 'R' },
  ],
};

/** 숫자를 안전한 범위의 정수 mm로 다듬는다(엉뚱한 값·음수·소수 막기) */
export function clampMm(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 방 한 변의 최대 길이(mm) — 30m. 이보다 크면 타일 장 수가 너무 많아져 화면이 버벅인다 */
export const MAX_SIDE_MM = 30000;

/**
 * 입력값 → 방 꼭짓점 목록.
 * 사각형·ㄱ자는 왼쪽 위(0,0)에서 시작해 시계 방향(위 벽 → 오른쪽 벽 → …)으로 돈다.
 * 그래서 사각형의 벽 번호는 1=위, 2=오른쪽, 3=아래, 4=왼쪽이 된다.
 */
export function buildRoom(s: ShapeInput): Pt[] {
  const W = s.w;
  const H = s.h;
  if (s.kind === 'rect') {
    return [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H },
    ];
  }
  if (s.kind === 'L') {
    // 따낸 부분이 전체보다 크면 모양이 깨지므로 안쪽으로 줄인다(최소 100mm는 남긴다)
    const a = Math.min(Math.max(s.nw, 100), W - 100);
    const b = Math.min(Math.max(s.nh, 100), H - 100);
    switch (s.corner) {
      case 'tl': // 왼쪽 위를 따냄
        return [
          { x: a, y: 0 },
          { x: W, y: 0 },
          { x: W, y: H },
          { x: 0, y: H },
          { x: 0, y: b },
          { x: a, y: b },
        ];
      case 'tr': // 오른쪽 위를 따냄
        return [
          { x: 0, y: 0 },
          { x: W - a, y: 0 },
          { x: W - a, y: b },
          { x: W, y: b },
          { x: W, y: H },
          { x: 0, y: H },
        ];
      case 'br': // 오른쪽 아래를 따냄
        return [
          { x: 0, y: 0 },
          { x: W, y: 0 },
          { x: W, y: H - b },
          { x: W - a, y: H - b },
          { x: W - a, y: H },
          { x: 0, y: H },
        ];
      case 'bl': // 왼쪽 아래를 따냄
      default:
        return [
          { x: 0, y: 0 },
          { x: W, y: 0 },
          { x: W, y: H },
          { x: a, y: H },
          { x: a, y: H - b },
          { x: 0, y: H - b },
        ];
    }
  }
  // 자유형 — (0,0)에서 오른쪽을 보고 출발, 벽 길이만큼 가고 꺾기를 되풀이한다
  const pts: Pt[] = [{ x: 0, y: 0 }];
  // 진행 방향: 0=오른쪽, 1=아래, 2=왼쪽, 3=위 (화면 좌표에서 오른쪽으로 꺾기 = 시계 방향 = +1)
  let dir = 0;
  let cur = { x: 0, y: 0 };
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  s.walls.forEach((wall, i) => {
    cur = { x: cur.x + DX[dir] * wall.len, y: cur.y + DY[dir] * wall.len };
    pts.push(cur);
    // 마지막 벽의 꺾기는 의미가 없다(그 다음은 자동으로 닫는 벽)
    if (i < s.walls.length - 1) dir = (dir + (wall.turn === 'R' ? 1 : 3)) % 4;
  });
  // 마지막 점이 출발점과 같으면(이미 닫힘) 겹치는 점을 뺀다
  const last = pts[pts.length - 1];
  if (pts.length > 1 && Math.abs(last.x) < 1 && Math.abs(last.y) < 1) pts.pop();
  // 왼쪽 위가 (0,0) 근처에 오도록 옮긴다(보기 좋게)
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  return pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

/** 다각형 넓이(mm², 부호 있음) — 화면 좌표에서 시계 방향이면 양수 */
export function signedArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** 다각형 넓이(mm², 양수) */
export function polygonArea(pts: Pt[]): number {
  return Math.abs(signedArea(pts));
}

/** 벽 i 의 시작점·끝점·길이 */
export function wallOf(room: Pt[], i: number): { a: Pt; b: Pt; len: number } {
  const a = room[i];
  const b = room[(i + 1) % room.length];
  return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) };
}

/** 모든 벽 길이(mm) */
export function wallLengths(room: Pt[]): number[] {
  return room.map((_, i) => wallOf(room, i).len);
}

/** 둘레(mm) */
export function perimeter(room: Pt[]): number {
  return wallLengths(room).reduce((s, v) => s + v, 0);
}

/** 꼭짓점들을 감싸는 가장 작은 사각형 */
export function bbox(pts: Pt[]): Rect {
  if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * 벽 i 의 "방 바깥쪽" 방향 단위 벡터.
 * 치수선을 벽 바깥에 그리고, 문 여닫이 호를 방 안쪽에 그릴 때 쓴다.
 * 방이 시계 방향(화면 좌표에서 넓이 부호 +)이면 진행 방향의 왼쪽이 바깥이다.
 */
export function outwardNormal(room: Pt[], i: number): Pt {
  const { a, b, len } = wallOf(room, i);
  if (len === 0) return { x: 0, y: 0 };
  const dx = (b.x - a.x) / len;
  const dy = (b.y - a.y) / len;
  const cw = signedArea(room) > 0;
  // 진행 방향 (dx,dy) 의 왼쪽 법선 = (dy, -dx), 오른쪽 = (-dy, dx)
  return cw ? { x: dy, y: -dx } : { x: -dy, y: dx };
}

/** 문·창을 벽 길이 안으로 끼워 넣는다(벽 밖으로 삐져나가지 않게) */
export function fitOpening(o: Opening, wallLen: number): Opening {
  const width = Math.min(Math.max(o.width, 100), Math.max(wallLen, 100));
  const offset = Math.min(Math.max(o.offset, 0), Math.max(wallLen - width, 0));
  return { ...o, width, offset };
}

/**
 * 볼록 다각형(clip)으로 다른 다각형(subject)을 잘라 낸다 — 서덜랜드·호지먼 방식.
 * subject는 오목해도 넓이는 맞게 나온다(잘린 모양에 겹친 변이 생길 수 있지만 넓이 계산엔 영향 없음).
 * 타일 한 장(볼록 사각형)과 방이 겹치는 넓이를 구할 때 쓴다.
 */
export function clipPolygon(subject: Pt[], clip: Pt[]): Pt[] {
  let out = subject;
  const cw = signedArea(clip) > 0;
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const c1 = clip[i];
    const c2 = clip[(i + 1) % clip.length];
    // 점 p 가 자르는 선의 안쪽인지 — 시계 방향(넓이 +) clip 이면 외적 >= 0 쪽이 안쪽
    const inside = (p: Pt) => {
      const cross = (c2.x - c1.x) * (p.y - c1.y) - (c2.y - c1.y) * (p.x - c1.x);
      return cw ? cross >= -1e-9 : cross <= 1e-9;
    };
    // 선분 p→q 와 자르는 선이 만나는 점
    const cut = (p: Pt, q: Pt): Pt => {
      const a1 = q.y - p.y;
      const b1 = p.x - q.x;
      const a2 = c2.y - c1.y;
      const b2 = c1.x - c2.x;
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-12) return q;
      const e1 = a1 * p.x + b1 * p.y;
      const e2 = a2 * c1.x + b2 * c1.y;
      return { x: (b2 * e1 - b1 * e2) / det, y: (a1 * e2 - a2 * e1) / det };
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) out.push(cut(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(cut(prev, cur));
      }
    }
  }
  return out;
}

/** 사각형 → 꼭짓점 4개(화면 기준 시계 방향) */
export function rectToPts(r: Rect): Pt[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/** 점을 중심 c 기준으로 각도(도) 만큼 돌린다 */
export function rotatePt(p: Pt, c: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** 다각형 꼭짓점을 SVG path 글자로("M x y L … Z") */
export function toPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  return 'M' + pts.map((p) => `${round1(p.x)} ${round1(p.y)}`).join(' L') + ' Z';
}

/** 소수 첫째 자리까지만(SVG 글자 길이 줄이기) */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
