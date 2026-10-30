'use client';
// ─────────────────────────────────────────────────────────────
// 결제 완료 안내 카드 — 내 광고 화면 맨 위 (2026-10-30)
//   /partner?done=<주문id> 로 들어왔을 때만 보인다. [닫기]를 누르면 주소에서 done 을 지워 다시 안 뜬다.
// ─────────────────────────────────────────────────────────────
import { useRouter } from 'next/navigation';
import { Card } from './_ui';

/** kind: free=0원 신청 · design=제작 대행 · review=직접 올린 배너 */
export default function DoneCard({ kind, design = false }: { kind: 'free' | 'design' | 'review'; design?: boolean }) {
  const router = useRouter();
  const [title, sub] =
    kind === 'free'
      ? ['신청 완료', design ? '3영업일 안에 시안을 보내 드려요' : '배너 검토 뒤 게재돼요(보통 1영업일)']
      : kind === 'design'
        ? ['결제 완료', '3영업일 안에 시안을 보내 드려요']
        : ['결제 완료', '배너 검토 뒤 게재돼요(보통 1영업일)'];
  return (
    <div data-testid="done-card"><Card className="mb-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[16px] font-semibold text-safe">{title}</p>
          <p className="mt-0.5 text-[14px] text-ink">{sub}</p>
        </div>
        <button type="button" className="flex h-11 shrink-0 items-center px-1 text-[14px] text-ink-2" onClick={() => router.replace('/partner')}>
          닫기
        </button>
      </div>
    </Card></div>
  );
}
