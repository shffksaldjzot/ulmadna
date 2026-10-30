// ─────────────────────────────────────────────────────────────
// 포트원(PortOne) V2 서버 연동 (서버 전용) — 2026년 10월 31일
//
// [무슨 기능인가]
//   결제창은 브라우저(@portone/browser-sdk)가 열고, 돈이 진짜 들어왔는지는 여기서
//   포트원 REST API 로 다시 물어본다(브라우저가 보낸 "성공" 은 믿지 않는다).
//   공식 문서: https://developers.portone.io/opi/ko/integration/start/v2/checkout
//     - 결제 조회: GET  https://api.portone.io/payments/{paymentId}
//     - 결제 취소: POST https://api.portone.io/payments/{paymentId}/cancel  body { reason, amount? }
//     - 머리말:   Authorization: PortOne {API_SECRET}
//
// [열쇠] .env.local 에서만 읽는다(화면·커밋에 넣지 않음)
//   PORTONE_STORE_ID     상점 아이디(결제창용 — 브라우저에 넘겨도 되는 값)
//   PORTONE_CHANNEL_KEY  채널 키(결제창용 — 브라우저에 넘겨도 되는 값)
//   PORTONE_API_SECRET   API 비밀 열쇠(서버만)
//   셋 중 하나라도 없으면 "결제 준비 중" — 결제 단추를 끈다.
// ─────────────────────────────────────────────────────────────
import 'server-only';

const API = 'https://api.portone.io';

/** 결제창에 넘길 공개 값. 열쇠가 다 있어야 ready=true */
export function payConfig(): { ready: boolean; storeId: string; channelKey: string } {
  const storeId = process.env.PORTONE_STORE_ID?.trim() ?? '';
  const channelKey = process.env.PORTONE_CHANNEL_KEY?.trim() ?? '';
  const secret = process.env.PORTONE_API_SECRET?.trim() ?? '';
  const ready = Boolean(storeId && channelKey && secret);
  return { ready, storeId: ready ? storeId : '', channelKey: ready ? channelKey : '' };
}

function secret(): string | null {
  return process.env.PORTONE_API_SECRET?.trim() || null;
}

/** 포트원에 물어본 결제 상태(필요한 칸만) */
export interface PortOnePayment {
  status: string; // 'PAID' 면 결제 완료(문서 예시 기준). 그 밖: READY·FAILED·CANCELLED 등
  total: number; // amount.total — 실제 결제 금액
  /** 실패한 결제의 PG 사유(failure.pgMessage 또는 reason, 없으면 빈 문자열) */
  failReason: string;
}

/** 결제 한 건 조회. 열쇠가 없거나 실패하면 null */
export async function fetchPayment(paymentId: string): Promise<PortOnePayment | null> {
  const key = secret();
  if (!key) return null;
  try {
    const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const p = (await res.json()) as { status?: string; amount?: { total?: number }; failure?: { reason?: string; pgMessage?: string } };
    return { status: String(p.status ?? ''), total: Number(p.amount?.total ?? NaN), failReason: String(p.failure?.pgMessage || p.failure?.reason || '') };
  } catch {
    return null;
  }
}

/** 결제 취소(전액 또는 일부). 성공하면 true */
export async function cancelPayment(paymentId: string, reason: string, amount?: number): Promise<boolean> {
  const key = secret();
  if (!key) return false;
  try {
    const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `PortOne ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(amount != null ? { reason, amount } : { reason }),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}
