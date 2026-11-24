'use client';
// ─────────────────────────────────────────────────────────────
// 제작 대행 배너 미리 보기 — 2026년 11월 24일
//   신청 3단계에서 스타일·문구·로고를 바꾸면 잠깐 기다렸다가(0.6초) 서버에 그려 달라고 해서
//   결제하면 실제로 만들어질 배너를 그 자리에서 보여 준다(/api/partner/banner-preview, 같은 그리기 코드).
//   강조 문구가 비어 있으면 부르지 않는다. 실패하면 조용히 이전 그림을 그대로 둔다.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { SLOT_INFO, type SlotKind } from '@/lib/ads/pricing';

export default function BannerPreview({ kind, process, style, intro, headline, phone, logo }: {
  kind: SlotKind; process: string; style: string; intro: string; headline: string; phone: string; logo: File | null;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dropped, setDropped] = useState(''); // 그릴 수 없어 빠진 글자(서버가 알려 줌)
  const seq = useRef(0); // 늦게 온 옛 응답이 새 그림을 덮지 않게 순번을 센다
  const info = SLOT_INFO[kind];

  useEffect(() => {
    if (!headline.trim()) return;
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      const f = new FormData();
      f.set('kind', kind);
      if (process) f.set('process', process);
      if (style) f.set('style', style);
      f.set('intro', intro);
      f.set('headline', headline);
      f.set('phone', phone);
      if (logo) f.set('logo', logo);
      try {
        const r = await fetch('/api/partner/banner-preview', { method: 'POST', body: f });
        if (my !== seq.current) return;
        if (r.ok) {
          const blob = await r.blob();
          setUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(blob);
          });
          setErr('');
          setDropped(decodeURIComponent(r.headers.get('X-Banner-Dropped') ?? ''));
        } else {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          setErr(d.error || '');
        }
      } catch {
        // 연결이 끊기면 이전 그림을 그대로 둔다
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [kind, process, style, intro, headline, phone, logo]);

  // 화면을 떠날 때 그림 주소 정리(메모리 새지 않게)
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!headline.trim()) return null;
  return (
    <div className="mt-4" data-testid="banner-preview">
      <p className="mb-1.5 text-[15px] font-semibold text-ink">미리 보기</p>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-lg border border-line bg-bg transition-opacity ${busy ? 'opacity-60' : ''}`}
        style={{ aspectRatio: `${info.width} / ${info.height}`, maxWidth: info.width * 1.25 }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 서버가 방금 그린 그림(blob 주소)이라 next/image 를 쓸 수 없다
          <img src={url} alt="배너 미리 보기" className="block h-full w-full" />
        ) : (
          <span className="text-[13px] text-ink-2">그리는 중</span>
        )}
      </div>
      {dropped && <p className="mt-1 text-[13px] text-ink-2">빠지는 글자: {dropped}</p>}
      {err && <p className="mt-1 text-[13px] text-ink-2">{err}</p>}
    </div>
  );
}
