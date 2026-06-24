"use client";

// ──────────────────────────────────────────────
// 블로그 스포일러 — 스레드/iMessage "글자가 먼지로 흩날리는" 효과
// 핵심: 입자를 직사각형 면적에 균일하게 까는 게 아니라, 표 내용(숫자·선)의
//       "실제 글자 모양"대로만 뿌려서 글자가 부서지는 느낌을 냄.
//  1) html2canvas로 표(.blog-spoiler-inner)를 한 번 이미지로 캡처
//     - html2canvas는 CSS blur 필터를 무시하므로, 화면엔 흐리게 보여도 선명히 캡처됨(누출 X)
//  2) 어두운(글자) 픽셀 위치에만 입자를 생성 → 글자 모양 먼지 구름
//  3) 평소엔 미세하게 일렁(지터+깜빡), 탭하면 바깥으로 흩어지며 표가 드러남
//  점진적 향상: 캡처 실패/JS 없음 → 기존 CSS 폴백(체크박스+흐림)이 동작 → SEO/접근성 안전
//  표 내용은 항상 정적 HTML로 DOM에 존재(캔버스는 장식)
// ──────────────────────────────────────────────

import { useEffect } from "react";

// 입자 한 개
interface Particle {
  ox: number; // 원점(글자 픽셀 위치)
  oy: number;
  x: number;
  y: number;
  vx: number; // 흩어질 때 속도
  vy: number;
  a: number; // 투명도(깜빡임)
  r: number; // 크기(px)
  cr: number; // 색(샘플한 픽셀)
  cg: number;
  cb: number;
}

const MAX_PARTICLES = 4200; // 성능 상한(모바일 고려)

export function BlogSpoilerInk() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];
    let cancelled = false;

    const init = async () => {
      const spoilers = Array.from(
        document.querySelectorAll<HTMLElement>(".blog-spoiler")
      );
      if (spoilers.length === 0) return;

      // html2canvas 동적 로드(블로그 페이지에서만, 초기 번들 영향 X)
      let html2canvas: typeof import("html2canvas").default;
      try {
        html2canvas = (await import("html2canvas")).default;
      } catch {
        return; // 로드 실패 → CSS 폴백 유지
      }
      if (cancelled) return;

      for (const spoiler of spoilers) {
        const cover = spoiler.querySelector<HTMLElement>(".blog-spoiler-cover");
        const inner = spoiler.querySelector<HTMLElement>(".blog-spoiler-inner");
        const cb = spoiler.querySelector<HTMLInputElement>(".blog-spoiler-cb");
        if (!cover || !inner) continue;

        const w = Math.max(1, Math.round(cover.getBoundingClientRect().width));
        const h = Math.max(1, Math.round(cover.getBoundingClientRect().height));

        // 1) 표를 선명하게 캡처 (blur 필터는 html2canvas가 무시 → 누출 없음)
        let shot: HTMLCanvasElement;
        try {
          shot = await html2canvas(inner, {
            backgroundColor: null,
            scale: 1,
            logging: false,
            useCORS: true,
          });
        } catch {
          continue; // 캡처 실패 → 이 스포일러는 CSS 폴백 유지
        }
        if (cancelled) return;

        // 2) 어두운 픽셀(글자/선) 위치 샘플링
        const sctx = shot.getContext("2d");
        if (!sctx) continue;
        const iw = shot.width;
        const ih = shot.height;
        if (iw < 2 || ih < 2) continue;
        const data = sctx.getImageData(0, 0, iw, ih).data;

        const candidates: Array<{ x: number; y: number; cr: number; cg: number; cb: number }> = [];
        const step = 2; // 샘플 간격(px)
        for (let y = 0; y < ih; y += step) {
          for (let x = 0; x < iw; x += step) {
            const idx = (y * iw + x) * 4;
            const al = data[idx + 3];
            if (al < 40) continue; // 투명 영역 제외
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum > 200) continue; // 옅은 경계(AA)까지 잘라 또렷한 글자/선만 남김
            candidates.push({ x: (x / iw) * w, y: (y / ih) * h, cr: r, cg: g, cb: b });
          }
        }
        if (candidates.length === 0) continue;

        // 너무 많으면 확률적으로 솎아냄(상한)
        const keep = candidates.length > MAX_PARTICLES ? MAX_PARTICLES / candidates.length : 1;
        const particles: Particle[] = [];
        for (const c of candidates) {
          if (keep < 1 && Math.random() > keep) continue;
          // 살짝 흩뜨려 글자를 "읽히지 않게" — 모양은 남고 글자는 흐릿
          const jx = (Math.random() - 0.5) * 1.8;
          const jy = (Math.random() - 0.5) * 1.8;
          particles.push({
            ox: c.x + jx,
            oy: c.y + jy,
            x: c.x + jx,
            y: c.y + jy,
            vx: 0,
            vy: 0,
            a: 0.6 + Math.random() * 0.4,
            r: 1.2 + Math.random() * 1.0,
            cr: c.cr,
            cg: c.cg,
            cb: c.cb,
          });
        }
        if (particles.length === 0) continue;

        // 3) 캔버스 설치 + 애니메이션 (여기서부터 JS 모드로 전환)
        spoiler.classList.add("js-ink");
        const canvas = document.createElement("canvas");
        canvas.className = "blog-spoiler-canvas";
        cover.insertBefore(canvas, cover.firstChild);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        let revealed = false;
        let disperse = 0; // 흩어짐 진행도 0~1
        let raf = 0;

        const drawOnce = () => {
          ctx.clearRect(0, 0, w, h);
          for (const p of particles) {
            ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${p.a})`;
            ctx.fillRect(p.x, p.y, p.r, p.r);
          }
        };

        const frame = () => {
          ctx.clearRect(0, 0, w, h);
          const fade = revealed ? Math.max(0, 1 - disperse) : 1;
          for (const p of particles) {
            if (!revealed) {
              // 원점 주변에서 미세하게 일렁 + 깜빡 → 글자가 살아 움직이는 먼지
              p.x = p.ox + (Math.random() - 0.5) * 2.4;
              p.y = p.oy + (Math.random() - 0.5) * 2.4;
              p.a += (Math.random() - 0.5) * 0.2;
              if (p.a < 0.5) p.a = 0.5;
              else if (p.a > 1) p.a = 1;
            } else {
              // 흩어짐 — 부여된 속도로 날아가며 페이드
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.05;
            }
            ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${p.a * fade})`;
            ctx.fillRect(p.x, p.y, p.r, p.r);
          }
          if (revealed) {
            disperse += 0.035;
            if (disperse >= 1) {
              canvas.remove();
              return;
            }
          }
          raf = requestAnimationFrame(frame);
        };

        const reveal = (e?: Event) => {
          // 커버가 <label>이라 클릭 시 브라우저가 체크박스를 토글함.
          // JS에서도 체크하면 "내 설정 → 라벨 기본동작이 다시 토글" 로 도로 꺼져
          // 블러가 안 풀림. 기본동작을 막고 JS가 직접 체크 상태를 관리한다.
          if (e) e.preventDefault();
          if (revealed) return;
          revealed = true;
          if (cb) cb.checked = true; // CSS 흐림 제거
          cover.style.pointerEvents = "none"; // 이후 표 클릭 가능
          cover.style.background = "transparent"; // 불투명 베일 페이드(CSS transition)
          spoiler.classList.add("is-revealed"); // 힌트 페이드

          if (reduceMotion) {
            canvas.remove();
            return;
          }
          // 각 입자에 중심 바깥 방향 속도 부여(흩어짐)
          for (const p of particles) {
            const dx = p.x - w / 2;
            const dy = p.y - h / 2;
            const d = Math.hypot(dx, dy) || 1;
            const sp = 2 + Math.random() * 4;
            p.vx = (dx / d) * sp + (Math.random() - 0.5) * 2;
            p.vy = (dy / d) * sp - Math.random() * 2.5;
          }
        };

        cover.addEventListener("click", reveal);

        if (reduceMotion) drawOnce();
        else raf = requestAnimationFrame(frame);

        cleanups.push(() => {
          cancelAnimationFrame(raf);
          cover.removeEventListener("click", reveal);
          canvas.remove();
          spoiler.classList.remove("js-ink", "is-revealed");
        });
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
