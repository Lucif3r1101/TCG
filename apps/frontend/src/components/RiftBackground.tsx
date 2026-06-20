import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  z: number; // depth 0.3..1 → size/speed/opacity
  vx: number;
  vy: number;
};

// Lightweight animated "rift" background: drifting glowing motes with faint
// links between nearby ones, on a single canvas. No deps, DPR-aware, scales
// particle count to screen size, and falls back to a static frame when the user
// prefers reduced motion.
export function RiftBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const build = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Scale count to area, capped for mobile performance.
      const target = Math.min(90, Math.max(28, Math.round((width * height) / 22000)));
      particles = Array.from({ length: target }, () => {
        const z = rand(0.3, 1);
        return {
          x: rand(0, width),
          y: rand(0, height),
          z,
          vx: rand(-0.12, 0.12) * z,
          vy: rand(-0.35, -0.08) * z // drift gently upward
        };
      });
    };

    const draw = () => {
      g.clearRect(0, 0, width, height);

      // Links between nearby particles (the "rift network" look).
      const maxDist = 130;
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.16;
            g.strokeStyle = `rgba(46, 230, 255, ${alpha})`;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
            g.stroke();
          }
        }
      }

      // Glowing motes.
      for (const p of particles) {
        const r = 1.1 + p.z * 2.2;
        const glow = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
        glow.addColorStop(0, `rgba(120, 245, 220, ${0.5 * p.z})`);
        glow.addColorStop(1, "rgba(120, 245, 220, 0)");
        g.fillStyle = glow;
        g.beginPath();
        g.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
        g.fill();

        g.fillStyle = `rgba(180, 250, 255, ${0.6 * p.z})`;
        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.fill();
      }
    };

    const step = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = rand(0, width);
        }
        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    build();
    if (reduceMotion) {
      draw();
    } else {
      raf = requestAnimationFrame(step);
    }

    const onResize = () => {
      cancelAnimationFrame(raf);
      build();
      if (reduceMotion) draw();
      else raf = requestAnimationFrame(step);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="rift-bg" aria-hidden="true" />;
}
