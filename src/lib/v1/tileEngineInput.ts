// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 "폼 상태 → 서버 요청" 변환(순수 함수)
//
// 'use client'가 없어 화면 훅(useTileCalc)과 공유 결과 화면(result/page.tsx, 서버 컴포넌트)이
// 같은 함수를 쓴다 — 계산기에서 본 금액과 공유 링크로 연 금액이 어긋나지 않게 하려는 것.
//
// 규칙:
//   · 안 고른 값(undefined)은 요청에 넣지 않는다 → 서버가 기본값으로 계산하고 assumed[]에 적는다
//   · 범위를 벗어난 치수는 보내지 않는다 — 정확 모드에서 치수가 덜·잘못 들어갔으면
//     공간 기본 치수로 즉답하고(dimsAssumed) 화면은 "기본 치수로 계산"을 붙인다
//   · 종류와 맞지 않는 규격(예: 도기질 600×1200)은 보내지 않는다
//   · 이 파일에는 단가·계수가 없다(서버 전용)
//
// 작성일: 2026년 10월 03일
// 개편(공간 하나 + 치수·종류·공법·시공 조건): 2026년 10월 08일
// ──────────────────────────────────────────────

import type { TileFormState } from './tileQuery';
import {
  bathFloorCodeFor,
  defaultDimPresetFor,
  findTileSize,
  isBathScope,
  kindOptionsFor,
  scopeSurface,
  sizeOptionsForKind,
  spaceDimFields,
  spaceDimRange,
  spaceSurface,
  TILE_GROUT_MM_MAX,
  TILE_GROUT_MM_MIN,
  TILE_PYEONG_MAX,
  TILE_PYEONG_MIN,
  TILE_SCOPES,
  TILE_SPACES,
  TILE_KINDS,
  TILE_SETTINGS,
  TILE_GROUT_TYPES,
  type TileGrade,
  type TileGroutType,
  type TileKind,
  type TileMethod,
  type TilePattern,
  type TileScope,
  type TileService,
  type TileSetting,
  type TileSpace,
  type TileSurface,
} from './tilePresets';

/** 서버 요청 모양(src/server/calc/tile.ts TileCalcInput과 같은 모양 — 화면은 서버 파일을 import하지 않아 옮겨 적음) */
export interface TileCalcRequest {
  mode: 'simple' | 'precise';
  scope?: TileScope;
  space?: TileSpace;
  dims?: { widthMm?: number; depthMm?: number; heightMm?: number; doors?: number; windows?: number; tub?: boolean };
  method?: TileMethod;
  service?: TileService;
  pyeong?: number;
  pattern?: TilePattern;
  grade?: TileGrade;
  tileKind?: TileKind;
  groutMm?: number;
  groutType?: TileGroutType;
  setting?: TileSetting;
  waterproof?: boolean;
  heated?: boolean;
  cornerBead?: boolean;
  silicone?: boolean;
  wallTile?: { widthMm: number; lengthMm: number };
  floorTile?: { widthMm: number; lengthMm: number };
}

/** 값이 범위 안의 유한 숫자인지 */
function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/** 치수 칸 하나가 범위 안인지 */
export function dimFieldOk(space: TileSpace, field: 'widthMm' | 'depthMm' | 'heightMm', v: unknown): boolean {
  const r = spaceDimRange(space, field);
  return inRange(v, r.min, r.max);
}

/** 정확 모드 치수가 다 들어갔고 범위 안인지 */
export function dimsComplete(form: TileFormState): boolean {
  if (!form.space) return false;
  const space = form.space;
  return spaceDimFields(space).every((f) => dimFieldOk(space, f, form[f]));
}

/** 지금 화면 모드의 붙이는 면(정확 모드는 공간을 골라야 안다) */
export function surfaceOf(form: TileFormState): TileSurface | null {
  if ((form.view ?? 'simple') === 'simple') return form.scope ? scopeSurface(form.scope) : null;
  return form.space ? spaceSurface(form.space) : null;
}

/** 종류가 이 면에 쓸 수 있는 것인지 */
export function kindAllowed(form: TileFormState): boolean {
  const s = surfaceOf(form);
  return !!form.tileKind && !!s && kindOptionsFor(s).includes(form.tileKind);
}

/** 규격이 고른 종류에 맞는지(종류를 아직 안 골랐으면 규격만 목록에 있으면 된다) */
export function sizeAllowed(form: TileFormState): boolean {
  if (!form.sizeCode || !findTileSize(form.sizeCode)) return false;
  return form.tileKind ? sizeOptionsForKind(form.tileKind).includes(form.sizeCode) : true;
}

/** 규격 코드 → 요청 타일 */
function tileOf(code: string | undefined) {
  const s = findTileSize(code);
  return s ? { widthMm: s.widthMm, lengthMm: s.lengthMm } : undefined;
}

/** 시공 조건(조정 칩) — 고른 것만 */
function conditionsOf(form: TileFormState, surface: TileSurface) {
  return {
    ...(form.method ? { method: form.method } : {}),
    ...(form.service ? { service: form.service } : {}),
    ...(form.grade ? { grade: form.grade } : {}),
    ...(form.pattern ? { pattern: form.pattern } : {}),
    ...(form.groutType ? { groutType: form.groutType } : {}),
    ...(inRange(form.groutMm, TILE_GROUT_MM_MIN, TILE_GROUT_MM_MAX) ? { groutMm: form.groutMm } : {}),
    ...(typeof form.waterproof === 'boolean' ? { waterproof: form.waterproof } : {}),
    // 난방은 바닥에만, 코너비드는 벽에만 뜻이 있다
    ...(typeof form.heated === 'boolean' && surface !== 'wall' ? { heated: form.heated } : {}),
    ...(typeof form.cornerBead === 'boolean' && surface !== 'floor' ? { cornerBead: form.cornerBead } : {}),
    ...(typeof form.silicone === 'boolean' ? { silicone: form.silicone } : {}),
  };
}

/** 요청 + 정확 모드에서 기본 치수로 즉답했는지 */
export interface BuiltTileRequest {
  request: TileCalcRequest;
  /** 정확 모드인데 치수가 덜 들어가 공간 기본 치수로 계산했는지 */
  dimsAssumed: boolean;
}

/**
 * 폼 상태 → 서버 요청. 계산할 게 아직 없으면 null.
 *   간단: 공간을 골라야 계산한다(첫 칩만 골라도 결과)
 *   정확: 공간을 골라야 계산한다 — 치수가 덜 들어가면 공간 기본 치수로 즉답(dimsAssumed)
 */
export function buildTileRequestFull(form: TileFormState): BuiltTileRequest | null {
  const kind = kindAllowed(form) ? form.tileKind : undefined;
  const size = sizeAllowed(form) && (!form.tileKind || kind) ? form.sizeCode : undefined;

  if ((form.view ?? 'simple') === 'simple') {
    if (!form.scope) return null;
    const surface = scopeSurface(form.scope);
    const bath = isBathScope(form.scope);
    const req: TileCalcRequest = {
      mode: 'simple',
      scope: form.scope,
      ...conditionsOf(form, surface),
      ...(kind ? { tileKind: kind } : {}),
      ...(!bath && inRange(form.pyeong, TILE_PYEONG_MIN, TILE_PYEONG_MAX) ? { pyeong: form.pyeong } : {}),
    };
    if (size) {
      if (bath) {
        req.wallTile = tileOf(size);
        req.floorTile = tileOf(bathFloorCodeFor(size));
      } else if (surface === 'wall') {
        req.wallTile = tileOf(size);
      } else {
        req.floorTile = tileOf(size);
      }
    }
    return { request: req, dimsAssumed: false };
  }

  if (!form.space) return null;
  const space = form.space;
  const surface = spaceSurface(space);
  const complete = dimsComplete(form);
  const preset = defaultDimPresetFor(space);
  const dims: NonNullable<TileCalcRequest['dims']> = {};
  for (const f of spaceDimFields(space)) dims[f] = complete ? form[f] : preset[f];
  if (space === 'bathWall') dims.doors = form.doors ?? 1;
  if ((space === 'bathWall' || space === 'kitchenWall') && form.windows) dims.windows = form.windows;
  if ((space === 'bathWall' || space === 'bathFloor') && form.tub) dims.tub = true;
  const req: TileCalcRequest = {
    mode: 'precise',
    space,
    dims,
    ...conditionsOf(form, surface),
    ...(kind ? { tileKind: kind } : {}),
    ...(form.setting ? { setting: form.setting } : {}),
    ...(size ? (surface === 'wall' ? { wallTile: tileOf(size) } : { floorTile: tileOf(size) }) : {}),
  };
  return { request: req, dimsAssumed: !complete };
}

/** 요청만 필요할 때 */
export function buildTileRequest(form: TileFormState): TileCalcRequest | null {
  return buildTileRequestFull(form)?.request ?? null;
}

/** 요청 → 캐시 열쇠 */
export function tileRequestKey(req: TileCalcRequest): string {
  return JSON.stringify(req);
}

// ── 모양 검사(세션 복원·공유 링크) ─────────────

const SCOPES = TILE_SCOPES.map((s) => s.value as string);
const SPACES = TILE_SPACES.map((s) => s.value as string);
const KINDS = TILE_KINDS.map((k) => k.value as string);
const SETTING_VALUES = TILE_SETTINGS.map((s) => s.value as string);
const GROUT_TYPES = TILE_GROUT_TYPES.map((g) => g.value as string);
const METHODS = ['overlay', 'demolish', 'none'];
const SERVICES = ['pro', 'self'];
const PATTERNS = ['straight', 'offset', 'diagonal', 'herringbone'];
const GRADES = ['basic', 'mid', 'high'];

/** 허용 목록 안의 글자면 그대로, 아니면 undefined */
function pick<T extends string>(v: unknown, allowed: string[]): T | undefined {
  return typeof v === 'string' && allowed.includes(v) ? (v as T) : undefined;
}
/** 유한 숫자면 그대로(터무니없는 값은 버린다), 아니면 undefined */
function finite(v: unknown, max = 1e6): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;
}
/** 참/거짓이면 그대로 */
function boolOf(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/**
 * 옛 공유 링크(정확 모드 rooms[]) → 새 모양: 첫 실 하나만 옮긴다.
 *   욕실 → 욕실 벽(가로·세로·높이 그대로), 바닥면 → 거실·방 바닥, 벽면 → 주방 벽
 */
function legacyRoomToSpace(f: Record<string, unknown>): Partial<TileFormState> {
  if (!Array.isArray(f.rooms) || f.rooms.length === 0) return {};
  const r = f.rooms[0];
  if (!r || typeof r !== 'object' || Array.isArray(r)) return {};
  const o = r as Record<string, unknown>;
  const space: TileSpace = o.kind === 'floor' ? 'livingFloor' : o.kind === 'wall' ? 'kitchenWall' : 'bathWall';
  const code = typeof f.wallSizeCode === 'string' && space !== 'livingFloor' ? f.wallSizeCode : typeof f.floorSizeCode === 'string' ? f.floorSizeCode : undefined;
  return {
    space,
    widthMm: finite(o.widthMm, 100000),
    depthMm: finite(o.depthMm, 100000),
    heightMm: finite(o.heightMm, 100000),
    doors: finite(o.doors, 10),
    windows: finite(o.windows, 10),
    tub: o.tub === true ? true : undefined,
    sizeCode: code && findTileSize(code) ? code : undefined,
  };
}

/**
 * 밖에서 들어온 폼 상태(공유 링크·세션)를 안전한 모양으로 다시 만든다.
 * 모르는 값·틀린 형식은 버리고(undefined) — 어떤 값이 와도 던지지 않는다.
 */
export function sanitizeTileForm(raw: unknown): TileFormState {
  const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const view = f.view === 'precise' ? 'precise' : 'simple';
  const legacy = view === 'precise' && !f.space ? legacyRoomToSpace(f) : {};
  return {
    view,
    scope: pick<TileScope>(f.scope, SCOPES),
    space: pick<TileSpace>(f.space, SPACES) ?? legacy.space,
    widthMm: finite(f.widthMm, 100000) ?? legacy.widthMm,
    depthMm: finite(f.depthMm, 100000) ?? legacy.depthMm,
    heightMm: finite(f.heightMm, 100000) ?? legacy.heightMm,
    doors: finite(f.doors, 10) ?? legacy.doors,
    windows: finite(f.windows, 10) ?? legacy.windows,
    tub: f.tub === true ? true : legacy.tub,
    unit: f.unit === 'm' ? 'm' : 'mm',
    tileKind: pick<TileKind>(f.tileKind, KINDS),
    sizeCode: typeof f.sizeCode === 'string' && findTileSize(f.sizeCode) ? f.sizeCode : legacy.sizeCode,
    setting: pick<TileSetting>(f.setting, SETTING_VALUES),
    service: pick<TileService>(f.service, SERVICES),
    method: pick<TileMethod>(f.method, METHODS),
    pyeong: finite(f.pyeong, 1000),
    pattern: pick<TilePattern>(f.pattern, PATTERNS),
    grade: pick<TileGrade>(f.grade, GRADES),
    groutType: pick<TileGroutType>(f.groutType, GROUT_TYPES),
    groutMm: finite(f.groutMm, 1000),
    waterproof: boolOf(f.waterproof),
    heated: boolOf(f.heated),
    cornerBead: boolOf(f.cornerBead),
    silicone: boolOf(f.silicone),
  };
}
