// ──────────────────────────────────────────────
// 광고 견본 스타일 배너 만들기 — 2026년 10월 30일
//
// [무슨 기능인가]
//   스타일 8종 x 자리 규격 4종 = 32장을 public/sponsor/styles/<열쇠>/<규격>.png 로 만든다.
//   아래 STYLES 표(상호·전화·문구)와 STYLE_CSS(색·글꼴·배치)로 HTML 을 만들어
//   플레이라이트(크로미움)로 장마다 정확한 픽셀 크기로 캡처한다.
//
// [사용법]  node scripts/sponsor-banners/make-style-banners.mjs [스타일열쇠]
// [바꾸는 법] STYLES 표의 문구만 고치면 된다. 전화는 반드시 010-0 으로 시작(실제 가입자에게 배정되지 않는 번호).
//   열쇠·이름은 src/lib/ads/bannerStyles.ts 와 같아야 한다.
// ──────────────────────────────────────────────
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.resolve(here, '../../public/sponsor/styles');
// 플레이라이트는 모이다공구 쪽에 깔려 있는 것을 빌려 쓴다
const require = createRequire('C:/dotori/09_moida09/package.json');
const { chromium } = require('playwright');

/** 만들 규격: 파일 이름 · 구분 글자 · 1배 크기 (최종 PNG 는 2배) */
const SIZES = [
  { file: '320x100', z: 'h', w: 320, h: 100 },
  { file: '300x250', z: 'r', w: 300, h: 250 },
  { file: '320x50', z: 'p', w: 320, h: 50 },
  { file: '728x90', z: 'w', w: 728, h: 90 },
];

/**
 * 스타일 표. hl 안의 *글자* 는 강조색으로 칠한다.
 * tag=꼬리표, hl=큰 문구, sub=보조 문구, nm=상호, phone=가상 전화, bdg=뱃지, ex=체크 목록(300x250 에만)
 */
const STYLES = [
  { key: 'classic', tag: '도배·장판 전문', hl: '벽지 한 장도 *정직하게*', sub: '방 1개부터 전체 도배까지', nm: '한결도배', phone: '010-0234-5678', bdg: '무료 방문 견적', ex: ['실크·합지 모두', '방문 견적 무료', '시공 후 AS'] },
  { key: 'modern', tag: 'TILE', hl: '타일, *깔끔하게* 끝냅니다', sub: '시공 후 1년 무상 보수', nm: '올데이타일', phone: '010-0345-6789', bdg: '1년 보증', ex: ['욕실·주방·베란다', '당일 견적', '1년 무상 보수'] },
  { key: 'minimal', tag: 'BATHROOM', hl: '욕실 리모델링', sub: '담담하게, 꼼꼼하게', nm: '담담욕실', phone: '010-0456-7890', bdg: '상담 무료', ex: ['철거부터 마감까지', '공정표 제공', '사후 점검'] },
  { key: 'neon', tag: '창호 교체', hl: '창호 교체 *30%* 할인', sub: '이번 달 한정 특가', nm: '번개창호', phone: '010-0567-8901', bdg: '무료 실측', ex: ['시스템창호 전문', '이중창 단열 보강', '무료 실측·견적'] },
  { key: 'wood', tag: '주방·붙박이장', hl: '주방을 *따뜻하게*', sub: '맞춤 제작부터 설치까지', nm: '온기주방', phone: '010-0678-9012', bdg: '맞춤 제작', ex: ['싱크대 맞춤 제작', '상판 교체 가능', '설치 후 점검'] },
  { key: 'trust', tag: '종합 인테리어', hl: '믿을 수 있는 *올수리*', sub: '견적부터 사후관리까지 한곳에서', nm: '믿음올수리', phone: '010-0789-0123', bdg: '15년 경력', ex: ['견적 무료', '시공 보증서 발급', 'AS 책임 보장'] },
  { key: 'pop', tag: '바닥재 전문', hl: '바닥재 *싹* 바꿔드려요!', sub: '장판·마루·데코타일', nm: '쏙쏙바닥', phone: '010-0890-1234', bdg: '지금 전화!', ex: ['장판·마루·타일', '하루 만에 끝', '방문 견적 무료'] },
  { key: 'gold', tag: '조명 · 전기 시공', hl: '공간에 *품격*을', sub: '프리미엄 조명 설계 · 전기 시공', nm: '더클래스전기', phone: '010-0901-2345', bdg: 'PREMIUM', ex: ['간접조명 설계', '스위치·배선 교체', '프리미엄 마감'] },
];

const WF = 'file:///C:/Users/MS/AppData/Local/Microsoft/Windows/Fonts/';

/** 글꼴 등록 + 공통 틀 CSS */
const BASE_CSS = `
@font-face { font-family:'NotoKR'; src:url('file:///C:/Windows/Fonts/NotoSansKR-VF.ttf'); font-weight:100 900; }
@font-face { font-family:'NotoSerif'; src:url('file:///C:/Windows/Fonts/NotoSerifKR-VF.ttf'); font-weight:200 900; }
@font-face { font-family:'BlackHan'; src:url('${WF}BlackHanSans-Regular.ttf'); }
@font-face { font-family:'Gmarket'; src:url('${WF}GmarketSansTTFBold.ttf'); font-weight:700 900; }
@font-face { font-family:'PretLight'; src:url('${WF}Pretendard-Light.otf'); }
@font-face { font-family:'PretBlack'; src:url('${WF}Pretendard-Black.otf'); }
html, body { margin:0; padding:0; background:transparent; }
* { box-sizing:border-box; font-family:'NotoKR','Malgun Gothic',sans-serif; }
/* 배너 공통 틀: 1배 크기로 그리고 zoom:2 로 2배 PNG */
.b { position:relative; overflow:hidden; zoom:2; display:none; align-items:center; }
.b.on { display:flex; }
.z-h { width:320px; height:100px; } .z-r { width:300px; height:250px; }
.z-p { width:320px; height:50px; }  .z-w { width:728px; height:90px; }
.b > * { position:relative; z-index:1; }
.b > i { position:absolute; z-index:0; display:block; }
.ell { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.c2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-width:0; }
.c3 { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; min-width:0; }
.col { display:flex; flex-direction:column; min-width:0; flex:1; }
.btn { display:flex; align-items:center; justify-content:center; white-space:nowrap; flex:none; text-align:center; }
.btn b { font-weight:inherit; }
.bdg, .ex { display:none; }
.ex { list-style:none; margin:0; padding:0; }
/* 규격별 기본 배치 */
.z-h { padding:0 12px; gap:10px; } .z-h .btn { width:118px; height:40px; flex-direction:column; font-size:13px; line-height:1.2; }
.z-h .btn span, .z-w .btn span { font-size:9px; font-weight:600; opacity:.85; }
.z-h .tag { font-size:10px; } .z-h .hl { font-size:17px; line-height:21px; } .z-h .nm { font-size:11px; } .z-h .sub { display:none; }
.z-h .top { display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:0; } .z-h .top .tag { order:1; } .z-h .top .nm { order:3; }
.z-h .col { gap:2px; }
.z-p { padding:0 8px; gap:8px; } .z-p .btn { height:32px; padding:0 10px; font-size:12px; } .z-p .btn span { display:none; }
.z-p .nm { font-size:12px; flex:none; max-width:92px; } .z-p .hl { font-size:12.5px; flex:1; }
.z-r { flex-direction:column; align-items:stretch; padding:16px; gap:8px; justify-content:space-between; }
.z-r .top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.z-r .tag { font-size:11px; } .z-r .nm { font-size:12px; }
.z-r .hl { font-size:25px; line-height:31px; } .z-r .sub { font-size:12px; }
.z-r .ex { display:flex; flex-wrap:wrap; gap:3px 10px; font-size:11px; } .z-r .bdg { display:block; }
.z-r .btn { height:44px; font-size:15px; gap:8px; } .z-r .btn span { font-size:12px; }
.z-w { padding:0 16px; gap:16px; } .z-w .btn { height:52px; padding:0 20px; flex-direction:column; font-size:17px; line-height:1.2; }
.z-w .tag { font-size:11px; flex:none; } .z-w .hl { font-size:21px; line-height:26px; } .z-w .sub { font-size:12px; }
.z-w .nm { font-size:13px; flex:none; } .z-w .bdg { display:block; flex:none; }
.z-w .tag, .z-w .bdg { align-self:center !important; }
`;

/** 스타일별 CSS (.s-열쇠 로 시작) */
const STYLE_CSS = {
  classic: `
  .s-classic { background:#f7efe3 repeating-linear-gradient(90deg, rgba(120,90,50,.05) 0 1px, transparent 1px 6px); color:#2a1f17; }
  .s-classic .tag { background:#2a1f17; color:#fff; border-radius:99px; padding:3px 10px; font-weight:700; align-self:flex-start; }
  .s-classic .hl { font-weight:800; letter-spacing:-.02em; } .s-classic .hl em { font-style:normal; color:#b57514; }
  .s-classic .nm { color:#8a5f12; font-weight:800; } .s-classic .sub { color:#6b5a4a; }
  .s-classic .btn { background:#c88a1f; color:#fff; border-radius:10px; font-weight:800; }
  .s-classic .bdg { border:1.5px solid #c88a1f; color:#8a5f12; border-radius:99px; padding:4px 12px; font-size:11px; font-weight:700; align-self:flex-start; }
  .s-classic .ex { color:#6b5a4a; } .s-classic .ex li::before { content:'• '; color:#c88a1f; }`,
  modern: `
  .s-modern { background:#0b0b0c; color:#fff; }
  .s-modern i.d1 { left:0; top:0; bottom:0; width:5px; background:#c6ff1a; }
  .s-modern i.d2 { right:-30px; top:-20px; width:110px; height:300px; background:rgba(198,255,26,.07); transform:rotate(20deg); }
  .s-modern .tag { color:#c6ff1a; font-weight:800; letter-spacing:.2em; font-family:'PretBlack'; }
  .s-modern .hl { font-family:'PretBlack'; font-weight:900; letter-spacing:-.03em; } .s-modern .hl em { font-style:normal; color:#c6ff1a; }
  .s-modern .nm { color:#9a9a9a; font-weight:600; } .s-modern .sub { color:#bdbdbd; }
  .s-modern .btn { background:#c6ff1a; color:#0b0b0c; border-radius:4px; font-family:'PretBlack'; font-weight:900; }
  .s-modern .btn * { font-family:'PretBlack'; }
  .s-modern .bdg { border:1.5px solid #c6ff1a; color:#c6ff1a; padding:3px 10px; font-size:11px; font-weight:800; align-self:flex-start; letter-spacing:.05em; }
  .s-modern .ex { color:#cfcfcf; } .s-modern .ex li::before { content:'+ '; color:#c6ff1a; font-weight:900; }
  .z-h.s-modern { padding-left:20px; } .z-w.s-modern { padding-left:26px; } .z-p.s-modern { padding-left:16px; } .z-r.s-modern { padding-left:24px; }`,
  minimal: `
  .s-minimal { background:#fff; color:#111; box-shadow:inset 0 0 0 1px #e3e3e3; }
  .s-minimal i.d1 { left:16px; right:16px; bottom:0; height:1px; background:#111; }
  .s-minimal .tag { color:#9a9a9a; letter-spacing:.22em; font-weight:500; font-size:9px; }
  .s-minimal .hl { font-family:'PretLight'; font-weight:300; letter-spacing:-.01em; font-size:19px; } .s-minimal .hl em { font-style:normal; border-bottom:1px solid #111; }
  .s-minimal .nm { color:#777; font-weight:400; } .s-minimal .sub { color:#8a8a8a; font-weight:300; }
  .s-minimal .btn { background:#fff; color:#111; border:1.5px solid #111; border-radius:0; font-weight:600; letter-spacing:.02em; }
  .s-minimal .bdg { color:#111; font-size:11px; letter-spacing:.1em; border-top:1px solid #111; padding-top:4px; align-self:flex-start; }
  .s-minimal .ex { color:#777; font-weight:300; } .s-minimal .ex li::before { content:'— '; }
  .z-r.s-minimal .hl { font-size:27px; line-height:34px; } .z-r.s-minimal i.d1 { bottom:70px; }
  .z-p.s-minimal i.d1 { display:none; }`,
  neon: `
  .s-neon { background:linear-gradient(120deg,#2a0a6b 0%,#5b21d6 55%,#1d4ed8 100%); color:#fff; }
  .s-neon i.d1 { right:-20px; top:-40px; width:140px; height:140px; border-radius:50%; background:radial-gradient(circle,rgba(255,45,149,.55),transparent 70%); }
  .s-neon i.d2 { left:30%; bottom:-60px; width:160px; height:120px; border-radius:50%; background:radial-gradient(circle,rgba(0,229,255,.35),transparent 70%); }
  .s-neon .tag { color:#7ff0ff; font-weight:800; letter-spacing:.04em; }
  .s-neon .hl { font-family:'BlackHan'; font-weight:400; letter-spacing:-.01em; text-shadow:0 0 12px rgba(255,255,255,.35); } .s-neon .hl em { font-style:normal; font-family:'BlackHan'; color:#ffe600; text-shadow:0 0 14px rgba(255,230,0,.7); font-size:1.15em; }
  .s-neon .nm { color:#d9ccff; font-weight:700; } .s-neon .sub { color:#d9ccff; }
  .s-neon .btn { background:#ffe600; color:#2a0a6b; border-radius:8px; font-weight:900; box-shadow:0 0 14px rgba(255,230,0,.55); }
  .s-neon .bdg { background:#ff2d95; color:#fff; font-weight:900; border-radius:99px; padding:4px 12px; font-size:11px; box-shadow:0 0 12px rgba(255,45,149,.8); align-self:flex-start; }
  .z-h.s-neon .bdg { display:block; position:absolute; right:12px; top:8px; font-size:9px; padding:2px 8px; } .z-h.s-neon .btn { margin-top:14px; }
  .s-neon .ex { color:#e6ddff; } .s-neon .ex li::before { content:'+ '; color:#ffe600; font-weight:900; }
  .z-r.s-neon .hl { font-size:28px; line-height:36px; } .z-r.s-neon .hl em { font-size:1.45em; }`,
  wood: `
  .s-wood { background:linear-gradient(90deg, transparent 0 14%, rgba(255,255,255,.06) 14% 38%, transparent 38% 62%, rgba(0,0,0,.14) 62% 86%, transparent 86%), #8a5a2e; border-radius:16px; color:#4a2f18; }
  .s-wood i.d1 { inset:6px; border-radius:11px; background:#f3e4c8 repeating-linear-gradient(0deg, rgba(120,80,40,.05) 0 1px, transparent 1px 5px); }
  .s-wood .tag { background:#8a5a2e; color:#fff4de; border-radius:99px; padding:3px 10px; font-weight:700; align-self:flex-start; font-family:'Gmarket'; }
  .s-wood .hl { font-family:'Gmarket'; font-weight:800; letter-spacing:-.03em; } .s-wood .hl em { font-style:normal; font-family:'Gmarket'; color:#c0602b; }
  .s-wood .nm { color:#8a5a2e; font-weight:700; } .s-wood .sub { color:#7a5a3a; }
  .s-wood .btn { background:#c0602b; color:#fff; border-radius:99px; font-family:'Gmarket'; font-weight:800; }
  .s-wood .btn * { font-family:'Gmarket'; }
  .s-wood .bdg { background:#e6cf9f; color:#6a4220; border-radius:99px; padding:4px 12px; font-size:11px; font-weight:700; align-self:flex-start; }
  .s-wood .ex { color:#7a5a3a; } .s-wood .ex li::before { content:'● '; color:#c0602b; font-size:7px; vertical-align:2px; }
  .z-h.s-wood { padding:0 20px; } .z-r.s-wood { padding:22px; } .z-w.s-wood { padding:0 24px; } .z-p.s-wood { padding:0 14px; }`,
  trust: `
  .s-trust { background:linear-gradient(135deg,#0a2456,#123a80); color:#fff; }
  .s-trust i.d1 { right:0; top:0; bottom:0; width:6px; background:#7fb2ff; }
  .s-trust i.d2 { left:-30px; bottom:-50px; width:120px; height:120px; border-radius:50%; border:18px solid rgba(255,255,255,.05); }
  .s-trust .tag { color:#9cc4ff; font-weight:700; }
  .s-trust .hl { font-weight:800; letter-spacing:-.02em; } .s-trust .hl em { font-style:normal; color:#8fc0ff; }
  .s-trust .nm { color:#b9d2f5; font-weight:700; } .s-trust .sub { color:#c5d8f5; }
  .s-trust .btn { background:#fff; color:#0a2456; border-radius:8px; font-weight:800; }
  .s-trust .bdg { background:#fff; color:#0a2456; border-radius:6px; padding:3px 9px; font-size:11px; font-weight:800; align-self:flex-start; }
  .z-h.s-trust .bdg { display:block; position:absolute; left:12px; top:9px; z-index:2; font-size:9px; padding:2px 7px; } .z-h.s-trust .tag { display:none; } .z-h.s-trust .col { margin-top:14px; }
  .s-trust .ex { color:#d3e2f8; } .s-trust .ex li { display:flex; align-items:center; gap:5px; }
  .s-trust .ex li::before { content:''; width:5px; height:9px; border:solid #8fc0ff; border-width:0 2px 2px 0; transform:rotate(45deg) translate(-1px,-2px); display:inline-block; }`,
  pop: `
  .s-pop { background:#ffd400 radial-gradient(circle,rgba(255,106,0,.28) 1.5px,transparent 2px) 0 0/10px 10px; color:#111; border:3px solid #111; border-radius:12px; }
  .s-pop .tag { background:#111; color:#ffd400; padding:2px 9px; font-weight:900; transform:rotate(-2deg); align-self:flex-start; border-radius:4px; }
  .s-pop .hl { font-family:'BlackHan'; font-weight:400; letter-spacing:-.01em; } .s-pop .hl em { font-style:normal; font-family:'BlackHan'; color:#ff2d55; font-size:1.2em; }
  .s-pop .nm { color:#111; font-weight:800; } .s-pop .sub { color:#3a2f00; font-weight:700; }
  .s-pop .btn { background:#ff6a00; color:#fff; border:2.5px solid #111; border-radius:10px; font-weight:900; box-shadow:3px 3px 0 #111; }
  .s-pop .btn span { opacity:1; }
  .s-pop .bdg { background:#fff; border:2.5px solid #111; border-radius:14px; padding:4px 12px; font-size:12px; font-weight:900; align-self:flex-start; position:relative; box-shadow:2px 2px 0 #111; }
  .s-pop .bdg::after { content:''; position:absolute; left:16px; bottom:-8px; width:10px; height:10px; background:#fff; border:solid #111; border-width:0 2.5px 2.5px 0; transform:rotate(45deg); }
  .z-w.s-pop .bdg { align-self:center; } .z-w.s-pop .bdg::after { left:-6px; bottom:auto; top:8px; border-width:0 0 2.5px 2.5px; }
  .s-pop .ex { color:#111; font-weight:800; } .s-pop .ex li::before { content:'+ '; color:#ff2d55; font-weight:900; }`,
  gold: `
  .s-gold { background:radial-gradient(ellipse at 20% 0%,#2a2113 0%,#0d0b08 60%); color:#f4e3b6; }
  .s-gold, .s-gold * { font-family:'NotoSerif','NotoKR',serif; }
  .s-gold i.d1 { inset:4px; border:1px solid #c8a24a; } .s-gold i.d2 { inset:7px; border:1px solid rgba(200,162,74,.4); }
  .s-gold .tag { color:#c8a24a; letter-spacing:.2em; font-weight:600; font-size:9px; }
  .s-gold .hl { font-weight:700; letter-spacing:-.01em; color:#f3d98a; } .s-gold .hl em { font-style:normal; color:#d9b45a; }
  .s-gold .nm { color:#c8a24a; font-weight:600; } .s-gold .sub { color:#cdb98a; font-weight:400; }
  .s-gold .btn { background:linear-gradient(180deg,#f3d98a,#b88a2e); color:#1a1306; border-radius:2px; font-weight:800; }
  .s-gold .bdg { color:#c8a24a; letter-spacing:.3em; font-size:10px; font-weight:600; }
  .s-gold .ex { color:#cdb98a; } .s-gold .ex li::before { content:'◆ '; color:#c8a24a; font-size:7px; vertical-align:2px; }
  .z-h.s-gold { padding:0 18px; } .z-p.s-gold { padding:0 12px; } .z-w.s-gold { padding:0 24px; }
  .z-r.s-gold { padding:22px; text-align:center; } .z-r.s-gold .top { justify-content:center; flex-direction:column; gap:2px; } .z-r.s-gold .bdg { display:none; } .z-r.s-gold .ex { justify-content:center; }
  .z-p.s-gold i.d2 { display:none; } .z-p.s-gold i.d1 { inset:2px; }`,
};

/** HTML 글자 안전 처리 + *강조* 를 em 으로 */
const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const hlHtml = (t) => esc(t).replace(/\*(.+?)\*/g, '<em>$1</em>');

/** 규격별 마크업 */
function markup(s, sz) {
  const deco = '<i class="d1"></i><i class="d2"></i>';
  const btnTxt = sz.z === 'p' ? `<b>${s.phone}</b>` : `<span>전화하기</span><b>${s.phone}</b>`;
  const tag = `<div class="tag ell">${esc(s.tag)}</div>`;
  const nm = `<div class="nm ell">${esc(s.nm)}</div>`;
  const hl = `<div class="hl ${sz.z === 'r' ? 'c3' : sz.z === 'p' ? 'ell' : 'c2'}">${hlHtml(s.hl)}</div>`;
  const sub = `<div class="sub ell">${esc(s.sub)}</div>`;
  const bdg = `<div class="bdg">${esc(s.bdg)}</div>`;
  const ex = `<ul class="ex">${s.ex.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
  const btn = `<div class="btn">${btnTxt}</div>`;
  let inner;
  if (sz.z === 'h') inner = `<div class="col"><div class="top">${tag}${nm}</div>${hl}</div>${bdg}${btn}`;
  else if (sz.z === 'r') inner = `<div class="top">${tag}${nm}</div>${hl}${sub}${ex}${bdg}${btn}`;
  else if (sz.z === 'p') inner = `${nm}${hl}${btn}`;
  else inner = `${tag}<div class="col">${hl}${sub}</div>${nm}${bdg}${btn}`;
  return `<div class="b z-${sz.z} s-${s.key}" id="${s.key}-${sz.z}">${deco}${inner}</div>`;
}

const only = process.argv[2];
const list = STYLES.filter((s) => !only || s.key === only);
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${BASE_CSS}${Object.values(STYLE_CSS).join('\n')}</style></head><body>${list.flatMap((s) => SIZES.map((sz) => markup(s, sz))).join('')}</body></html>`;
const tmp = path.join(os.tmpdir(), 'ulm-style-banners.html');
fs.writeFileSync(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(pathToFileURL(tmp).href);
await page.evaluate(() => document.fonts.ready);
let n = 0;
for (const s of list) {
  const dir = path.join(outRoot, s.key);
  fs.mkdirSync(dir, { recursive: true });
  for (const sz of SIZES) {
    const W = sz.w * 2, H = sz.h * 2;
    await page.setViewportSize({ width: W, height: H });
    await page.evaluate((id) => document.querySelectorAll('.b').forEach((e) => e.classList.toggle('on', e.id === id)), `${s.key}-${sz.z}`);
    await page.screenshot({ path: path.join(dir, `${sz.file}.png`), clip: { x: 0, y: 0, width: W, height: H }, omitBackground: true });
    n++;
  }
}
console.log('만든 그림', n, '장');
await browser.close();
