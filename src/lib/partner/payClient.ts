// ─────────────────────────────────────────────────────────────
// 포트원 결제창 열기 (브라우저 전용) — 2026년 10월 31일
//
// [순서] 포트원 V2 결제창 공식 문서 그대로
//   (https://developers.portone.io/opi/ko/integration/start/v2/checkout)
//   1) 서버가 준비한 paymentId·주문 이름·금액으로 PortOne.requestPayment({...}) 호출
//      - currency "CURRENCY_KRW", payMethod "CARD"(카드 하나만)
//      - redirectUrl: 휴대폰은 대부분 결제사 화면으로 넘어갔다가 이 주소로 돌아온다(?paymentId=&code=&message=)
//   2) PC 처럼 돌아오는 값(response)이 있으면 response.code 가 있을 때 실패, 없으면 성공
//   3) 성공이면 서버 확인 API(/api/partner/pay/confirm)로 금액·상태를 다시 확인
//   SDK 는 결제 단추를 누를 때만 불러온다(첫 화면 가볍게).
// ─────────────────────────────────────────────────────────────

/** 결제창 설정(서버가 준 공개 값) */
export interface PayCfg {
  storeId: string;
  channelKey: string;
}

/** 서버 준비 결과 */
export interface PreparedPay {
  /** true 면 합계 0원(첫 달 무료)이라 서버가 주문을 바로 만들었다 — 결제창 없음 */
  free?: boolean;
  /** 무료 신청으로 바로 만든 주문 번호(완료 안내용) */
  orderId?: number;
  paymentId: string;
  orderName: string;
  total: number;
}

/** 결과: 끝남 / 결제사 화면으로 넘어감(돌아오는 화면이 이어서 처리) / 실패 */
//   fail.pgMessage 가 있으면 결제사(PG)가 거절한 사유 그대로(화면이 "결제 승인이 거절됐어요 · 사유" 로 보여 줌)
export type PayResult = { kind: 'done'; orderId?: number } | { kind: 'redirect' } | { kind: 'fail'; error: string; pgMessage?: string };

/** 결제 실패 사유를 서버에 알려 fail_reason 에 남긴다(실패해도 화면엔 영향 없음) */
export async function reportPayFail(paymentId: string, message: string): Promise<void> {
  try {
    await fetch('/api/partner/pay/fail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, message }),
    });
  } catch {
    // 기록 실패는 무시
  }
}

/** 서버 확인 API 부르기 */
export async function confirmPay(paymentId: string): Promise<PayResult> {
  try {
    const r = await fetch('/api/partner/pay/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string; state?: string; orderId?: number | null };
    if (!r.ok) return { kind: 'fail', error: d.error || '결제 확인에 실패했어요' };
    return { kind: 'done', orderId: d.orderId ?? undefined };
  } catch {
    return { kind: 'fail', error: '연결이 끊겼어요. 결제 기록에서 확인해 주세요' };
  }
}

/** 서버에서 지금 결제 설정 받기(로그인 필요). 준비 안 됨·실패면 null */
export async function fetchPayCfg(): Promise<PayCfg | null> {
  try {
    const r = await fetch('/api/partner/pay/config', { cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as { ready?: boolean; storeId?: string; channelKey?: string };
    return d.ready && d.storeId && d.channelKey ? { storeId: d.storeId, channelKey: d.channelKey } : null;
  } catch {
    return null;
  }
}

/** 포트원 결제창 열기 → 성공이면 서버 확인까지 */
// 2026-10-29: 이니시스 V2 일반결제는 구매자 휴대폰 번호가 필수(없으면 "결제 창 호출에 실패") → phone 을 받아 customer 에 넣는다
export async function openCheckout(cfg: PayCfg, p: PreparedPay, email?: string, phone?: string, fullName?: string): Promise<PayResult> {
  try {
    // 결제 설정은 누르는 순간 서버에서 다시 받는다(열려 있던 화면의 옛 키로 결제되는 사고 방지, 2026-10-30)
    // 받지 못하면 화면에 박힌 값으로 대신하지 않고 멈춘다
    const fresh = await fetchPayCfg();
    if (!fresh) return { kind: 'fail', error: '결제 설정을 불러오지 못했어요. 새로고침 뒤 다시 눌러 주세요' };
    cfg = fresh;
    const PortOne = await import('@portone/browser-sdk/v2');
    const response = await PortOne.requestPayment({
      storeId: cfg.storeId,
      channelKey: cfg.channelKey,
      paymentId: p.paymentId,
      orderName: p.orderName,
      totalAmount: p.total,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      redirectUrl: `${location.origin}/partner/pay/return`,
      customer: {
        ...(email ? { email } : {}),
        ...(phone ? { phoneNumber: phone.replace(/\D/g, '') } : {}),
        ...(fullName ? { fullName: fullName.slice(0, 40) } : {}), // 이니시스 V2 는 구매자 이름도 필수 → 광고주 상호
      },
    });
    // 돌아오는 값이 없으면 결제사 화면으로 넘어간 것(돌아오는 화면이 확인을 이어서 한다)
    if (!response) return { kind: 'redirect' };
    if (response.code !== undefined) {
      const m = response.message || '결제를 마치지 못했어요';
      void reportPayFail(p.paymentId, m);
      return { kind: 'fail', error: '결제 승인이 거절됐어요', pgMessage: m };
    }
    return confirmPay(response.paymentId);
  } catch (e) {
    // 2026-10-29: 포트원 SDK 가 던진 이유(채널 키 불일치·상점 ID 오류 등)를 같이 보여 준다 — 처음 켤 때 원인을 바로 알 수 있게
    const why = e instanceof Error && e.message ? ` · ${e.message.slice(0, 120)}` : '';
    return { kind: 'fail', error: `결제창을 열지 못했어요${why}` };
  }
}

/** 서버에 결제 준비 요청(새 광고·연장 공용, multipart) */
export async function preparePay(form: FormData): Promise<{ ok: true; data: PreparedPay } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/partner/pay/prepare', { method: 'POST', body: form });
    const d = (await r.json().catch(() => ({}))) as PreparedPay & { error?: string };
    if (!r.ok) return { ok: false, error: d.error || '결제를 준비하지 못했어요' };
    return { ok: true, data: d };
  } catch {
    return { ok: false, error: '연결이 끊겼어요' };
  }
}
