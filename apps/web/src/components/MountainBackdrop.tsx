import React from 'react';

interface MountainBackdropProps {
  className?: string;
  height?: number | string;
  showSky?: boolean;
}

/**
 * Atmospheric High-Contrast Mountain Ridge Backdrop (Cointrix Reference Aesthetic):
 * - Radiant warm champagne-sepia sky illumination at the top
 * - High-contrast multi-layer mountain silhouette peaks with rim lighting
 * - Majestic left and right alpine massifs framing the center
 * - Base seamlessly blending into total black #000000
 */
export function MountainBackdrop({
  className = '',
  height = 540,
  showSky = true,
}: MountainBackdropProps) {
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={`mountain-backdrop-wrap ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 520"
        preserveAspectRatio="none"
        className="mountain-svg"
        style={{ height: heightStyle }}
      >
        <defs>
          {/* 1. Luminous Warm Champagne Sky Ambient Gradient */}
          <linearGradient id="cointrixWarmSky" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#dfd6cc" stopOpacity="1" />
            <stop offset="16%" stopColor="#c2b3a3" stopOpacity="0.96" />
            <stop offset="34%" stopColor="#8c7a6b" stopOpacity="0.88" />
            <stop offset="54%" stopColor="#4c3d32" stopOpacity="0.72" />
            <stop offset="74%" stopColor="#1e1612" stopOpacity="0.45" />
            <stop offset="90%" stopColor="#080605" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>

          {/* 2. Top Horizon Flare / Diffused Light Aura */}
          <radialGradient id="horizonAura" cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor="#f7eee4" stopOpacity="0.5" />
            <stop offset="30%" stopColor="#cbbbae" stopOpacity="0.32" />
            <stop offset="65%" stopColor="#5a493c" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* 3. Distant Alpine Peaks (Warm Atmospheric Slate/Sepia) */}
          <linearGradient id="ridgeDistantGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#54473c" stopOpacity="1" />
            <stop offset="45%" stopColor="#322820" stopOpacity="1" />
            <stop offset="100%" stopColor="#120e0b" stopOpacity="1" />
          </linearGradient>

          {/* 4. Mid-range Left Massif */}
          <linearGradient id="ridgeMidLeftGrad" x1="30%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#382e26" stopOpacity="1" />
            <stop offset="50%" stopColor="#221b15" stopOpacity="1" />
            <stop offset="100%" stopColor="#0a0806" stopOpacity="1" />
          </linearGradient>

          {/* 5. Mid-range Right Massif */}
          <linearGradient id="ridgeMidRightGrad" x1="70%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#322922" stopOpacity="1" />
            <stop offset="50%" stopColor="#1c1612" stopOpacity="1" />
            <stop offset="100%" stopColor="#090706" stopOpacity="1" />
          </linearGradient>

          {/* 6. Foreground Foothill Ridge */}
          <linearGradient id="ridgeForeGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#181310" stopOpacity="1" />
            <stop offset="60%" stopColor="#0b0907" stopOpacity="1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </linearGradient>

          {/* 7. Mountain Slope Lit Facet (Warm Sky Reflection) */}
          <linearGradient id="slopeLitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7a6857" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#3e3228" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#120e0a" stopOpacity="0" />
          </linearGradient>

          {/* 8. Mountain Ravine Shadow Facet */}
          <linearGradient id="slopeShadowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#050403" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
          </linearGradient>

          {/* 9. Base Blend to Total Black #000000 */}
          <linearGradient id="baseTotalBlackMist" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* 1. Sky Ambient Warmth & Top Horizon Flare */}
        {showSky && (
          <>
            <rect width="1440" height="520" fill="url(#cointrixWarmSky)" />
            <rect width="1440" height="380" fill="url(#horizonAura)" />

            {/* Faint Starlight / Atmospheric Sparkles */}
            <circle cx="160" cy="55" r="1.3" fill="#ffffff" opacity="0.65" />
            <circle cx="340" cy="85" r="1.1" fill="#f7eee4" opacity="0.75" />
            <circle cx="510" cy="42" r="1.5" fill="#ffffff" opacity="0.55" />
            <circle cx="780" cy="50" r="1.1" fill="#f7eee4" opacity="0.65" />
            <circle cx="1060" cy="70" r="1.4" fill="#ffffff" opacity="0.75" />
            <circle cx="1280" cy="45" r="1.2" fill="#ffffff" opacity="0.55" />
          </>
        )}

        {/* 2. Layer 1: Distant Jagged Alpine Crests across the horizon */}
        <path
          d="M 0 210 L 55 185 L 110 200 L 175 145 L 245 185 L 320 160 L 410 205 L 500 178 L 590 215 L 680 185 L 770 218 L 860 175 L 945 205 L 1030 152 L 1115 190 L 1205 145 L 1290 180 L 1370 155 L 1440 185 L 1440 520 L 0 520 Z"
          fill="url(#ridgeDistantGrad)"
          stroke="rgba(245, 230, 215, 0.45)"
          strokeWidth="1.2"
        />

        {/* 3. Layer 2: Left High Alpine Massif (Slopes down from left peak towards center) */}
        <path
          d="M 0 240 L 45 210 L 105 230 L 180 160 L 255 205 L 335 175 L 430 225 L 525 200 L 630 260 L 730 305 L 750 520 L 0 520 Z"
          fill="url(#ridgeMidLeftGrad)"
          stroke="rgba(255, 245, 230, 0.55)"
          strokeWidth="1.4"
        />

        {/* Left Mountain Shaded Slope Facet */}
        <path
          d="M 180 160 L 255 205 L 290 280 L 210 320 L 120 280 Z"
          fill="url(#slopeLitGrad)"
        />
        <path
          d="M 180 160 L 105 230 L 70 300 L 160 340 L 210 320 Z"
          fill="url(#slopeShadowGrad)"
        />

        {/* 4. Layer 3: Right Alpine Massif (Slopes down from right peak towards center) */}
        <path
          d="M 690 315 L 790 270 L 890 295 L 985 220 L 1080 255 L 1180 185 L 1270 225 L 1355 165 L 1440 200 L 1440 520 L 690 520 Z"
          fill="url(#ridgeMidRightGrad)"
          stroke="rgba(255, 245, 230, 0.5)"
          strokeWidth="1.3"
        />

        {/* Right Mountain Shaded Slope Facet */}
        <path
          d="M 1180 185 L 1270 225 L 1220 310 L 1120 330 L 1080 255 Z"
          fill="url(#slopeLitGrad)"
        />
        <path
          d="M 1180 185 L 1080 255 L 1040 320 L 1140 360 L 1220 310 Z"
          fill="url(#slopeShadowGrad)"
        />

        {/* 5. Layer 4: Foreground Foothills (Low dark crags framing base) */}
        <path
          d="M 0 310 L 95 275 L 215 305 L 345 265 L 485 305 L 620 270 L 760 310 L 900 268 L 1040 305 L 1175 275 L 1310 310 L 1440 280 L 1440 520 L 0 520 Z"
          fill="url(#ridgeForeGrad)"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="0.9"
        />

        {/* 6. Base Smooth Dissolve into Pure Total Black #000000 */}
        <rect y="330" width="1440" height="190" fill="url(#baseTotalBlackMist)" />
      </svg>
    </div>
  );
}
