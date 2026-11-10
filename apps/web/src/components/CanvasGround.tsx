import { useEffect, useRef } from 'react';

/**
 * Atmospheric coordinate ground matching Cointrix:
 * - Pure OLED black transparency with zero grey film
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

      // Crisp coordinate grid lines on total black
      const step = 64;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.022)';
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

      // Subtle coordinate intersection crosshairs
      ctx.fillStyle = 'rgba(216, 199, 181, 0.09)';
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
