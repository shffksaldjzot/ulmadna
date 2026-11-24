// ─────────────────────────────────────────────────────────────
// 견본 비교용 배너 뽑기 (2026년 11월 24일)
//
//   평소 시험(npm test)에서는 건너뛴다. 눈으로 견본과 비교할 때만 이렇게 돌린다:
//     BANNER_SAMPLES_OUT=<저장 폴더> npx vitest run src/server/banner/__tests__/samples.test.ts
//   스타일 8종 x 규격 4종을 견본과 같은 가상 업체 문구로 그리고, 긴 상호·긴 문구·로고 넣은 것도 같이 그린다.
//   저장 폴더에 compare.html(견본과 나란히 보기)을 만든다.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import sharp from 'sharp';
import { renderBanner, SIZE_INFO, type BannerSize } from '../bannerRender';
import { BANNER_STYLE_KEYS } from '@/lib/ads/bannerStyles';

const OUT = process.env.BANNER_SAMPLES_OUT;

/** 견본 스크립트(make-style-banners.mjs)의 STYLES 표와 같은 가상 업체 문구 */
const SAMPLE: Record<string, { tag: string; hl: string; sub: string; nm: string; phone: string }> = {
  classic: { tag: '도배·장판 전문', hl: '벽지 한 장도 *정직하게*', sub: '방 1개부터 전체 도배까지', nm: '한결도배', phone: '010-0234-5678' },
  modern: { tag: 'TILE', hl: '타일, *깔끔하게* 끝냅니다', sub: '시공 후 1년 무상 보수', nm: '올데이타일', phone: '010-0345-6789' },
  minimal: { tag: 'BATHROOM', hl: '욕실 리모델링', sub: '담담하게, 꼼꼼하게', nm: '담담욕실', phone: '010-0456-7890' },
  neon: { tag: '창호 교체', hl: '창호 교체 *30%* 할인', sub: '이번 달 한정 특가', nm: '번개창호', phone: '010-0567-8901' },
  wood: { tag: '주방·붙박이장', hl: '주방을 *따뜻하게*', sub: '맞춤 제작부터 설치까지', nm: '온기주방', phone: '010-0678-9012' },
  trust: { tag: '종합 인테리어', hl: '믿을 수 있는 *올수리*', sub: '견적부터 사후관리까지 한곳에서', nm: '믿음올수리', phone: '010-0789-0123' },
  pop: { tag: '바닥재 전문', hl: '바닥재 *싹* 바꿔드려요!', sub: '장판·마루·데코타일', nm: '쏙쏙바닥', phone: '010-0890-1234' },
  gold: { tag: '조명 · 전기 시공', hl: '공간에 *품격*을', sub: '프리미엄 조명 설계 · 전기 시공', nm: '더클래스전기', phone: '010-0901-2345' },
};

/** 넘침 시험용: 긴 상호·긴 문구(입력 한도 최대치 근처), 전화 없음 */
const LONG = {
  nm: '주식회사 대한민국최고종합인테리어리모델링센터 강남본점',
  hl: '오래된 아파트 욕실 주방 베란다까지 한 번에 깔끔하게 바꿔 드립니다 상담 환영',
  sub: '철거부터 마감까지 직접 시공하며 시공 뒤에도 끝까지 책임지는 동네 인테리어 업체입니다',
};

describe.skipIf(!OUT)('견본 비교용 배너 뽑기', () => {
  it('8종 x 4규격 + 긴 글 + 로고', async () => {
    const dir = OUT as string;
    fs.mkdirSync(dir, { recursive: true });
    // 시험용 로고: 남색 네모 안에 흰 동그라미(PNG)
    const logo = new Uint8Array(await sharp({ create: { width: 240, height: 120, channels: 4, background: '#123a80' } })
      .composite([{ input: Buffer.from('<svg width="240" height="120"><circle cx="60" cy="60" r="40" fill="#fff"/><rect x="120" y="40" width="90" height="40" fill="#7fb2ff"/></svg>') }])
      .png().toBuffer());
    const sizes = Object.keys(SIZE_INFO) as BannerSize[];
    const rows: string[] = [];
    for (const key of BANNER_STYLE_KEYS) {
      const s = SAMPLE[key];
      for (const size of sizes) {
        const t0 = Date.now();
        const a = await renderBanner({ style: key, size, name: s.nm, phone: s.phone, intro: s.sub, headline: s.hl, tag: s.tag });
        const ms = Date.now() - t0;
        const b = await renderBanner({ style: key, size, name: LONG.nm, phone: null, intro: LONG.sub, headline: LONG.hl, tag: null, logo });
        fs.writeFileSync(path.join(dir, `${key}-${size}.png`), a);
        fs.writeFileSync(path.join(dir, `${key}-${size}-long.png`), b);
        const w = SIZE_INFO[size].w;
        rows.push(`<tr><td>${key}<br>${size}<br><small>${Math.round(a.length / 1024)}KB · ${ms}ms</small></td>
<td><img src="file:///${path.resolve('public/sponsor/styles', key, size + '.png').split(path.sep).join('/')}" width="${w}"></td>
<td><img src="${key}-${size}.png" width="${w}"></td><td><img src="${key}-${size}-long.png" width="${w}"></td></tr>`);
      }
    }
    fs.writeFileSync(path.join(dir, 'compare.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>배너 견본 비교</title>
<style>body{font:14px sans-serif;background:#eee;margin:16px}table{border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ccc;vertical-align:top;background:#fff}th{text-align:left;padding:8px}</style></head>
<body><h1>배너 자동 제작 견본 비교 (2026년 11월 24일)</h1><p>왼쪽부터: 기존 견본(PC 크롬 캡처) · 서버 그리기(같은 문구) · 서버 그리기(긴 상호·긴 문구·로고·전화 없음)</p>
<table><tr><th>스타일</th><th>기존 견본</th><th>서버 그리기</th><th>긴 글·로고</th></tr>${rows.join('\n')}</table></body></html>`);
  }, 300_000);
});
