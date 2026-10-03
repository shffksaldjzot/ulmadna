// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 "폼 상태 → 서버 요청" 변환(순수 함수)
//
// 'use client'가 없어 화면 훅(useTileCalc)과 공유 결과 화면(result/page.tsx, 서버 컴포넌트)이
// 같은 함수를 쓴다 — 계산기에서 본 금액과 공유 링크로 연 금액이 어긋나지 않게 하려는 것.
//
// 규칙:
//   · 안 고른 값(undefined)은 요청에 넣지 않는다 → 서버가 기본값으로 계산하고 assumed[]에 적는다
//   · 범위를 벗어난 치수·장 수는 요청에서 뺀다(서버가 거절할 값을 보내지 않는다) — 화면은 칸 아래 안내만 띄운다
//   · 이 파일에는 단가·계수가 없다(서버 전용)
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import type { TileFormState, TileRoomForm } from './tileQuery';
import {
  bathFloorCodeFor,
  findTileSize,
  isBathScope,
  TILE_BATH_MM_MAX,
  TILE_GROUT_MM_MAX,
  TILE_GROUT_MM_MIN,
  TILE_HEIGHT_MM_MAX,
  heightMinFor,
  TILE_PIECES_MAX,
  TILE_PIECES_MIN,
  TILE_PYEONG_MAX,
  TILE_PYEONG_MIN,
  TILE_ROOM_MM_MAX,
  TILE_ROOM_MM_MIN,
  TILE_ROOMS_MAX,
  type TileGrade,
  type TileMethod,
  type TilePattern,
  type TileRoomKind,
  type TileScope,
  type TileService,
  type TileSetting,
} from './tilePresets';

/** 서버 요청 모양(src/server/calc/tile.ts TileCalcInput과 같은 모양 — 화면은 서버 파일을 import하지 않아 옮겨 적음) */
export interface TileCalcRequest {
  mode: 'simple' | 'precise';
  scope?: TileScope;
  method?: TileMethod;
  service?: TileService;
  pyeong?: number;
  pattern?: TilePattern;
  grade?: TileGrade;
  groutMm?: number;
  setting?: TileSetting;
  rooms?: {
    kind: TileRoomKind;
    name?: string;
    widthMm?: number;
    depthMm?: number;
    heightMm?: number;
    doors?: number;
    windows?: number;
    tub?: boolean;
  }[];
  wallTile?: { widthMm: number; lengthMm: number; piecesPerBox?: number };
  floorTile?: { widthMm: number; lengthMm: number; piecesPerBox?: number };
}

/** 값이 범위 안의 유한 숫자인지 */
function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/** 실 종류별 가로·세로 상한(욕실은 4m까지 안내, 나머지는 10m) */
export function roomWidthMax(kind: TileRoomKind): number {
  return kind === 'bath' ? TILE_BATH_MM_MAX : TILE_ROOM_MM_MAX;
}

/** 실 종류별로 채워야 하는 치수 칸 */
export function roomFields(kind: TileRoomKind): ('widthMm' | 'depthMm' | 'heightMm')[] {
  if (kind === 'bath') return ['widthMm', 'depthMm', 'heightMm'];
  if (kind === 'floor') return ['widthMm', 'depthMm'];
  return ['widthMm', 'heightMm'];
}

/** 치수 칸 하나가 범위 안인지 */
export function roomFieldOk(kind: TileRoomKind, field: 'widthMm' | 'depthMm' | 'heightMm', v: unknown): boolean {
  if (field === 'heightMm') return inRange(v, heightMinFor(kind), TILE_HEIGHT_MM_MAX);
  return inRange(v, TILE_ROOM_MM_MIN, roomWidthMax(kind));
}

/** 실 카드 하나의 치수가 전부 채워졌고 범위 안인지 */
export function roomComplete(r: TileRoomForm): boolean {
  return roomFields(r.kind).every((f) => roomFieldOk(r.kind, f, r[f]));
}

/** 정확 모드 "실" 단계 완료 — 카드가 1장 이상이고 전부 치수가 다 찼을 때 */
export function roomsStepComplete(rooms: TileRoomForm[] | undefined): boolean {
  return !!rooms && rooms.length > 0 && rooms.every(roomComplete);
}

/**
 * 정확 모드 "실측 입력 중"인지 — 실 카드 중 치수가 덜 들어간 게 하나라도 있으면 true.
 * 완성된 실이 있으면 그것만으로 계산하고 "실측 입력 중" 표시를 붙이고, 하나도 없으면 금액을 숨긴다.
 */
export function preciseMeasuring(rooms: TileRoomForm[] | undefined): boolean {
  return (rooms ?? []).some((r) => !roomComplete(r));
}

/** 벽 타일이 필요한 실이 있는지(욕실·벽면) */
export function needsWallTile(rooms: TileRoomForm[] | undefined): boolean {
  return (rooms ?? []).some((r) => r.kind !== 'floor');
}
/** 바닥 타일이 필요한 실이 있는지(욕실·바닥면) */
export function needsFloorTile(rooms: TileRoomForm[] | undefined): boolean {
  return (rooms ?? []).some((r) => r.kind !== 'wall');
}

/** 규격 코드 + 박스당 장 수 → 요청 타일(장 수가 범위 밖이면 빼고 서버 관례값을 쓰게 한다) */
function tileOf(code: string | undefined, pieces?: number) {
  const s = findTileSize(code);
  if (!s) return undefined;
  return {
    widthMm: s.widthMm,
    lengthMm: s.lengthMm,
    ...(inRange(pieces, TILE_PIECES_MIN, TILE_PIECES_MAX) && Number.isInteger(pieces) ? { piecesPerBox: pieces } : {}),
  };
}

/**
 * 폼 상태 → 서버 요청. 계산할 게 아직 없으면 null.
 *   간단: 공간을 골라야 계산한다(첫 칩만 골라도 결과)
 *   정확: 실 카드가 1장 이상이면 계산한다(빈 치수는 서버가 추정값으로 채우고 가정 표시)
 */
export function buildTileRequest(form: TileFormState): TileCalcRequest | null {
  const common = {
    ...(form.method ? { method: form.method } : {}),
    ...(form.service ? { service: form.service } : {}),
    ...(form.grade ? { grade: form.grade } : {}),
  };
  if ((form.view ?? 'simple') === 'simple') {
    if (!form.scope) return null;
    const bath = isBathScope(form.scope);
    const req: TileCalcRequest = {
      mode: 'simple',
      scope: form.scope,
      ...common,
      ...(form.pattern ? { pattern: form.pattern } : {}),
      ...(!bath && inRange(form.pyeong, TILE_PYEONG_MIN, TILE_PYEONG_MAX) ? { pyeong: form.pyeong } : {}),
    };
    if (form.sizeCode && findTileSize(form.sizeCode)) {
      if (bath) {
        req.wallTile = tileOf(form.sizeCode);
        req.floorTile = tileOf(bathFloorCodeFor(form.sizeCode));
      } else {
        req.floorTile = tileOf(form.sizeCode);
      }
    }
    return req;
  }

  // 치수가 다 들어간 실만 보낸다(바닥재 계산기 정확 모드와 같은 규칙, 2026-10-03 검사관 지적) —
  // 하나도 없으면 계산하지 않는다(화면은 "실측 입력 중"으로 금액을 숨긴다)
  const allRooms = (form.rooms ?? []).slice(0, TILE_ROOMS_MAX);
  const rooms = allRooms.filter(roomComplete);
  if (rooms.length === 0) return null;
  return {
    mode: 'precise',
    ...common,
    ...(form.pattern ? { pattern: form.pattern } : {}),
    ...(inRange(form.groutMm, TILE_GROUT_MM_MIN, TILE_GROUT_MM_MAX) ? { groutMm: form.groutMm } : {}),
    ...(form.setting ? { setting: form.setting } : {}),
    rooms: rooms.map((r) => {
      const out: NonNullable<TileCalcRequest['rooms']>[number] = { kind: r.kind, name: r.name?.slice(0, 20) };
      for (const f of roomFields(r.kind)) if (roomFieldOk(r.kind, f, r[f])) out[f] = r[f];
      if (r.kind !== 'floor') out.doors = r.doors ?? (r.kind === 'bath' ? 1 : 0);
      if (r.kind !== 'floor' && r.windows) out.windows = r.windows;
      if (r.kind === 'bath' && r.tub) out.tub = true;
      return out;
    }),
    ...(needsWallTile(rooms) && form.wallSizeCode ? { wallTile: tileOf(form.wallSizeCode, form.wallPieces) } : {}),
    ...(needsFloorTile(rooms) && form.floorSizeCode ? { floorTile: tileOf(form.floorSizeCode, form.floorPieces) } : {}),
  };
}

/** 요청 → 캐시 열쇠 */
export function tileRequestKey(req: TileCalcRequest): string {
  return JSON.stringify(req);
}

// ── 모양 검사(세션 복원·공유 링크) ─────────────

const SCOPES = ['bath1', 'bath2', 'living', 'entrance', 'balcony'];
const METHODS = ['overlay', 'demolish', 'none'];
const SERVICES = ['pro', 'self'];
const PATTERNS = ['straight', 'offset', 'diagonal', 'herringbone'];
const GRADES = ['basic', 'mid', 'high'];
const SETTINGS = ['press', 'mortar'];
const KINDS = ['bath', 'floor', 'wall'];

/** 허용 목록 안의 글자면 그대로, 아니면 undefined */
function pick<T extends string>(v: unknown, allowed: string[]): T | undefined {
  return typeof v === 'string' && allowed.includes(v) ? (v as T) : undefined;
}
/** 유한 숫자면 그대로(지수 표기 같은 터무니없는 값은 범위로 자른다), 아니면 undefined */
function finite(v: unknown, max = 1e6): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;
}

/**
 * 밖에서 들어온 폼 상태(공유 링크·세션)를 안전한 모양으로 다시 만든다.
 * 모르는 값·틀린 형식은 버리고(undefined), 실 카드는 객체만 6장까지 남긴다 — 어떤 값이 와도 던지지 않는다.
 */
export function sanitizeTileForm(raw: unknown): TileFormState {
  const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const rooms: TileRoomForm[] = Array.isArray(f.rooms)
    ? f.rooms
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
        .slice(0, TILE_ROOMS_MAX)
        .map((r, i) => {
          const kind = pick<TileRoomKind>(r.kind, KINDS) ?? 'bath';
          return {
            kind,
            name: typeof r.name === 'string' ? r.name.slice(0, 20) : `${kind === 'bath' ? '욕실' : kind === 'floor' ? '바닥' : '벽'}${i + 1}`,
            widthMm: finite(r.widthMm, 100000),
            depthMm: finite(r.depthMm, 100000),
            heightMm: finite(r.heightMm, 100000),
            doors: finite(r.doors, 10),
            windows: finite(r.windows, 10),
            tub: r.tub === true ? true : undefined,
          };
        })
    : [{ kind: 'bath', name: '욕실1' }];
  return {
    view: f.view === 'precise' ? 'precise' : 'simple',
    scope: pick<TileScope>(f.scope, SCOPES),
    method: pick<TileMethod>(f.method, METHODS),
    sizeCode: typeof f.sizeCode === 'string' && findTileSize(f.sizeCode) ? f.sizeCode : undefined,
    service: pick<TileService>(f.service, SERVICES),
    pyeong: finite(f.pyeong, 1000),
    pattern: pick<TilePattern>(f.pattern, PATTERNS),
    grade: pick<TileGrade>(f.grade, GRADES),
    rooms,
    unit: f.unit === 'm' ? 'm' : 'mm',
    wallSizeCode: typeof f.wallSizeCode === 'string' && findTileSize(f.wallSizeCode) ? f.wallSizeCode : undefined,
    wallPieces: finite(f.wallPieces, 1000),
    floorSizeCode: typeof f.floorSizeCode === 'string' && findTileSize(f.floorSizeCode) ? f.floorSizeCode : undefined,
    floorPieces: finite(f.floorPieces, 1000),
    groutMm: finite(f.groutMm, 1000),
    setting: pick<TileSetting>(f.setting, SETTINGS),
  };
}
