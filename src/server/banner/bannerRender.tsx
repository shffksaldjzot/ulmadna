// ─────────────────────────────────────────────────────────────
// 배너 그리기 (서버 전용) — 2026년 11월 24일
//
// [무슨 기능인가]
//   광고주가 고른 스타일(8종)과 입력(상호·전화·소개·강조 문구·로고)으로 배너 PNG 를 만든다.
//   제작 대행 주문이 결제되면 바로 이 함수로 배너를 그려 주문에 붙이고(bannerAuto.ts),
//   신청 화면의 미리 보기(/api/partner/banner-preview)도 같은 함수를 쓴다 — 미리 본 그림과 실제 배너가 같다.
//
// [어떻게 그리나 — 왜 이 방식인가]
//   Next.js 에 들어 있는 next/og(ImageResponse = satori + resvg)를 쓴다.
//   - 견본을 만든 PC 스크립트는 크롬(플레이라이트)으로 찍는데, 크롬은 Vercel 서버 함수에 싣기엔 너무 크고 느리다.
//   - next/og 는 Next.js 에 이미 들어 있어 새 꾸러미 설치가 없고, Vercel 노드 함수에서 그대로 돈다.
//   - 대신 CSS 일부(자동 줄 수 제한, 글자 넘침 처리 등)를 못 쓰므로 글자 폭은 bannerText.ts 가 직접 재서 줄을 나눈다.
//   그림은 견본처럼 2배 크기(예: 320x100 자리 → 640x200)로 만든다. 자리 규격 검사(checkBanner)는 1배·2배를 받는다.
//   용량이 자리 한도(SLOT_INFO.maxKB)를 넘으면 sharp 로 색 수를 줄여 다시 저장한다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import type { ReactElement, ReactNode } from 'react';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { cleanBannerText, ellipsizeLine, emphasize, familyStack, fitText, textWidth, type Line, type TextFont } from './bannerText';
import { fontsFor } from './bannerFonts';
import { themeFamilies, themeOf, type St, type TextLook, type Theme, type Z } from './bannerThemes';
import type { BannerSize } from '@/lib/ads/autoBannerRules';

/** 그림 배율(견본과 같은 2배) */
const S = 2;

/** 배너 규격(파일 이름 = 1배 가로x세로) — 정의는 공용 규칙 파일에 */
export type { BannerSize };

/** 규격 → 구분 글자·1배 크기 */
export const SIZE_INFO: Record<BannerSize, { z: Z; w: number; h: number }> = {
  '320x100': { z: 'h', w: 320, h: 100 },
  '300x250': { z: 'r', w: 300, h: 250 },
  '320x50': { z: 'p', w: 320, h: 50 },
  '728x90': { z: 'w', w: 728, h: 90 },
};

/** 그리기 입력 */
export interface BannerInput {
  /** 스타일 열쇠(bannerStyles.ts). 모르는 값이면 클래식 */
  style: string;
  size: BannerSize;
  /** 상호 */
  name: string;
  /** 전화(없으면 단추에 "자세히 보기") */
  phone?: string | null;
  /** 소개 한 줄 */
  intro?: string;
  /** 강조 문구(큰 글자) */
  headline: string;
  /** 꼬리표(공정 이름 등, 없으면 안 그림) */
  tag?: string | null;
  /** 로고 그림(PNG/JPG 바이트, 없으면 안 그림) */
  logo?: Uint8Array | null;
}

/**
 * 그리기 방식(2026년 11월 24일, 겹침 검사용)
 *   normal   = 실제 배너
 *   textMask = 글자·로고만 자홍색(#ff00ff)으로, 나머지(바탕·장식·단추)는 투명 — 시험이 글자 화소 자리를 읽는다
 *   btnMask  = 단추(테두리·그림자 포함)만 하늘색(#00ffff)으로, 나머지는 투명 — 시험이 단추 화소 자리를 읽는다
 *   두 그림의 화소가 겹치면 글자가 단추 밑으로 들어간 것이다(src/server/banner/__tests__/bannerOverlap.test.ts).
 */
export type RenderMode = 'normal' | 'textMask' | 'btnMask';

/** 겹침 검사용 색 */
const MASK_TEXT = '#ff00ff';
const MASK_BTN = '#00ffff';
const CLEAR = 'rgba(0,0,0,0)';

/** 규격별 기본 글자 크기(1배 px) — 견본 스크립트 BASE_CSS 와 같은 값 */
const BASE = {
  h: { tag: 10, nm: 11, hl: 17, hlLh: 21, btn: 13, span: 9 },
  p: { tag: 0, nm: 12, hl: 12.5, hlLh: 16, btn: 12, span: 0 },
  r: { tag: 11, nm: 12, hl: 25, hlLh: 31, btn: 15, span: 12, sub: 13 },
  w: { tag: 11, nm: 13, hl: 21, hlLh: 26, btn: 17, span: 9, sub: 12 },
} as const;

/**
 * 글자 폭 여유 비율 — 폭 표로 잰 값과 실제 그림 사이의 작은 어긋남(대체 글꼴·글자 간격 반올림)을 덮는다.
 *   2026년 11월 24일 검사: 팝 320x50 에서 강조 문구 끝이 단추 밑으로 들어감 → 글자 칸을 이만큼 좁게 잡는다.
 */
const SAFE = 0.94;

/** 값이 없는(undefined) 칸을 지운다 — 그리기 도구는 빈 스타일 값을 만나면 멈춘다 */
function strip(o: St): St {
  const out: St = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

/** 겹침 검사용 테마: 글자·단추·바탕 색을 방식에 맞게 바꾼다(모양·크기는 그대로) */
function maskTheme(t: Theme, mode: RenderMode): Theme {
  if (mode === 'normal') return t;
  const txt = mode === 'textMask' ? MASK_TEXT : CLEAR;
  const recolor = <T extends TextLook>(l: T): T => ({ ...l, color: txt });
  const btnBox: St = { ...t.btn.box };
  if (mode === 'textMask') {
    // 단추는 투명(자리만 차지)
    btnBox.backgroundColor = CLEAR;
    btnBox.backgroundImage = undefined;
    if (typeof btnBox.border === 'string') btnBox.border = String(btnBox.border).replace(/(#[0-9a-f]{3,6}|rgba?\([^)]*\))$/i, CLEAR);
    btnBox.boxShadow = undefined;
  } else {
    // 단추를 한 색으로 칠한다(테두리·그림자도 같은 색 — 그 자리까지 단추로 본다)
    btnBox.backgroundColor = MASK_BTN;
    btnBox.backgroundImage = undefined;
    if (typeof btnBox.border === 'string') btnBox.border = String(btnBox.border).replace(/(#[0-9a-f]{3,6}|rgba?\([^)]*\))$/i, MASK_BTN);
    if (typeof btnBox.boxShadow === 'string') btnBox.boxShadow = String(btnBox.boxShadow).replace(/(#[0-9a-f]{3,6}|rgba?\([^)]*\))$/i, MASK_BTN);
  }
  return {
    ...t,
    root: strip({ ...t.root, backgroundColor: CLEAR, backgroundImage: undefined, backgroundSize: undefined, border: typeof t.root.border === 'string' ? String(t.root.border).replace(/#[0-9a-f]{3,6}$/i, CLEAR) : undefined }),
    decos: () => [],
    tag: { ...recolor(t.tag), pill: t.tag.pill ? { ...t.tag.pill, bg: CLEAR } : undefined },
    hl: { ...recolor(t.hl), shadow: undefined, em: { ...t.hl.em, color: txt, shadow: undefined, underline: t.hl.em.underline ? txt : undefined } },
    nm: recolor(t.nm),
    sub: recolor(t.sub),
    // 단추 안 글자는 단추의 일부라 글자 그림에서 뺀다(투명)
    btn: { ...t.btn, color: CLEAR, box: strip(btnBox) },
  };
}

/** 글자 스타일(satori)로 바꾸기 */
function look(l: TextLook, size: number, extra: St = {}): St {
  return {
    fontFamily: familyStack(l.family),
    fontWeight: l.weight,
    color: l.color,
    fontSize: size * S,
    letterSpacing: (l.spacing ?? 0) * size * S,
    ...(l.extra ?? {}),
    ...extra,
  };
}

/** 폭 재기용 글꼴 정보 */
function tf(l: TextLook, size: number): TextFont {
  return { family: l.family, weight: l.weight, size, spacing: l.spacing };
}

/** 한 줄짜리 글(넘치면 크기를 줄이고 그래도 넘치면 … ) — 폭은 여유(SAFE)를 둔 값 */
function oneLine(text: string, l: TextLook, size: number, minSize: number, width: number): { text: string; size: number } {
  const w = width * SAFE;
  const f = fitText([{ text, em: false }], { width: w, maxLines: 1, base: tf(l, size), minSize });
  if (!f.cut) return { text: f.lines[0]?.map((s) => s.text).join('') ?? '', size: f.size };
  // 가장 작게 해도 안 들어가면 낱말 단위로 끊지 않고 글 전체를 한 줄로 두고 끝만 … 로 줄인다
  // (낱말로 끊으면 "주식회사…" 처럼 앞 낱말만 남는다)
  const base = tf(l, f.size);
  const line = ellipsizeLine([{ text, em: false }], w, base, base);
  return { text: line.map((s) => s.text).join(''), size: f.size };
}

/** 여러 줄 강조 글(큰 문구) 맞추기만(그리지 않음) — 300x250 크기 고르기에 쓴다 */
function hlFit(t: Theme, z: Z, text: string, width: number, maxLines: number, minSize: number, fsStart?: number) {
  const ov = t.hl.size?.[z];
  const fs = fsStart ?? ov?.fs ?? BASE[z].hl;
  const ratio = (ov?.lh ?? BASE[z].hlLh) / (ov?.fs ?? BASE[z].hl);
  const emScale = ov?.emScale ?? t.hl.em.scale ?? 1;
  const emFamily = t.hl.em.family ?? t.hl.family;
  const f = fitText(emphasize(text), { width: width * SAFE, maxLines, base: tf(t.hl, fs), minSize, emScale, emFamily });
  // 강조 글자가 커지는 스타일(네온·팝)은 줄 높이도 그만큼 키워 위아래 줄이 겹치지 않게
  const lh = f.size * Math.max(ratio, emScale * 1.05);
  return { f, lh, emScale, emFamily };
}

/** 여러 줄 강조 글(큰 문구) 그리기 */
function hlBlock(t: Theme, z: Z, text: string, width: number, maxLines: number, minSize: number, center = false, fsStart?: number): { node: ReactNode; height: number; lines: number } {
  const { f, lh, emScale, emFamily } = hlFit(t, z, text, width, maxLines, minSize, fsStart);
  const lines = f.lines.map((line: Line, i: number) => (
    <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: center ? 'center' : 'flex-start', height: lh * S, whiteSpace: 'pre' }}>
      {line.map((s, j) => (
        <span
          key={j}
          style={{
            ...look(t.hl, s.em ? f.size * emScale : f.size),
            ...(s.em ? { color: t.hl.em.color, fontFamily: familyStack(emFamily) } : {}),
            ...(t.hl.shadow && !s.em ? { textShadow: t.hl.shadow } : {}),
            ...(s.em && t.hl.em.shadow ? { textShadow: t.hl.em.shadow } : {}),
            ...(s.em && t.hl.em.underline ? { borderBottom: `${1 * S}px solid ${t.hl.em.underline}` } : {}),
          }}
        >
          {s.text}
        </span>
      ))}
    </div>
  ));
  return { node: <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>{lines}</div>, height: lh * f.lines.length, lines: f.lines.length };
}

/** 꼬리표 그리기(없으면 null) */
function tagNode(t: Theme, size: number, text: string, maxWidth: number): { node: ReactNode; width: number } | null {
  if (!text) return null;
  const pill = t.tag.pill;
  const inner = maxWidth - (pill ? pill.padX * 2 : 0);
  const o = oneLine(text, t.tag, size, size * 0.8, inner);
  const w = textWidth(o.text, tf(t.tag, o.size)) + (pill ? pill.padX * 2 : 0);
  const box: St = pill
    ? { backgroundColor: pill.bg, borderRadius: pill.radius * S, padding: `${pill.padY * S}px ${pill.padX * S}px`, ...(pill.rotate ? { transform: `rotate(${pill.rotate}deg)` } : {}) }
    : {};
  return { node: <div style={{ display: 'flex', flexShrink: 0, whiteSpace: 'pre', ...box, ...look(t.tag, o.size) }}>{o.text}</div>, width: w };
}

/** 단추 그리기: 전화가 있으면 "전화하기 + 번호", 없으면 "자세히 보기 →". width = 테두리·그림자까지 포함한 차지 폭(1배) */
function btnNode(t: Theme, z: Z, phone: string | null, box: St, padX = 0): { node: ReactNode; width: number } {
  const b = BASE[z];
  const main = phone || (z === 'p' ? '자세히 보기' : '자세히 보기 →');
  const showSpan = !!phone && z !== 'p';
  const mainW = textWidth(main, tf(t.btn, b.btn));
  const spanW = showSpan ? textWidth('전화하기', tf(t.btn, b.span)) : 0;
  const content = z === 'r'
    ? (
      // 300x250 단추의 "전화하기"는 견본처럼 단추 글자와 같은 굵기·진하기(작게만)
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 * S }}>
        {showSpan && <span style={look(t.btn, b.span)}>전화하기</span>}
        <span style={look(t.btn, b.btn)}>{main}</span>
      </div>
    )
    : (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
        {showSpan && <span style={look(t.btn, b.span, { opacity: t.btn.spanOpacity ?? 0.85, fontWeight: 600 })}>전화하기</span>}
        <span style={look(t.btn, b.btn)}>{main}</span>
      </div>
    );
  // 폭이 정해진 단추(320x100·300x250)는 그 값, 나머지는 글자 폭 + 안쪽 여백. 여기에 테두리·그림자 폭을 더한다
  const width = (typeof box.width === 'number' ? box.width / S : Math.max(mainW, spanW) / SAFE + padX * 2) + (t.btnExtra ?? 0);
  return {
    node: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...t.btn.box, ...box }}>{content}</div>,
    width,
  };
}

/** 로고를 흰 받침 위 작은 그림으로(그림 상자 높이 h, 최대 폭 maxW, 1배 px). 실패하면 null */
async function logoNode(bytes: Uint8Array | null | undefined, h: number, maxW: number, mode: RenderMode): Promise<{ node: ReactNode; width: number } | null> {
  if (!bytes || !bytes.length) return null;
  try {
    const pad = 3;
    const img = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate();
    const out = await img
      .resize({ height: (h - pad * 2) * S, width: (maxW - pad * 2) * S, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });
    const w = out.info.width / S + pad * 2;
    const src = `data:image/png;base64,${out.data.toString('base64')}`;
    // 겹침 검사 그림에서는 로고 자리를 글자처럼 한 색 상자로(단추 그림에서는 투명)
    const plate = mode === 'normal' ? '#ffffff' : mode === 'textMask' ? MASK_TEXT : CLEAR;
    return {
      node: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: plate, borderRadius: 6 * S, padding: pad * S, height: h * S, width: w * S }}>
          {mode === 'normal' && (
            // eslint-disable-next-line @next/next/no-img-element -- 그림 파일을 만드는 그리기 도구(satori) 입력이라 next/image 를 쓸 수 없다
            <img src={src} width={out.info.width} height={out.info.height} alt="" />
          )}
        </div>
      ),
      width: w,
    };
  } catch {
    return null; // 깨진 로고는 빼고 그린다(배너 자체는 만든다)
  }
}

/** 배너 하나의 화면 구성(satori 입력) */
async function layout(input: BannerInput, mode: RenderMode): Promise<{ el: ReactElement; families: string[] }> {
  const { z, w: W, h: H } = SIZE_INFO[input.size];
  const t = maskTheme(themeOf(input.style, S), mode);
  const b = BASE[z];
  const name = cleanBannerText(input.name, 80) || '상호';
  const headline = cleanBannerText(input.headline, 60) || name;
  const intro = cleanBannerText(input.intro, 80);
  const tagText = cleanBannerText(input.tag, 20);
  const phone = cleanBannerText(input.phone, 20).replace(/[^\d-]/g, '') || null;
  const frame = t.frame ?? 0; // 바탕 테두리(팝): 안쪽 칸이 그만큼 좁다
  const padDef = { h: { l: 12, r: 12 }, p: { l: 8, r: 8 }, w: { l: 16, r: 16 }, r: { l: 16, r: 16, t: 16 } }[z];
  const pad = { ...padDef, ...(t.pad?.[z] ?? {}) } as { l: number; r: number; t?: number };
  const decos = t.decos(z).map((d, i) => <div key={`d${i}`} style={{ position: 'absolute', display: 'flex', ...d }} />);
  const inner = W - pad.l - pad.r - frame * 2;
  let body: ReactNode;

  if (z === 'h') {
    // 320x100: [로고] [꼬리표 / 상호 / 큰 문구 2줄] [단추 118x40]
    const gap = 10;
    const btn = btnNode(t, z, phone, { width: 118 * S, height: 40 * S });
    const logo = await logoNode(input.logo, 46, 64, mode);
    const colW = inner - btn.width - gap - (logo ? logo.width + gap : 0);
    const tag = tagNode(t, b.tag, tagText, colW);
    const nm = oneLine(name, t.nm, b.nm, 9, colW);
    const hl = hlBlock(t, z, headline, colW, 2, 12);
    body = (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', padding: `0 ${pad.r * S}px 0 ${pad.l * S}px`, gap: gap * S }}>
        {logo?.node}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 * S, alignItems: 'flex-start' }}>
          {tag?.node}
          <div style={{ display: 'flex', whiteSpace: 'pre', ...look(t.nm, nm.size) }}>{nm.text}</div>
          {hl.node}
        </div>
        {btn.node}
      </div>
    );
  } else if (z === 'p') {
    // 320x50: [로고] [상호(최대 92)] [큰 문구 한 줄] [단추(번호만)]
    const gap = 8;
    const btn = btnNode(t, z, phone, { height: 32 * S, padding: `0 ${10 * S}px` }, 10);
    const logo = await logoNode(input.logo, 34, 48, mode);
    const nm = oneLine(name, t.nm, b.nm, 9.5, 92);
    const nmW = textWidth(nm.text, tf(t.nm, nm.size));
    const hlW = inner - btn.width - nmW - gap * 2 - (logo ? logo.width + gap : 0);
    const hl = hlBlock(t, z, headline, Math.max(40, hlW), 1, 9.5);
    body = (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', padding: `0 ${pad.r * S}px 0 ${pad.l * S}px`, gap: gap * S }}>
        {logo?.node}
        <div style={{ display: 'flex', flexShrink: 0, whiteSpace: 'pre', ...look(t.nm, nm.size) }}>{nm.text}</div>
        <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>{hl.node}</div>
        {btn.node}
      </div>
    );
  } else if (z === 'w') {
    // 728x90: [로고] [꼬리표] [큰 문구 2줄 / 소개] [상호] [단추]
    const gap = 16;
    const btn = btnNode(t, z, phone, { height: 52 * S, padding: `0 ${20 * S}px` }, 20);
    const logo = await logoNode(input.logo, 52, 90, mode);
    const tag = tagNode(t, b.tag, tagText, 130);
    const nm = oneLine(name, t.nm, b.nm, 10, 150);
    const nmW = textWidth(nm.text, tf(t.nm, nm.size));
    const colW = inner - btn.width - nmW - gap * 2 - (tag ? tag.width + gap : 0) - (logo ? logo.width + gap : 0);
    const hl = hlBlock(t, z, headline, colW, 2, 13);
    const sub = intro ? oneLine(intro, t.sub, BASE.w.sub, 10, colW) : null;
    body = (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', padding: `0 ${pad.r * S}px 0 ${pad.l * S}px`, gap: gap * S }}>
        {logo?.node}
        {tag?.node}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
          {hl.node}
          {sub && <div style={{ display: 'flex', whiteSpace: 'pre', marginTop: 2 * S, ...look(t.sub, sub.size) }}>{sub.text}</div>}
        </div>
        <div style={{ display: 'flex', flexShrink: 0, whiteSpace: 'pre', ...look(t.nm, nm.size) }}>{nm.text}</div>
        {btn.node}
      </div>
    );
  } else {
    // 300x250: 위 줄[로고·꼬리표 | 상호] / 큰 문구(최대 3줄) / 소개(최대 2줄) / 단추(가로 전체)
    //   2026년 11월 24일: 견본의 체크 목록·뱃지가 없어 가운데가 비므로, 광고주가 준 글(큰 문구·소개)을
    //   남는 높이에 맞춰 크게 키워 채운다(없는 말을 지어 넣지 않음)
    const center = !!t.centerR;
    const padT = pad.t ?? 16;
    const btnH = 44;
    const btn = btnNode(t, z, phone, { height: btnH * S, width: inner * S });
    const logo = await logoNode(input.logo, 30, 90, mode);
    const tag = tagNode(t, b.tag, tagText, 150);
    const nmMax = center ? inner : inner - (tag ? tag.width + 8 : 0) - (logo ? logo.width + 8 : 0);
    const nm = oneLine(name, t.nm, b.nm, 9.5, Math.max(60, nmMax));
    // 위 줄 높이(1배): 상호 줄 · 로고 · 꼬리표 중 큰 것(가운데 맞춤이면 세로로 쌓임)
    const nmH = nm.size * 1.45;
    const tagH = tag ? b.tag * 1.45 + (t.tag.pill ? t.tag.pill.padY * 2 : 0) : 0;
    const topH = center ? (logo ? 30 + 2 : 0) + (tag ? tagH + 2 : 0) + nmH : Math.max(nmH, logo ? 30 : 0, tagH);
    const gapMin = 10;
    // 큰 문구·소개가 쓸 수 있는 높이: 전체 - 위아래 여백 - 위 줄 - 단추 - 사이 간격(미니멀은 가로선 위까지만)
    const lineGuard = t.rLine ? Math.max(0, t.rLine - btnH - padT) + 6 : 0;
    const avail = H - frame * 2 - padT * 2 - topH - btnH - gapMin * 2 - lineGuard;
    const ov = t.hl.size?.r;
    const fsBase = ov?.fs ?? b.hl;
    // 큰 문구 크기: 기본의 1.4배부터 줄여 가며 "3줄 이하 + 소개까지 높이 안"인 가장 큰 크기
    let fsPick = fsBase;
    let subPick: { size: number; lines: number } | null = null;
    for (let fs = Math.min(fsBase * 1.4, 38); fs >= 15; fs -= 1) {
      const h = hlFit(t, z, headline, inner, 3, fs, fs);
      if (h.f.cut || h.f.lines.length > 3) continue;
      const hlH = h.lh * h.f.lines.length;
      let subH = 0;
      let sub: { size: number; lines: number } | null = null;
      if (intro) {
        const subLines = h.f.lines.length >= 3 ? 1 : 2;
        const sf = fitText([{ text: intro, em: false }], { width: inner * SAFE, maxLines: subLines, base: tf(t.sub, BASE.r.sub), minSize: 10 });
        sub = { size: sf.size, lines: sf.lines.length };
        subH = 6 + sf.lines.length * sf.size * 1.35;
      }
      if (hlH + subH <= avail) { fsPick = fs; subPick = sub; break; }
      fsPick = 15;
    }
    const hl = hlBlock(t, z, headline, inner, 3, 15, center, fsPick);
    const subFit = intro
      ? fitText([{ text: intro, em: false }], { width: inner * SAFE, maxLines: subPick?.lines ?? (hl.lines >= 3 ? 1 : 2), base: tf(t.sub, BASE.r.sub), minSize: 10 })
      : null;
    const top = center ? (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 * S }}>
        {logo?.node}
        {tag?.node}
        <div style={{ display: 'flex', whiteSpace: 'pre', ...look(t.nm, nm.size) }}>{nm.text}</div>
      </div>
    ) : (
      // 로고·꼬리표가 없으면 상호를 왼쪽에(오른쪽 끝에 혼자 떠 보이지 않게)
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: logo || tag ? 'space-between' : 'flex-start', gap: 8 * S }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 * S }}>
          {logo?.node}
          {tag?.node}
        </div>
        <div style={{ display: 'flex', whiteSpace: 'pre', ...look(t.nm, nm.size) }}>{nm.text}</div>
      </div>
    );
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: `${padT * S}px ${pad.r * S}px ${padT * S}px ${pad.l * S}px` }}>
        {top}
        {/* 가운데 칸: 남는 높이를 다 쓰고 그 안에서 세로 가운데(미니멀은 가로선 위까지만) */}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', gap: 6 * S, alignItems: center ? 'center' : 'flex-start', paddingBottom: lineGuard * S, overflow: 'hidden' }}>
          {hl.node}
          {subFit && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start' }}>
              {subFit.lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', whiteSpace: 'pre', ...look(t.sub, subFit.size), lineHeight: 1.35 }}>{l.map((s) => s.text).join('')}</div>
              ))}
            </div>
          )}
        </div>
        {btn.node}
      </div>
    );
  }

  const el = (
    <div style={{ display: 'flex', position: 'relative', overflow: 'hidden', width: W * S, height: H * S, fontFamily: 'NotoKR', ...t.root }}>
      {decos}
      <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>{body}</div>
    </div>
  );
  return { el, families: themeFamilies(t) };
}

/**
 * 배너 PNG 만들기. 크기는 규격의 2배(예: 320x100 → 640x200).
 *   maxBytes 를 주면 그보다 크면 색 수를 줄여 다시 저장한다(자리 용량 한도 맞추기).
 *   mode 는 겹침 검사 시험용(평소엔 'normal').
 */
export async function renderBanner(input: BannerInput, maxBytes?: number, mode: RenderMode = 'normal'): Promise<Uint8Array> {
  const { w, h } = SIZE_INFO[input.size];
  const { el, families } = await layout(input, mode);
  const fonts = await fontsFor(families);
  const res = new ImageResponse(el, { width: w * S, height: h * S, fonts });
  let png: Buffer<ArrayBufferLike> = Buffer.from(await res.arrayBuffer());
  if (maxBytes && png.length > maxBytes) {
    // 색 수를 줄인 PNG(팔레트)로 다시 — 그라데이션이 있는 스타일만 해당, 눈으로는 거의 차이 없음
    for (const colors of [256, 128, 64]) {
      const smaller = await sharp(png).png({ palette: true, colors, compressionLevel: 9, effort: 8 }).toBuffer();
      png = smaller;
      if (png.length <= maxBytes) break;
    }
  }
  return new Uint8Array(png);
}
