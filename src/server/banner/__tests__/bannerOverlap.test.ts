// ─────────────────────────────────────────────────────────────
// 배너 글자 겹침·넘침 시험 — 실제로 그린 그림의 화소를 읽는다 (2026년 11월 24일)
//
// [왜]
//   폭 표로 자기를 재는 시험은 폭 표가 틀리면 같이 틀린다(검사 지적: 팝 320x50 에서 글자가 단추 밑으로 들어감,
//   팝 300x250 에서 영문 대문자 상호가 테두리에 닿음). 그래서 같은 배너를 두 벌 더 그린다.
//     - 글자 그림(textMask): 글자·로고만 자홍색, 나머지 투명
//     - 단추 그림(btnMask):  단추(테두리·그림자 포함)만 하늘색, 나머지 투명
//   두 그림에서 같은 화소가 둘 다 칠해져 있으면 글자가 단추와 겹친 것이고,
//   글자 화소가 가장자리 띠(테두리 + 여유) 안에 있으면 테두리에 닿은 것이다.
//   스타일 8종 x 규격 4종 x 입력 6묶음 = 192장(각 두 벌)을 모두 검사해 0건이어야 통과.
// ─────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { renderBanner, SIZE_INFO, type BannerInput } from '../bannerRender';
import { BANNER_STYLE_KEYS } from '@/lib/ads/bannerStyles';

/** 입력 묶음 6가지(검사서가 고른 것) */
const CASES: Record<string, Omit<BannerInput, 'style' | 'size'> & { logo?: Uint8Array | null }> = {
  short: { name: '한결', phone: '010-0234-5678', intro: '도배', headline: '정직하게' },
  longKo: { name: '주식회사 대한민국최고종합인테리어디자인건설', phone: '010-0234-5678', intro: '철거부터 마감까지 직접 시공하며 끝까지 책임지는 동네 인테리어 업체입니다', headline: '오래된 아파트 욕실 주방 베란다까지 한 번에 깔끔하게 바꿔 드립니다' },
  latinUpper: { name: 'WWWWWWWWWWWWWWWWWWWWWWWW', phone: '010-0234-5678', intro: 'W'.repeat(60), headline: 'W'.repeat(40) },
  symbols: { name: '84㎡ ★한결★', phone: '02-123-4567', intro: '<b>x</b> {{a}} &amp; "q" ~50%', headline: '30평 ~50% 할인! (주)한결 ①②' },
  noPhone: { name: '담담욕실', phone: null, intro: '담담하게, 꼼꼼하게', headline: '욕실 리모델링 전문 상담 환영' },
  logo: { name: '믿음올수리 강남점', phone: '010-0789-0123', intro: '견적부터 사후관리까지 한곳에서', headline: '믿을 수 있는 올수리 15년' },
};

/** 가장자리 띠(1배 px): 테두리가 있는 스타일은 그 두께 + 여유 */
function edgeBand(style: string, size: string): number {
  if (style === 'pop') return 5; // 바탕 테두리 3px
  if (style === 'wood') return 8; // 나무 틀 6px
  if (style === 'gold') return size === '320x50' ? 4 : 8; // 금색 두 줄 테두리 4·7px
  return 3;
}

/** 그림 → 알파(불투명도) 배열 */
async function alpha(png: Uint8Array): Promise<{ a: Uint8Array; w: number; h: number }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = new Uint8Array(info.width * info.height);
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3];
  return { a, w: info.width, h: info.height };
}

describe('글자 겹침·넘침(실제 그림 화소)', () => {
  it('스타일 8종 x 규격 4종 x 입력 6묶음에서 글자가 단추와 겹치거나 테두리에 닿지 않는다', async () => {
    const logo = new Uint8Array(await sharp({ create: { width: 240, height: 120, channels: 4, background: '#123a80' } }).png().toBuffer());
    const bad: string[] = [];
    for (const style of BANNER_STYLE_KEYS) {
      for (const size of Object.keys(SIZE_INFO) as (keyof typeof SIZE_INFO)[]) {
        for (const [k, c] of Object.entries(CASES)) {
          const input: BannerInput = { ...c, style, size, logo: k === 'logo' ? logo : null };
          const [tm, bm] = await Promise.all([renderBanner(input, undefined, 'textMask'), renderBanner(input, undefined, 'btnMask')]);
          const T = await alpha(tm);
          const B = await alpha(bm);
          const band = edgeBand(style, size) * 2; // 그림은 2배
          let overlap = 0;
          let edge = 0;
          for (let y = 0; y < T.h; y++) {
            for (let x = 0; x < T.w; x++) {
              const i = y * T.w + x;
              if (T.a[i] < 96) continue;
              if (B.a[i] >= 96) overlap++;
              if (x < band || y < band || x >= T.w - band || y >= T.h - band) edge++;
            }
          }
          if (overlap || edge) bad.push(`${style} ${size} ${k}: 단추 겹침 ${overlap}화소 · 가장자리 ${edge}화소`);
        }
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);
});
