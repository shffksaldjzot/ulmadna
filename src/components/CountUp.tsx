'use client';
// ──────────────────────────────────────────────
// CountUp — 화면에 보일 때 0 → 값으로 1초간 올라가는 숫자
//
// - 서버에서 집계한 값을 props(value)로 받는다(여기서 DB 호출 안 함).
// - 화면에 절반 이상 들어오면 한 번만 시작(IntersectionObserver).
// - prefers-reduced-motion 이면 애니메이션 없이 바로 최종 값.
// - 서버 렌더·검색엔진에는 최종 값이 그대로 들어 있다(시작 전에도 값 표시, 시작 순간만 0에서 출발).
// - suffix: 값 뒤에 붙는 글자(예: "건+").
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';

type Props = { value: number; suffix?: string; duration?: number; className?: string };

export default function CountUp({ value, suffix = '', duration = 1000, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  // 처음엔 최종 값(서버 렌더와 동일) — 애니메이션이 시작될 때만 0부터 다시 센다
  const [n, setN] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 움직임 줄이기 설정이면 그대로 둔다
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect(); // 한 번만
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3); // 끝에서 느려지는 곡선
          setN(Math.round(value * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        setN(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {n.toLocaleString('ko-KR')}
      {suffix}
    </span>
  );
}
