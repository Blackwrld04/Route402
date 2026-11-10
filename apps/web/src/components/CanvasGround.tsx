import { useEffect, useRef } from 'react';

/**
 * Atmospheric coordinate ground matching Cointrix:
 * - Subtle warm horizon aura at the top
 * - Distant mountain silhouettes in deep charcoal
 * - Crisp coordinate grid with deterministic intersection crosshairs
 */
export function CanvasGround() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // 1. Soft top warm horizon illumination
      const horizonGrad = ctx.createRadialGradient(
        w / 2,
        0,
        10,
        w / 2,
        0,
        Math.max(w * 0.7, 500),
      );
      horizonGrad.addColorStop(0, 'rgba(216, 199, 181, 0.075)');
      horizonGrad.addColorStop(0.5, 'rgba(180, 160, 140, 0.025)');
      horizonGrad.addColorStop(1, 'rgba(10, 11, 14, 0)');
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, 0, w, Math.min(h, 900));

      // 2. Faint mountain silhouette in the background (Cointrix landscape)
      const mountainY = Math.min(h * 0.42, 420);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.016)';
      ctx.beginPath();
      ctx.moveTo(0, mountainY + 120);
      ctx.lineTo(w * 0.15, mountainY + 40);
      ctx.lineTo(w * 0.32, mountainY + 80);
      ctx.lineTo(w * 0.5, mountainY + 20);
      ctx.lineTo(w * 0.68, mountainY + 70);
      ctx.lineTo(w * 0.85, mountainY + 30);
      ctx.lineTo(w, mountainY + 110);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Second closer ridge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.012)';
      ctx.beginPath();
      ctx.moveTo(0, mountainY + 160);
      ctx.lineTo(w * 0.22, mountainY + 90);
      ctx.lineTo(w * 0.42, mountainY + 130);
      ctx.lineTo(w * 0.62, mountainY + 85);
      ctx.lineTo(w * 0.8, mountainY + 120);
      ctx.lineTo(w, mountainY + 95);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // 3. Crisp coordinate grid lines
      const step = 64;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.024)';
      ctx.lineWidth = 1;

      for (let x = (w % step) / 2; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
        ctx.stroke();
      }

      for (let y = 72; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
        ctx.stroke();
      }

      // 4. Subtle coordinate intersection crosshairs
      ctx.fillStyle = 'rgba(216, 199, 181, 0.08)';
      let seed = 402;
      for (let x = (w % step) / 2; x < w; x += step * 2) {
        for (let y = 72; y < h; y += step * 2) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          if (seed % 6 === 0) {
            ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
          }
        }
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  return <canvas ref={ref} className="ground-canvas" aria-hidden="true" />;
}
