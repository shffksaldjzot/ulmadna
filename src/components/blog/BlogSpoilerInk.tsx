"use client";

// ──────────────────────────────────────────────
// 블로그 스포일러 — iMessage "인비저블 잉크"풍 캔버스 입자 효과
// 정적 HTML로 들어간 .blog-spoiler 를 클라이언트에서 "점진적 향상"으로 강화.
//  - 곱고 촘촘한 입자가 노이즈처럼 일렁(미세 지터 + 밝기 깜빡)
//  - 탭하면 입자가 바깥으로 흩어지며(disperse) 표가 드러남
//  - JS가 없거나 실패하면 기존 CSS 폴백(체크박스+흐림+CSS 입자)이 그대로 동작 → SEO/접근성 안전
//  - 표 내용은 항상 DOM에 그대로 존재(캔버스는 장식일 뿐)
// ──────────────────────────────────────────────

import { useEffect } from "react";

// 입자 한 개
interface Particle {
  x: number;
  y: number;
  vx: number; // 흩어질 때 속도
  vy: number;
  a: number; // 투명도(깜빡임)
  r: number; // 크기(px)
  tone: number; // 0~1 밝기 톤(회색~흰색)
}

export function BlogSpoilerInk() {
  useEffect(() => {
    // 모션 최소화 사용자 여부
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spoilers = Array.from(
      document.querySelectorAll<HTMLElement>(".blog-spoiler")
    );
    const cleanups: Array<() => void> = [];

    spoilers.forEach((spoiler) => {
      const cover = spoiler.querySelector<HTMLElement>(".blog-spoiler-cover");
      const cb = spoiler.querySelector<HTMLInputElement>(".blog-spoiler-cb");
      if (!cover) return;

      // JS 모드 표시 → CSS 입자/베일 숨기고 캔버스로 대체(스타일은 blog.css)
      spoiler.classList.add("js-ink");

      // 캔버스 삽입 (커버 맨 앞 = 텍스트 힌트 뒤쪽)
      const canvas = document.createElement("canvas");
      canvas.className = "blog-spoiler-canvas";
      cover.insertBefore(canvas, cover.firstChild);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let w = 0;
      let h = 0;
      let particles: Particle[] = [];
      let revealed = false;
      let disperse = 0; // 흩어짐 진행도 0~1
      let raf = 0;

      // 커버 크기에 맞춰 캔버스/입자 재구성
      const build = () => {
        const rect = cover.getBoundingClientRect();
        w = Math.max(1, Math.round(rect.width));
        h = Math.max(1, Math.round(rect.height));
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 밀도 — 면적 비례, 상한(성능)
        const count = Math.min(900, Math.max(120, Math.floor((w * h) / 140)));
        particles = new Array(count).fill(0).map(() => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0,
          vy: 0,
          a: 0.3 + Math.random() * 0.6,
          r: 0.5 + Math.random() * 1.2,
          tone: Math.random(),
        }));
      };

      // 베일 베이스(글자 읽기 차단) — 따뜻한 다크 톤
      const drawVeil = (alpha: number) => {
        ctx.fillStyle = `rgba(58,46,34,${0.52 * alpha})`;
        ctx.fillRect(0, 0, w, h);
      };

      // 정적 1프레임(모션 최소화용)
      const drawStatic = () => {
        ctx.clearRect(0, 0, w, h);
        drawVeil(1);
        for (const p of particles) {
          const light = 185 + Math.floor(p.tone * 70);
          ctx.fillStyle = `rgba(${light},${light},${light},${p.a})`;
          ctx.fillRect(p.x, p.y, p.r, p.r);
        }
      };

      const frame = () => {
        ctx.clearRect(0, 0, w, h);
        const fade = revealed ? Math.max(0, 1 - disperse) : 1;
        if (!revealed) drawVeil(1);
        else drawVeil(fade);

        for (const p of particles) {
          if (!revealed) {
            // 미세 지터 + 밝기 깜빡 → 모래/노이즈 일렁임
            p.x += (Math.random() - 0.5) * 0.7;
            p.y += (Math.random() - 0.5) * 0.7;
            p.a += (Math.random() - 0.5) * 0.18;
            if (p.a < 0.15) p.a = 0.15;
            else if (p.a > 0.95) p.a = 0.95;
          } else {
            // 흩어짐 — 부여된 속도로 날아가며 페이드
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.06; // 살짝 아래로 가속
          }
          const light = 185 + Math.floor(p.tone * 70);
          ctx.fillStyle = `rgba(${light},${light},${light},${p.a * fade})`;
          ctx.fillRect(p.x, p.y, p.r, p.r);
        }

        if (revealed) {
          disperse += 0.04;
          if (disperse >= 1) {
            canvas.remove();
            return; // 애니메이션 종료
          }
        }
        raf = requestAnimationFrame(frame);
      };

      // 공개 처리
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        if (cb) cb.checked = true; // CSS 흐림 제거 토글도 함께
        cover.style.pointerEvents = "none"; // 이후 표 클릭 가능
        // 힌트 텍스트 페이드
        spoiler.classList.add("is-revealed");

        if (reduceMotion) {
          // 모션 최소화 — 즉시 제거
          canvas.remove();
          return;
        }
        // 각 입자에 중심에서 바깥 방향 속도 부여
        for (const p of particles) {
          const dx = p.x - w / 2;
          const dy = p.y - h / 2;
          const d = Math.hypot(dx, dy) || 1;
          const sp = 2 + Math.random() * 4;
          p.vx = (dx / d) * sp + (Math.random() - 0.5) * 2;
          p.vy = (dy / d) * sp - Math.random() * 2;
        }
      };

      const onResize = () => {
        if (!revealed) build();
      };

      cover.addEventListener("click", reveal);
      window.addEventListener("resize", onResize);

      build();
      if (reduceMotion) drawStatic();
      else raf = requestAnimationFrame(frame);

      cleanups.push(() => {
        cancelAnimationFrame(raf);
        cover.removeEventListener("click", reveal);
        window.removeEventListener("resize", onResize);
        canvas.remove();
        spoiler.classList.remove("js-ink", "is-revealed");
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
