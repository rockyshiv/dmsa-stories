"use client";

import { useEffect, useRef } from "react";

/**
 * Myithri's portrait, brought to life on a canvas:
 * - lip sync: the lower lip is drawn in thin vertical strips and moved down by
 *   the loudness of her voice (the centre opens most, the corners stay put),
 *   with a dark mouth and a hint of teeth in the gap;
 * - blinking every few seconds (skin-toned lids close over each eye);
 * - a slow breathing sway, and a small nod when she speaks strongly.
 * Coordinates are in the 760 x 760 source image (public/myithri.webp).
 */

const SRC = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/myithri.webp`;
const IMG = 760;
const SIZE = 480; // canvas pixels (sharp at up to ~240 CSS px on 2x screens)

// The line between her lips runs from (328,437) to (461,413).
const MOUTH = { cx: 395, cy: 431, angle: Math.atan2(-24, 133), half: 64, below: 40, maxOpen: 15 };
const EYES = [
  { x: 280, y: 288, rx: 31, ry: 12.5, rot: -0.14 },
  { x: 456, y: 253, rx: 29, ry: 12.5, rot: -0.2 },
];
const STRIPS = 28;

export default function MyithriFace({
  className,
  level,
  title = "Myithri",
}: {
  className?: string;
  /** Loudness of her voice right now, 0-1 (omit for a still, blinking portrait). */
  level?: () => number;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduceMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let alive = true;
    const img = new Image();
    img.decoding = "async";
    img.src = SRC;

    // The lower lip, cut out once along the (tilted) lip line, with soft edges.
    let lip: HTMLCanvasElement | null = null;
    const buildLip = () => {
      const w = MOUTH.half * 2 + 8;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = MOUTH.below;
      const p = c.getContext("2d")!;
      p.translate(w / 2, 0);
      p.rotate(-MOUTH.angle);
      p.translate(-MOUTH.cx, -MOUTH.cy);
      p.drawImage(img, 0, 0);
      p.setTransform(1, 0, 0, 1, 0, 0);
      p.globalCompositeOperation = "destination-in";
      const down = p.createLinearGradient(0, 0, 0, MOUTH.below);
      down.addColorStop(0, "rgba(0,0,0,1)");
      down.addColorStop(0.62, "rgba(0,0,0,1)");
      down.addColorStop(1, "rgba(0,0,0,0)");
      p.fillStyle = down;
      p.fillRect(0, 0, w, MOUTH.below);
      const across = p.createLinearGradient(0, 0, w, 0);
      across.addColorStop(0, "rgba(0,0,0,0)");
      across.addColorStop(0.1, "rgba(0,0,0,1)");
      across.addColorStop(0.9, "rgba(0,0,0,1)");
      across.addColorStop(1, "rgba(0,0,0,0)");
      p.fillStyle = across;
      p.fillRect(0, 0, w, MOUTH.below);
      lip = c;
    };

    let open = 0;
    let nextBlink = performance.now() + 1500 + Math.random() * 2500;
    let blinkAt = -1;

    const shift = (x: number, h: number) => {
      const u = Math.min(1, Math.abs(x) / MOUTH.half);
      return h * Math.pow(Math.max(0, 1 - u * u), 0.8);
    };

    const draw = (now: number) => {
      if (!alive) return;
      const s = SIZE / IMG;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.clearRect(0, 0, IMG, IMG);
      ctx.drawImage(img, 0, 0, IMG, IMG);

      // --- lips follow her voice
      // (window.__myithriLevel lets a test set the mouth opening directly)
      const forced = (window as unknown as { __myithriLevel?: number }).__myithriLevel;
      const target = typeof forced === "number" ? forced : levelRef.current ? Math.max(0, Math.min(1, levelRef.current())) : 0;
      open += (target > open ? 0.55 : 0.22) * (target - open);
      const h = open * MOUTH.maxOpen;
      if (h > 0.7 && lip) {
        ctx.save();
        ctx.translate(MOUTH.cx, MOUTH.cy);
        ctx.rotate(MOUTH.angle);
        const half = MOUTH.half;
        // the opening: upper lip lifts a touch, lower lip drops
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const x = -half + (i / 24) * half * 2;
          const y = -0.12 * shift(x, h);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let i = 24; i >= 0; i--) {
          const x = -half + (i / 24) * half * 2;
          ctx.lineTo(x, shift(x, h) + 1.5);
        }
        ctx.closePath();
        ctx.fillStyle = "#3a1018";
        ctx.fill();
        if (h > 5) {
          ctx.save();
          ctx.clip();
          ctx.fillStyle = "rgba(244,234,228,0.9)";
          ctx.fillRect(-half * 0.55, -h * 0.12, half * 1.1, Math.min(4.5, h * 0.3));
          ctx.restore();
        }
        // the lower lip, strip by strip
        const w = lip.width;
        const sw = w / STRIPS;
        for (let i = 0; i < STRIPS; i++) {
          const x0 = -w / 2 + i * sw;
          ctx.drawImage(lip, i * sw, 0, sw + 0.6, MOUTH.below, x0, shift(x0 + sw / 2, h), sw + 0.6, MOUTH.below);
        }
        ctx.restore();
      }

      // --- blinking
      if (!reduceMotion && blinkAt < 0 && now > nextBlink) blinkAt = now;
      if (blinkAt >= 0) {
        const t = now - blinkAt;
        const cover = t < 70 ? t / 70 : t < 120 ? 1 : t < 210 ? 1 - (t - 120) / 90 : 0;
        if (t >= 210) {
          blinkAt = -1;
          // now and then a double blink
          nextBlink = now + (Math.random() < 0.15 ? 180 : 2200 + Math.random() * 3800);
        } else {
          for (const e of EYES) {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.rot);
            ctx.beginPath();
            ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
            ctx.clip();
            const g = ctx.createLinearGradient(0, -e.ry, 0, e.ry);
            g.addColorStop(0, "#b56a45");
            g.addColorStop(1, "#c47c55");
            ctx.fillStyle = g;
            const lidY = -e.ry + 2 * e.ry * cover;
            ctx.fillRect(-e.rx, -e.ry, e.rx * 2, lidY + e.ry);
            if (cover > 0.2) {
              ctx.beginPath();
              ctx.moveTo(-e.rx * 0.9, lidY - 1);
              ctx.quadraticCurveTo(0, lidY + 3, e.rx * 0.9, lidY - 1);
              ctx.strokeStyle = "#241410";
              ctx.lineWidth = 2.6;
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }

      // --- breathing sway and a small nod with strong speech
      if (!reduceMotion) {
        const bob = Math.sin(now / 1300) * 0.6 - open * 1.2;
        const tilt = Math.sin(now / 2700) * 0.45 + open * 0.3;
        canvas.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg) scale(${(1.03 + Math.sin(now / 1300) * 0.004).toFixed(4)})`;
      }
      raf = requestAnimationFrame(draw);
    };

    img.onload = () => {
      buildLip();
      raf = requestAnimationFrame(draw);
    };
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={`overflow-hidden ${className || ""}`} role="img" aria-label={title}>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="h-full w-full will-change-transform" />
    </div>
  );
}
