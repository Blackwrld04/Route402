import React from 'react';

interface MountainBackdropProps {
  className?: string;
  height?: number;
  showSky?: boolean;
}

/**
 * Atmospheric Mountain Ridge Backdrop matching Cointrix:
 * - Soft warm champagne/sepia sky gradient at the top
 * - Layered dark charcoal mountain silhouette ridges in the midground
 * - Misty fog transition at the base
 */
export function MountainBackdrop({
  className = '',
  height = 340,
  showSky = true,
}: MountainBackdropProps) {
  return (
    <div className={`mountain-backdrop-wrap ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        className="mountain-svg"
        style={{ height: `${height}px` }}
      >
        <defs>
          <linearGradient id="cointrixSky" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#352c25" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#221c18" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#090a0d" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cointrixRidge1" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#221e1a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0e1015" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="cointrixRidge2" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#15171d" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#090a0d" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="cointrixMist" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#090a0d" stopOpacity="0" />
            <stop offset="70%" stopColor="#090a0d" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#090a0d" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Sky Ambient Light */}
        {showSky && <rect width="1200" height="400" fill="url(#cointrixSky)" />}

        {/* Distant Ridge Silhouette (Sloping peaks across left and right) */}
        <path
          d="M 0 250 Q 150 170, 310 220 T 630 160 T 920 210 T 1200 170 L 1200 400 L 0 400 Z"
          fill="url(#cointrixRidge1)"
        />

        {/* Closer Foreground Mountain Ridge */}
        <path
          d="M 0 300 Q 180 230, 380 280 T 720 220 T 1040 270 T 1200 240 L 1200 400 L 0 400 Z"
          fill="url(#cointrixRidge2)"
        />

        {/* Base mist / blend */}
        <rect width="1200" height="400" fill="url(#cointrixMist)" />
      </svg>
    </div>
  );
}
