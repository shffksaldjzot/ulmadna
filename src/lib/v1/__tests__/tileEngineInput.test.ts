// ──────────────────────────────────────────────
// 타일 계산기 화면 → 서버 요청 변환 테스트(순수 함수)
//   1) 공간을 안 고르면 계산하지 않는다 / 첫 칩만 골라도 요청이 만들어진다
//   2) 욕실은 규격 칩 하나로 벽·바닥을 같이 보낸다(바닥은 관행 규격)
//   3) 범위 밖 치수·장 수는 요청에서 빠진다(서버가 거절할 값을 안 보낸다)
//   4) 공유 링크를 조작한 이상한 모양도 던지지 않고 안전한 모양으로 바뀐다
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { buildTileRequest, sanitizeTileForm, roomsStepComplete } from '../tileEngineInput';
import { encodeTileForm, decodeTileForm } from '../tileQuery';

describe('타일 요청 변환', () => {
  it('공간 전엔 null, 공간만 골라도 요청', () => {
    expect(buildTileRequest({ view: 'simple' })).toBeNull();
    expect(buildTileRequest({ view: 'simple', scope: 'bath1' })).toEqual({ mode: 'simple', scope: 'bath1' });
  });

  it('욕실 규격 칩 300×600 → 벽 300×600 · 바닥 300×300, 거실은 바닥만', () => {
    const b = buildTileRequest({ view: 'simple', scope: 'bath2', sizeCode: '300x600' });
    expect(b?.wallTile).toEqual({ widthMm: 300, lengthMm: 600 });
    expect(b?.floorTile).toEqual({ widthMm: 300, lengthMm: 300 });
    const l = buildTileRequest({ view: 'simple', scope: 'living', sizeCode: '600x1200', pyeong: 44 });
    expect(l?.wallTile).toBeUndefined();
    expect(l?.floorTile).toEqual({ widthMm: 600, lengthMm: 1200 });
    expect(l?.pyeong).toBe(44);
  });

  it('범위 밖 치수·장 수는 빼고 보낸다', () => {
    const r = buildTileRequest({
      view: 'precise',
      rooms: [{ kind: 'bath', name: '욕실1', widthMm: 1600, depthMm: 50000, heightMm: 2300 }],
      wallSizeCode: '300x600',
      wallPieces: 99,
    });
    expect(r?.rooms?.[0]).toEqual({ kind: 'bath', name: '욕실1', widthMm: 1600, heightMm: 2300, doors: 1 });
    expect(r?.wallTile).toEqual({ widthMm: 300, lengthMm: 600 });
    expect(roomsStepComplete([{ kind: 'bath', name: 'a', widthMm: 1600, depthMm: 2100, heightMm: 2300 }])).toBe(true);
    expect(roomsStepComplete([{ kind: 'floor', name: 'a', widthMm: 1600 }])).toBe(false);
  });

  it('조작된 공유 링크도 안전한 모양으로', () => {
    const bad = sanitizeTileForm({ view: 'precise', scope: 'kitchen', rooms: 'abc', pyeong: 1e22, sizeCode: 'zzz' });
    expect(bad.scope).toBeUndefined();
    expect(bad.pyeong).toBeUndefined();
    expect(bad.sizeCode).toBeUndefined();
    expect(Array.isArray(bad.rooms)).toBe(true);
    expect(sanitizeTileForm([null]).view).toBe('simple');
    const rooms = sanitizeTileForm({ rooms: [null, 3, { kind: 'wall', widthMm: 2000 }] }).rooms;
    expect(rooms).toHaveLength(1);
    expect(rooms?.[0].kind).toBe('wall');
    // 인코딩 왕복
    const f = { view: 'simple' as const, scope: 'entrance' as const, method: 'overlay' as const };
    expect(decodeTileForm(encodeTileForm(f))).toEqual(f);
  });
});
