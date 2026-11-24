// ─────────────────────────────────────────────────────────────
// 배너 그리기 시험 — 크기·용량·글자 넘침 (2026년 11월 24일)
//   실제 글꼴(assets/banner-fonts)과 next/og 로 그려 본다. 운영 DB·보관함은 쓰지 않는다.
// ─────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { renderBanner, SIZE_INFO } from '../bannerRender';
import { cleanBannerText, cleanBannerTextReport, fitText, emphasize, lineWidth } from '../bannerText';
import metrics from '../../../../assets/banner-fonts/metrics.json';
import { BANNER_STYLE_KEYS } from '@/lib/ads/bannerStyles';
import { SLOT_INFO, checkBanner, type SlotKind } from '@/lib/ads/pricing';
import { autoSizesOf } from '@/lib/ads/autoBannerRules';

/** 아주 긴 입력(입력 한도 근처) */
const LONG = {
  name: '주식회사 대한민국최고종합인테리어리모델링센터 강남본점',
  headline: '오래된 아파트 욕실 주방 베란다까지 한 번에 깔끔하게 바꿔 드립니다',
  intro: '철거부터 마감까지 직접 시공하며 시공 뒤에도 끝까지 책임지는 동네 인테리어 업체입니다',
};

describe('글자 다루기', () => {
  it('한자·이모지는 지우고 한글·영문·기호는 남긴다', () => {
    expect(cleanBannerText('韓國 인테리어 😀 ㈜도토리 A/S·30%')).toBe('인테리어 ㈜도토리 A/S·30%');
  });
  it('풀어진 한글 자모도 완성형으로 합친다', () => {
    expect(cleanBannerText('한')).toBe('한');
  });
  it('강조: 숫자 낱말 → 없으면 마지막 낱말 → *표시* 우선', () => {
    expect(emphasize('창호 교체 30% 할인').find((s) => s.em)?.text).toBe('30%');
    expect(emphasize('벽지 한 장도 정직하게').find((s) => s.em)?.text).toBe('정직하게');
    expect(emphasize('타일, *깔끔하게* 끝냅니다').find((s) => s.em)?.text).toBe('깔끔하게');
    expect(emphasize('올수리').some((s) => s.em)).toBe(false);
  });
  it('긴 글은 줄 수 안에서 끝을 … 로 줄이고 폭을 넘지 않는다', () => {
    const base = { family: 'NotoKR', weight: 800, size: 17 };
    const f = fitText(emphasize(LONG.headline), { width: 160, maxLines: 2, base, minSize: 12 });
    expect(f.lines.length).toBeLessThanOrEqual(2);
    expect(f.cut).toBe(true);
    const last = f.lines[f.lines.length - 1];
    expect(last.map((s) => s.text).join('').endsWith('…')).toBe(true);
    for (const l of f.lines) expect(lineWidth(l, { ...base, size: f.size }, { ...base, size: f.size })).toBeLessThanOrEqual(160 + 0.01);
  });
});

describe('배너 그리기 — 8종 x 규격', () => {
  it('모든 스타일·규격이 2배 크기 PNG 로 나온다', async () => {
    for (const style of BANNER_STYLE_KEYS) {
      for (const size of Object.keys(SIZE_INFO) as (keyof typeof SIZE_INFO)[]) {
        const png = await renderBanner({ style, size, name: LONG.name, phone: '010-0234-5678', intro: LONG.intro, headline: LONG.headline, tag: '도배·바닥' });
        const m = await sharp(png).metadata();
        expect(m.format).toBe('png');
        expect([m.width, m.height]).toEqual([SIZE_INFO[size].w * 2, SIZE_INFO[size].h * 2]);
      }
    }
  }, 120_000);

  it('자리마다 그린 그림이 관리자 올리기와 같은 규격·용량 검사를 통과한다', async () => {
    const kinds: SlotKind[] = ['AD-H', 'AD-R', 'AD-P', 'AD-T', 'AD-F'];
    for (const kind of kinds) {
      for (const style of BANNER_STYLE_KEYS) {
        const png = await renderBanner({ style, size: autoSizesOf(kind).mobile, name: '한결도배', phone: null, intro: LONG.intro, headline: LONG.headline }, SLOT_INFO[kind].maxKB * 1024);
        expect(checkBanner(kind, png)).toBeNull();
      }
    }
  }, 120_000);

  it('모르는 스타일 열쇠는 클래식으로, 깨진 로고는 빼고 그린다', async () => {
    const png = await renderBanner({ style: '없는스타일', size: '320x50', name: '가', headline: '나', logo: new Uint8Array([1, 2, 3]) });
    const m = await sharp(png).metadata();
    expect([m.width, m.height]).toEqual([640, 100]);
  });
});

describe('바깥 요청 없음(2026년 11월 24일 검사 지적)', () => {
  it('그릴 수 있는 글자 전부를 8종 스타일로 그려도 바깥(구글 글꼴 서버 등) 요청이 0회', async () => {
    // 그릴 수 있는 글자 = 고딕 폭 표에 있는 글자 전부 + 대표 한글
    const all = Object.keys((metrics as Record<string, { chars: Record<string, number> }>)['NotoSansKR-400.ttf'].chars).join('') + '가힣뷁쀍똠';
    // 지워져야 할 글자(한자·이모지·글꼴에 없는 기호)도 섞어 넣는다
    const junk = '韓國😀👍🏻‗‛‱▬';
    const orig = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (u: unknown) => {
      calls.push(String(u));
      throw new Error('바깥 요청 금지(시험)');
    }) as typeof fetch;
    try {
      for (const style of BANNER_STYLE_KEYS) {
        for (let i = 0; i < all.length; i += 60) {
          const chunk = all.slice(i, i + 60);
          await renderBanner({ style, size: '728x90', name: chunk.slice(0, 12) + junk, headline: chunk.slice(12, 40) + junk, intro: chunk.slice(40) + junk, phone: null });
        }
      }
    } finally {
      globalThis.fetch = orig;
    }
    expect(calls).toEqual([]);
  }, 300_000);

  it('㎡·★·① 같은 흔한 기호는 그대로 남기고, 그릴 수 없는 글자는 빼면서 알려 준다', () => {
    const r = cleanBannerTextReport('84㎡ ★한결★ ①② 韓😀');
    expect(r.text).toBe('84㎡ ★한결★ ①②');
    expect(r.dropped).toEqual(['韓', '😀']);
  });
});
