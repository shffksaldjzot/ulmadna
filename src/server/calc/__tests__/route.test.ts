// ──────────────────────────────────────────────
// 도배 계산 API 라우트 테스트
// 입력 검증이 제대로 걸러 내는지, GET 이 막혀 있는지 확인한다.
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { POST, GET } from '@/app/api/calc/wallpaper/route';

/** 테스트용 POST 요청 하나를 만든다 */
function post(body: unknown) {
  return new Request('http://localhost/api/calc/wallpaper', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/calc/wallpaper', () => {
  it('평형 모드 기본 요청이 계산 결과를 돌려준다', async () => {
    const res = await POST(post({ mode: '평형', pyeong: 34, bay: 3, paperType: '실크', region: '서울' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.rolls).toBeGreaterThan(0);
    expect(json.cost.min).toBeGreaterThan(0);
    expect(json.submaterials.length).toBeGreaterThan(0);
  });

  it('베이를 안 넣어도 기본값(3베이)으로 계산된다', async () => {
    const res = await POST(post({ pyeong: 34 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.rolls).toBeGreaterThan(0);
  });

  it('평형 모드인데 평형이 없으면 400', async () => {
    const res = await POST(post({ mode: '평형' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('pyeong');
  });

  it('베이가 5면 400', async () => {
    const res = await POST(post({ pyeong: 34, bay: 5 }));
    expect(res.status).toBe(400);
  });

  it('실측 모드인데 방 목록이 없으면 400', async () => {
    const res = await POST(post({ mode: '실측' }));
    expect(res.status).toBe(400);
  });

  it('실측 모드 요청이 실제 로스로 계산된다', async () => {
    const res = await POST(
      post({
        mode: '실측',
        heightM: 2.3,
        rooms: [
          { name: '거실', widthM: 5, depthM: 4, doors: 1 },
          { name: '안방', widthM: 4, depthM: 3.5, doors: 1 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.lossMode).toBe('실제');
  });

  it('면적 모드 요청이 면적 꼬리표로 계산된다', async () => {
    const res = await POST(post({ mode: '면적', areas: { wallSqm: 92, ceilingSqm: 38 } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.lossMode).toBe('면적');
    expect(json.quantity.byRoom.length).toBe(1);
  });

  it('JSON 이 아니면 400', async () => {
    const req = new Request('http://localhost/api/calc/wallpaper', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/calc/wallpaper', () => {
  it('GET 은 405 로 막는다', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });
});
