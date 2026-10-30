'use client';
// ─────────────────────────────────────────────────────────────
// /partner/pay/return — 결제사 화면에서 돌아오는 곳 (2026년 10월 31일)
//   포트원이 ?paymentId=...(실패면 &code=&message=) 를 붙여 이 주소로 보낸다(문서의 리디렉션 방식).
//   실패 표시가 없으면 서버 확인 API 를 부르고 결과 한 줄 + 내 광고로 가는 단추.
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { confirmPay, reportPayFail } from '@/lib/partner/payClient';
import { BUSINESS } from '@/lib/business';
import { AuthShell, primaryBtn } from '../../_ui';

export default function PayReturn() {
  const [msg, setMsg] = useState('결제를 확인하고 있어요');
  const [done, setDone] = useState(false);
  const [pgMsg, setPgMsg] = useState(''); // 결제사(PG)가 거절한 사유 그대로(있으면 거절 안내 줄로 보여 줌)

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const paymentId = q.get('paymentId') || '';
    // 실패하면 code 가 붙어 온다
    // 실패면 확인 없이 바로, 아니면 서버 확인 뒤 한 줄(둘 다 비동기로 화면에 반영)
    const rejected = !!q.get('code');
    const job =
      rejected || !paymentId
        ? Promise.resolve(q.get('message') || '결제를 마치지 못했어요').then((m) => {
            // 결제사가 거절한 경우: 사유를 화면에 그대로 + 서버 기록(fail_reason)
            if (rejected) {
              setPgMsg(m);
              if (paymentId) void reportPayFail(paymentId, m);
              return '결제 승인이 거절됐어요';
            }
            return m;
          })
        : confirmPay(paymentId).then((r) => {
            // 성공이면 완료 안내 카드가 있는 내 광고 화면으로 바로 보낸다(2026-10-30)
            if (r.kind === 'done' && r.orderId) {
              location.replace(`/partner?done=${r.orderId}`);
              return '결제됐어요';
            }
            if (r.kind === 'fail' && r.pgMessage) setPgMsg(r.pgMessage);
            return r.kind === 'fail' ? r.error : '결제됐어요. 배너 검토가 끝나면 게재돼요';
          });
    void job.then((m) => {
      setMsg(m);
      setDone(true);
    });
  }, []);

  return (
    <AuthShell title="카드 결제">
      <p className="mb-2 text-[16px] text-ink" role="status">{msg}</p>
      {/* 거절 사유(PG 메시지 그대로) + 다시 시도·문의 한 줄 */}
      {pgMsg && (
        <p className="mb-6 text-[14px] text-danger" data-testid="pay-reject">
          {pgMsg} · 다시 시도하거나 <a href={`mailto:${BUSINESS.email}?subject=[얼마드나] 결제 문의`} className="underline underline-offset-4">문의하기</a>
        </p>
      )}
      {!pgMsg && <div className="mb-4" />}
      {done && <Link href="/partner" className={`${primaryBtn} flex items-center justify-center`}>내 광고로</Link>}
    </AuthShell>
  );
}
