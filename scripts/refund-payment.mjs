// ─────────────────────────────────────────────────────────────
// refund-payment.mjs — 광고 카드 결제 한 건을 전액 취소한다(관리자 환불 API 호출).
//   사용: node scripts/refund-payment.mjs <결제번호 payment_id> "<사유>"
//   예:   node scripts/refund-payment.mjs ulm-mvugcejv-a8832f47227c44e2ad12 "테스트 결제 취소"
//   열쇠: .env.local 의 ADMIN_PASSWORD(관리자 로그인)·PORTONE_API_SECRET(취소 결과 확인). 값은 화면에 찍지 않는다.
//   흐름: 라이브 /api/admin-auth 로 관리자 쿠키 받기 → /api/partner/pay/refund 호출(포트원 취소 + 기록 refunded + 주문 중지)
//         → 포트원에 결제 상태를 다시 물어 CANCELLED 인지 보여 준다.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(import.meta.dirname, '../.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }),
);
const [paymentId, reason = '관리자 환불'] = process.argv.slice(2);
if (!paymentId) { console.error('사용: node scripts/refund-payment.mjs <payment_id> "<사유>"'); process.exit(1); }
if (!env.ADMIN_PASSWORD) { console.error('ADMIN_PASSWORD 없음(.env.local)'); process.exit(1); }

const base = 'https://ulmadna.com';
// 1) 관리자 로그인 → 쿠키
const a = await fetch(`${base}/api/admin-auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: env.ADMIN_PASSWORD }) });
if (!a.ok) { console.error('관리자 로그인 실패', a.status); process.exit(1); }
const cookie = (a.headers.get('set-cookie') || '').split(';')[0];
// 2) 환불
const r = await fetch(`${base}/api/partner/pay/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ paymentId, reason }) });
console.log('환불 요청', r.status, (await r.text()).slice(0, 300));
// 3) 포트원에서 결과 확인
if (env.PORTONE_API_SECRET) {
  const q = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}` } });
  const j = await q.json();
  console.log('포트원 상태', j.status, '취소 금액', j.amount?.cancelled ?? '-');
}
