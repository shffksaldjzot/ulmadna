// ──────────────────────────────────────────────
// 타일 계산기 화면 → 서버 요청 변환 테스트(순수 함수)
//   1) 공간을 안 고르면 계산하지 않는다 / 첫 칩만 골라도 요청이 만들어진다
//   2) 욕실은 규격 칩 하나로 벽·바닥을 같이 보낸다(바닥은 관행 규격), 주방 벽은 벽만
//   3) 종류와 안 맞는 규격·면에 못 쓰는 종류는 보내지 않는다
//   4) 정확 모드: 공간만 골라도 기본 치수로 즉답(dimsAssumed), 범위 밖 치수(0·큰 값)도 기본 치수로
//   5) 시공 조건은 고른 것만, 면에 뜻 없는 조건(벽의 난방·바닥의 코너비드)은 빠진다
//   6) 공유 링크를 조작한 이상한 모양도 던지지 않고 안전한 모양으로, 옛 실 카드 링크는 새 모양으로
// 작성일: 2026년 10월 03일
// 개편(공간 하나 + 치수·종류·공법·시공 조건): 2026년 10월 08일
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { buildTileRequest, buildTileRequestFull, sanitizeTileForm, dimsComplete } from '../tileEngineInput';
import { encodeTileForm, decodeTileForm } from '../tileQuery';

describe('타일 요청 변환', () => {
  it('공간 전엔 null, 공간만 골라도 요청(중급 기본 타일)', () => {
    expect(buildTileRequest({ view: 'simple' })).toBeNull();
    expect(buildTileRequest({ view: 'simple', scope: 'bath1' })).toMatchObject({ mode: 'simple', scope: 'bath1', tileKind: 'earthenware', wallTile: { widthMm: 300, lengthMm: 600 } });
    expect(buildTileRequest({ view: 'precise' })).toBeNull();
  });

  it('간단 모드 — 등급별 기본 타일(욕실은 벽 규격에 바닥이 따라감), 거실은 바닥만, 주방은 벽만', () => {
    const b = buildTileRequest({ view: 'simple', scope: 'bath2', grade: 'basic' });
    expect(b?.wallTile).toEqual({ widthMm: 300, lengthMm: 300 });
    expect(b?.floorTile).toEqual({ widthMm: 300, lengthMm: 300 });
    expect(b?.grade).toBe('basic');
    const l = buildTileRequest({ view: 'simple', scope: 'living', grade: 'high', pyeong: 44 });
    expect(l?.wallTile).toBeUndefined();
    expect(l?.floorTile).toEqual({ widthMm: 800, lengthMm: 800 });
    expect(l?.pyeong).toBe(44);
    const k = buildTileRequest({ view: 'simple', scope: 'kitchen' });
    expect(k?.wallTile).toEqual({ widthMm: 300, lengthMm: 600 });
    expect(k?.floorTile).toBeUndefined();
  });

  it('간단 모드 — 욕실 1칸 바닥만/벽만은 욕실 바닥·벽 요청으로 바뀐다, 맞지 않는 범위는 무시', () => {
    const f = buildTileRequestFull({ view: 'simple', scope: 'bath1', range: 'floor', grade: 'mid' });
    expect(f?.request.space).toBe('bathFloor');
    expect(f?.request.tileKind).toBe('stoneware');
    expect(f?.dimsAssumed).toBe(false);
    const w = buildTileRequestFull({ view: 'simple', scope: 'bath1', range: 'wall' });
    expect(w?.request.space).toBe('bathWall');
    // 주방은 벽만뿐이라 바닥만을 보내도 소용없다
    expect(buildTileRequest({ view: 'simple', scope: 'kitchen', range: 'floor' })?.scope).toBe('kitchen');
  });

  it('정확 모드 — 종류와 안 맞는 규격, 바닥의 도기질은 보내지 않는다', () => {
    const r = buildTileRequest({ view: 'precise', space: 'bathWall', tileKind: 'earthenware', sizeCode: '600x1200' });
    expect(r?.tileKind).toBe('earthenware');
    expect(r?.wallTile).toBeUndefined();
    const f = buildTileRequest({ view: 'precise', space: 'entrance', tileKind: 'earthenware', sizeCode: '300x300' });
    expect(f?.tileKind).toBeUndefined();
    expect(f?.floorTile).toBeUndefined();
  });

  it('정확 모드 — 공간만 고르면 기본 치수로 즉답, 0·큰 값·소수(m 환산)는 범위로 판정', () => {
    const a = buildTileRequestFull({ view: 'precise', space: 'bathWall' });
    expect(a?.dimsAssumed).toBe(true);
    expect(a?.request.dims).toEqual({ widthMm: 1600, depthMm: 2100, heightMm: 2300, doors: 1 });
    // 0은 범위 밖 → 기본 치수
    expect(buildTileRequestFull({ view: 'precise', space: 'entrance', widthMm: 0, depthMm: 1500 })?.dimsAssumed).toBe(true);
    // 아주 큰 값도 범위 밖
    expect(dimsComplete({ view: 'precise', space: 'livingFloor', widthMm: 99999, depthMm: 3000 })).toBe(false);
    // 1.25m(=1250mm) 같은 소수 입력은 정상
    const ok = buildTileRequestFull({ view: 'precise', space: 'entrance', widthMm: 1250, depthMm: 1500, setting: 'mortar', sizeCode: '600x600', tileKind: 'porcelain' });
    expect(ok?.dimsAssumed).toBe(false);
    expect(ok?.request).toMatchObject({ mode: 'precise', space: 'entrance', dims: { widthMm: 1250, depthMm: 1500 }, setting: 'mortar', floorTile: { widthMm: 600, lengthMm: 600 } });
    // 주방 벽은 높이 600 허용, 창 빼기
    const kw = buildTileRequestFull({ view: 'precise', space: 'kitchenWall', widthMm: 2400, heightMm: 600, windows: 1 });
    expect(kw?.dimsAssumed).toBe(false);
    expect(kw?.request.dims).toEqual({ widthMm: 2400, heightMm: 600, windows: 1 });
  });

  it('시공 조건 — 고른 것만, 벽의 난방·바닥의 코너비드는 빠진다', () => {
    const w = buildTileRequest({ view: 'precise', space: 'bathWall', heated: true, cornerBead: false, waterproof: false, groutType: 'epoxy', groutMm: 3 });
    expect(w?.heated).toBeUndefined();
    expect(w?.cornerBead).toBe(false);
    expect(w?.waterproof).toBe(false);
    expect(w?.groutType).toBe('epoxy');
    expect(w?.groutMm).toBe(3);
    const f = buildTileRequest({ view: 'precise', space: 'livingFloor', heated: true, cornerBead: true });
    expect(f?.heated).toBe(true);
    expect(f?.cornerBead).toBeUndefined();
  });

  it('조작된 공유 링크도 안전한 모양으로, 옛 실 카드 링크는 첫 실을 새 모양으로', () => {
    const bad = sanitizeTileForm({ view: 'precise', scope: 'garage', space: 'roof', pyeong: 1e22, sizeCode: 'zzz', tileKind: 'marble', waterproof: 'yes' });
    expect(bad.scope).toBeUndefined();
    expect(bad.space).toBeUndefined();
    expect(bad.pyeong).toBeUndefined();
    expect(bad.sizeCode).toBeUndefined();
    expect(bad.tileKind).toBeUndefined();
    expect(bad.waterproof).toBeUndefined();
    expect(sanitizeTileForm([null]).view).toBe('simple');
    const legacy = sanitizeTileForm({ view: 'precise', rooms: [{ kind: 'bath', widthMm: 1700, depthMm: 2400, heightMm: 2300, tub: true }], wallSizeCode: '300x600' });
    expect(legacy).toMatchObject({ space: 'bathWall', widthMm: 1700, depthMm: 2400, heightMm: 2300, tub: true, sizeCode: '300x600' });
    expect(sanitizeTileForm({ view: 'precise', rooms: [{ kind: 'floor', widthMm: 2000, depthMm: 3000 }] }).space).toBe('livingFloor');
    // 인코딩 왕복
    const f = { view: 'simple' as const, scope: 'entrance' as const, method: 'overlay' as const };
    expect(decodeTileForm(encodeTileForm(f))).toEqual(f);
  });
});
