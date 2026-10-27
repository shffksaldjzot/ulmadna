// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 — 입력값 모양·기본값·검사·주소 공유(순수 함수)
//
// 주소 공유: 입력값 전체를 짧은 JSON → base64url 글자로 바꿔 ?d= 에 담는다.
//   받는 쪽은 그대로 믿지 않고 sanitizeTileProForm 으로 숫자 범위·종류를 다시 검사한다
//   (밖에서 온 값이라 엉뚱한 값이 섞여 있어도 화면이 죽지 않게).
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

import { DEFAULT_SHAPE, MAX_SIDE_MM, clampMm, type FreeWall, type NotchCorner, type Opening, type ShapeInput } from '@/components/plan/geometry';
import type { TileOrigin, TilePattern } from './layout';

/** 바닥 / 벽 */
export type TileSurface = 'floor' | 'wall';
/** 접착 방식 — 압착시멘트 / 타일본드 / 떠붙임 몰탈 */
export type AdhesiveKind = 'cement' | 'bond' | 'mortar';

/** 입력값 전체 */
export interface TileProForm {
  surface: TileSurface;
  shape: ShapeInput;
  openings: Opening[];
  /** 벽 시공 높이(mm) — 벽일 때만 */
  wallH: number;
  /** 타일을 안 붙이는 벽 번호(0부터) — 벽일 때만 */
  wallsOff: number[];
  /** 타일 가로·세로(mm, 화면 기준 놓인 방향) */
  tileW: number;
  tileH: number;
  /** 줄눈 폭(mm) */
  joint: number;
  /** 타일 두께(mm) — 줄눈 깊이로 쓴다 */
  thick: number;
  /** 박스당 장 수 */
  perBox: number;
  pattern: TilePattern;
  origin: TileOrigin;
  /** 자투리 재사용 */
  reuse: boolean;
  /** 파손 여유(%) */
  spare: number;
  adhesive: AdhesiveKind;
}

/** 처음 상태 — 욕실 바닥 2100×1600, 문 1개, 300×600 */
export const DEFAULT_TILE_PRO: TileProForm = {
  surface: 'floor',
  shape: DEFAULT_SHAPE,
  openings: [{ kind: 'door', wall: 2, offset: 300, width: 800, height: 2100, sill: 0 }],
  wallH: 2300,
  wallsOff: [],
  tileW: 600,
  tileH: 300,
  joint: 2,
  thick: 9,
  perBox: 8,
  pattern: 'straight',
  origin: 'center',
  // 자투리 재사용은 기본 끔 — 주문이 모자라는 쪽이 남는 쪽보다 현장에서 더 곤란해서(켜면 넓이로만 맞춰 보는 낙관값)
  reuse: false,
  spare: 3,
  adhesive: 'cement',
};

/** 규격 칩 — 박스당 장 수는 소비자용 타일 계산기 표(tilePresets.TILE_SIZES)와 같은 값 */
export const PRO_TILE_SIZES = [
  { code: '300x300', w: 300, h: 300, perBox: 11, thick: 8 },
  { code: '300x600', w: 600, h: 300, perBox: 8, thick: 9 },
  { code: '600x600', w: 600, h: 600, perBox: 4, thick: 10 },
  { code: '600x1200', w: 1200, h: 600, perBox: 2, thick: 10 },
  { code: '800x800', w: 800, h: 800, perBox: 3, thick: 10 },
] as const;

/** 줄눈 폭 칩(mm) */
export const JOINT_CHIPS = [1.5, 2, 3, 5];

/** 패턴 칩 */
export const PATTERN_OPTIONS: { value: TilePattern; label: string }[] = [
  { value: 'straight', label: '일자' },
  { value: 'half', label: '지그재그 1/2' },
  { value: 'third', label: '지그재그 1/3' },
  { value: 'diagonal', label: '대각' },
];

/** 시작 기준 칩 */
export const ORIGIN_OPTIONS: { value: TileOrigin; label: string }[] = [
  { value: 'center', label: '가운데' },
  { value: 'corner', label: '모서리' }, // 바닥=왼쪽 위, 벽=왼쪽 아래(바닥선)
];

/** 접착 방식 칩 */
export const ADHESIVE_OPTIONS: { value: AdhesiveKind; label: string }[] = [
  { value: 'cement', label: '압착시멘트' },
  { value: 'bond', label: '타일본드' },
  { value: 'mortar', label: '떠붙임' },
];

/** 하나만 고르는 값 검사 도우미 */
function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** 0.5mm 단위 숫자 검사(줄눈 폭 1.5mm 같은 값 때문에) */
function clampHalf(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 2) / 2));
}

/** 방 모양 검사 */
function sanitizeShape(v: unknown): ShapeInput {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const d = DEFAULT_SHAPE;
  const walls: FreeWall[] = Array.isArray(o.walls)
    ? (o.walls as unknown[]).slice(0, 12).map((w) => {
        const ww = (w && typeof w === 'object' ? w : {}) as Record<string, unknown>;
        return { len: clampMm(ww.len, 100, MAX_SIDE_MM, 1000), turn: ww.turn === 'L' ? 'L' : 'R' };
      })
    : d.walls;
  return {
    kind: pick(o.kind, ['rect', 'L', 'free'] as const, d.kind),
    w: clampMm(o.w, 300, MAX_SIDE_MM, d.w),
    h: clampMm(o.h, 300, MAX_SIDE_MM, d.h),
    nw: clampMm(o.nw, 100, MAX_SIDE_MM, d.nw),
    nh: clampMm(o.nh, 100, MAX_SIDE_MM, d.nh),
    corner: pick<NotchCorner>(o.corner, ['tl', 'tr', 'br', 'bl'], d.corner),
    walls: walls.length >= 2 ? walls : d.walls,
  };
}

/** 밖에서 온 값(주소·저장)을 안전한 입력값으로 */
export function sanitizeTileProForm(v: unknown): TileProForm {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const d = DEFAULT_TILE_PRO;
  const openings: Opening[] = Array.isArray(o.openings)
    ? (o.openings as unknown[]).slice(0, 12).map((x) => {
        const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const kind = e.kind === 'window' ? 'window' : 'door';
        return {
          kind,
          wall: clampMm(e.wall, 0, 12, 0),
          offset: clampMm(e.offset, 0, MAX_SIDE_MM, 0),
          width: clampMm(e.width, 100, 5000, 800),
          height: clampMm(e.height, 100, 3000, kind === 'door' ? 2100 : 1200),
          sill: clampMm(e.sill, 0, 2500, kind === 'door' ? 0 : 900),
        };
      })
    : d.openings;
  return {
    surface: pick(o.surface, ['floor', 'wall'] as const, d.surface),
    shape: sanitizeShape(o.shape),
    openings,
    wallH: clampMm(o.wallH, 300, 6000, d.wallH),
    wallsOff: Array.isArray(o.wallsOff) ? (o.wallsOff as unknown[]).map((n) => clampMm(n, 0, 12, 0)).slice(0, 12) : [],
    tileW: clampMm(o.tileW, 50, 3200, d.tileW),
    tileH: clampMm(o.tileH, 50, 3200, d.tileH),
    joint: clampHalf(o.joint, 0, 20, d.joint),
    thick: clampHalf(o.thick, 3, 30, d.thick),
    perBox: clampMm(o.perBox, 1, 200, d.perBox),
    pattern: pick(o.pattern, ['straight', 'half', 'third', 'diagonal'] as const, d.pattern),
    origin: pick(o.origin, ['center', 'corner'] as const, d.origin),
    reuse: typeof o.reuse === 'boolean' ? o.reuse : d.reuse,
    spare: clampHalf(o.spare, 0, 30, d.spare),
    adhesive: pick(o.adhesive, ['cement', 'bond', 'mortar'] as const, d.adhesive),
  };
}

/** 입력값 → 주소용 글자(base64url) */
export function encodeTileProForm(form: TileProForm): string {
  const json = JSON.stringify(form);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 주소용 글자 → 입력값(깨졌으면 null) */
export function decodeTileProForm(s: string | null | undefined): TileProForm | null {
  if (!s || s.length > 6000) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return sanitizeTileProForm(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
