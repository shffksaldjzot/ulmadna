'use client';
// ─────────────────────────────────────────────────────────────
// 전화 걸기 배너 감싸개 — 2026년 10월 30일
//
// [무슨 기능인가]
//   홈페이지 주소가 없는 광고주의 배너. 누르면
//   - 휴대폰(손가락 화면): 바로 전화 걸기(tel:번호)
//   - PC 등 tel 이 안 되는 환경: 전화번호를 크게 보여 주는 작은 시트(번호 복사 단추)
//   클릭 수는 어느 쪽이든 서버(/api/ad-click?m=call)에 알려 그대로 센다(봇 제외·게재 중 주문만 서버가 판단).
// ─────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';

/** 전화번호에서 숫자와 + 만 남긴다(tel: 주소용) */
const digits = (p: string) => p.replace(/[^\d+]/g, '');

export default function CallBanner({
  orderId, phone, name, count, children,
}: {
  orderId: number;
  phone: string;
  name: string;
  /** false 면 클릭을 세지 않는다(관리자 미리보기) */
  count: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // 배너 누름: 클릭 집계 → 휴대폰이면 전화, 아니면 번호 시트
  const press = () => {
    if (count) {
      try {
        void fetch(`/api/ad-click?o=${orderId}&m=call`, { keepalive: true }).catch(() => undefined);
      } catch {
        // 집계 실패는 무시
      }
    }
    let touch = false;
    try {
      touch = window.matchMedia('(pointer: coarse)').matches;
    } catch {
      touch = false;
    }
    if (touch) window.location.href = `tel:${digits(phone)}`;
    else setOpen(true);
  };

  // 번호 복사(실패하면 표시만 — 사용자가 직접 선택해 복사할 수 있다)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 복사 권한이 없는 환경
    }
  };

  return (
    <>
      <button type="button" onClick={press} className="block w-full h-full p-0 border-0 bg-transparent text-left cursor-pointer" aria-label={`${name} 전화 걸기`}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="전화번호" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[320px] rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] text-neutral-500">{name}</p>
            <p className="mt-2 text-[28px] font-bold tabular-nums text-neutral-900" data-testid="call-number">{phone}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={copy} className="h-11 flex-1 rounded-xl bg-neutral-900 text-[15px] font-semibold text-white">{copied ? '복사됨' : '번호 복사'}</button>
              <button type="button" onClick={() => setOpen(false)} className="h-11 w-20 rounded-xl border border-neutral-300 text-[15px] text-neutral-800">닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
