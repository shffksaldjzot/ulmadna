// ──────────────────────────────────────────────
// 광고 시험 데이터 넣기 — 2026년 10월 29일 (토리가 직접 실행. 자동 실행 금지)
//
// [무슨 기능인가]
//   광고주 "한결도배(시험)" 한 곳과 AD-H·AD-R 주문 2건을 만들고, 샘플 배너 그림을
//   Supabase 보관함(ad-banners)에 올려 주문에 연결한다. 주문은 게재 상태 '심사중'·결제 '대기'라
//   일반 방문자에게는 보이지 않고, 주소 뒤에 ?ad_preview=<주문번호> 를 붙인 미리보기에서만 보인다.
//
// [사용법]  (20261029_ads_ops.sql 을 먼저 실행해 표·보관함이 있어야 한다)
//   node scripts/seed-test-ad.mjs                    ← 미리 보기(아무것도 쓰지 않음, 계획만 출력)
//   node scripts/seed-test-ad.mjs --apply            ← 실제로 넣기
//   --dir <폴더>   샘플 그림 폴더(기본 docs/banner-samples, 현재 폴더 기준)
//   --update       이미 있는 시험 광고주(옛 이름 포함)를 한결도배(시험)으로 고치고, 그 광고주의 AD-H·AD-R 주문 배너를
//                  public/sponsor/banner-ad-h.png·banner-ad-r.png 새 그림으로 다시 올린다(주문은 새로 만들지 않음). --apply 와 같이 써야 실제 반영
//   --premium      AD-R 에 AD-R_premium_300x250@2x.png 를 쓴다(기본은 AD-R_300x250@2x.png)
//   필요: .env.local 의 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY (값은 화면에 찍지 않는다)
// ──────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

/** .env.local 읽기 */
function readEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const premium = argv.includes('--premium');
/** 갱신 모드: 새 주문을 만들지 않고 기존 시험 광고주·배너만 고친다 */
const update = argv.includes('--update');
const dirIdx = argv.indexOf('--dir');
const dir = path.resolve(process.cwd(), dirIdx >= 0 ? argv[dirIdx + 1] : 'docs/banner-samples');

const env = { ...readEnv(path.resolve(process.cwd(), '.env.local')), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다(.env.local 확인)');

/** 오늘(한국 날짜)과 30일 뒤 마지막 날 */
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const end = new Date(new Date(`${today}T00:00:00Z`).getTime() + 29 * 86400000).toISOString().slice(0, 10);

// 만들 주문 2건(서울, 금액 0 = 시험, 심사중·결제 대기)
const PLAN = [
  { slot_kind: 'AD-H', file: 'AD-H_320x100@2x.png' },
  { slot_kind: 'AD-R', file: premium ? 'AD-R_premium_300x250@2x.png' : 'AD-R_300x250@2x.png' },
];

const H = { apikey: key, Authorization: `Bearer ${key}` };
const rest = (p, init = {}) => fetch(`${url}/rest/v1/${p}`, { ...init, headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } });

/** 가상 광고주의 현재 이름 */
const ADV_NAME = '한결도배(시험)';
/** 갱신 모드에서 옛 이름(실제 회사 이름이 들어 있던 시험 광고주) */
const OLD_ADV_NAME = '도토리 스튜디오(시험)';
/** 갱신 모드에서 쓸 새 배너 그림(자리 종류 → 파일) */
const UPDATE_FILES = { 'AD-H': 'public/sponsor/banner-ad-h.png', 'AD-R': 'public/sponsor/banner-ad-r.png' };

/** 갱신 모드: 시험 광고주 이름을 바꾸고, 그 광고주의 AD-H·AD-R 주문 배너를 새 그림으로 교체 */
async function runUpdate() {
  // 이름이 옛 것이든 새 것이든 시험 광고주 1곳만 찾는다(다른 실제 광고주는 건드리지 않음)
  let r = await rest('advertisers?name=in.(' + encodeURIComponent(`"${OLD_ADV_NAME}","${ADV_NAME}"`) + ')&select=id,name');
  if (!r.ok) throw new Error(`광고주 조회 실패 HTTP ${r.status}`);
  const advs = await r.json();
  if (advs.length !== 1) throw new Error(`시험 광고주가 ${advs.length}곳 찾아짐(1곳이어야 함)`);
  const adv = advs[0];
  console.log(`갱신 대상: 광고주 #${adv.id} "${adv.name}" → "${ADV_NAME}"`);
  r = await rest(`ad_orders?advertiser_id=eq.${adv.id}&slot_kind=in.(AD-H,AD-R)&select=id,slot_kind,banner_path`);
  const orders = await r.json();
  for (const o of orders) console.log(`  주문 #${o.id} ${o.slot_kind} 현재 배너 ${o.banner_path} → 새 그림 ${UPDATE_FILES[o.slot_kind]}`);
  if (!apply) { console.log('(미리 보기 — 실제로 고치려면 --apply)'); return; }
  r = await rest(`advertisers?id=eq.${adv.id}`, { method: 'PATCH', body: JSON.stringify({ name: ADV_NAME }) });
  if (!r.ok) throw new Error(`광고주 이름 변경 실패 HTTP ${r.status}`);
  for (const o of orders) {
    const bannerPath = `${o.id}/${Date.now()}.png`;
    const up = await fetch(`${url}/storage/v1/object/ad-banners/${bannerPath}`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'image/png' },
      body: fs.readFileSync(path.resolve(process.cwd(), UPDATE_FILES[o.slot_kind])),
    });
    if (!up.ok) throw new Error(`배너 올리기 실패 HTTP ${up.status} ${await up.text()}`);
    r = await rest(`ad_orders?id=eq.${o.id}`, { method: 'PATCH', body: JSON.stringify({ banner_path: bannerPath }) });
    if (!r.ok) throw new Error(`배너 경로 기록 실패 HTTP ${r.status}`);
    console.log(`주문 #${o.id} 배너 교체 완료 → ${bannerPath}`);
  }
}

async function main() {
  if (update) return runUpdate();
  for (const p of PLAN) {
    if (!fs.existsSync(path.join(dir, p.file))) throw new Error(`샘플 그림이 없어요: ${path.join(dir, p.file)}`);
  }
  console.log(`계획: 광고주 "한결도배(시험)" + 주문 ${PLAN.map((p) => p.slot_kind).join('·')} (서울, ${today} ~ ${end}, 0원, 심사중·결제 대기)`);
  if (!apply) {
    console.log('(미리 보기 — 실제로 넣으려면 --apply)');
    return;
  }

  // 광고주: 이미 있으면 재사용
  let r = await rest('advertisers?name=eq.' + encodeURIComponent('한결도배(시험)') + '&select=id');
  if (!r.ok) throw new Error(`광고주 조회 실패 HTTP ${r.status} (SQL 실행 여부 확인)`);
  let advId = (await r.json())[0]?.id;
  if (!advId) {
    r = await rest('advertisers', { method: 'POST', body: JSON.stringify({ name: '한결도배(시험)', memo: '광고 배너 시험용(seed-test-ad.mjs)' }) });
    if (!r.ok) throw new Error(`광고주 저장 실패 HTTP ${r.status}`);
    advId = (await r.json())[0].id;
  }

  for (const p of PLAN) {
    // 주문 만들기
    r = await rest('ad_orders', {
      method: 'POST',
      body: JSON.stringify({
        advertiser_id: advId, slot_kind: p.slot_kind, sido: '11', start_date: today, end_date: end, units: 1,
        amount: 0, vat: 0, pay_method: 'bank', pay_status: 'pending', run_status: 'review',
        click_url: 'https://ulmadna.com/sponsor', note: '시험 주문(seed-test-ad.mjs)',
      }),
    });
    if (!r.ok) throw new Error(`주문 저장 실패 HTTP ${r.status} ${await r.text()}`);
    const id = (await r.json())[0].id;

    // 배너 올리기 → 주문에 경로 기록
    const bannerPath = `${id}/${Date.now()}.png`;
    const up = await fetch(`${url}/storage/v1/object/ad-banners/${bannerPath}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'image/png' },
      body: fs.readFileSync(path.join(dir, p.file)),
    });
    if (!up.ok) throw new Error(`배너 올리기 실패 HTTP ${up.status} ${await up.text()} (보관함 ad-banners 확인)`);
    r = await rest(`ad_orders?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ banner_path: bannerPath }) });
    if (!r.ok) throw new Error(`배너 경로 기록 실패 HTTP ${r.status}`);

    console.log(`주문 #${id} ${p.slot_kind} 완료 → 미리보기: https://ulmadna.com/${p.slot_kind === 'AD-H' ? '' : 'calc'}?ad_preview=${id}`);
  }
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
