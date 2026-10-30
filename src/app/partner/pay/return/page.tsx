'use client';
// ─────────────────────────────────────────────────────────────
// /partner/pay/return — 결제사 화면에서 돌아오는 곳 (2026년 10월 31일)
//   포트원이 ?paymentId=...(실패면 &code=&message=) 를 붙여 이 주소로 보낸다(문서의 리디렉션 방식).
//   실패 표시가 없으면 서버 확인 API 를 부르고 결과 한 줄 + 내 광고로 가는 단추.
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { confirmPay } from '@/lib/partner/payClient';
import { AuthShell, primaryBtn } from '../../_ui';

export default function PayReturn() {
  const [msg, setMsg] = useState('결제를 확인하고 있어요');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const paymentId = q.get('paymentId') || '';
    // 실패하면 code 가 붙어 온다
    // 실패면 확인 없이 바로, 아니면 서버 확인 뒤 한 줄(둘 다 비동기로 화면에 반영)
    const job =
      q.get('code') || !paymentId
        ? Promise.resolve(q.get('message') || '결제를 마치지 못했어요')
        : confirmPay(paymentId).then((r) => {
            // 성공이면 완료 안내 카드가 있는 내 광고 화면으로 바로 보낸다(2026-10-30)
            if (r.kind === 'done' && r.orderId) {
              location.replace(`/partner?done=${r.orderId}`);
              return '결제됐어요';
            }
            return r.kind === 'fail' ? r.error : '결제됐어요. 배너 검토가 끝나면 게재돼요';
          });
    void job.then((m) => {
      setMsg(m);
      setDone(true);
    });
  }, []);

  return (
    <AuthShell title="카드 결제">
      <p className="mb-6 text-[16px] text-ink" role="status">{msg}</p>
      {done && <Link href="/partner" className={`${primaryBtn} flex items-center justify-center`}>내 광고로</Link>}
    </AuthShell>
  );
}
