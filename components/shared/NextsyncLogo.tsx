"use client";

interface NextsyncLogoProps {
  size?: number;
  variant?: "hero" | "nav" | "small";
  className?: string;
}

export function NextsyncLogo({
  size = 200,
  variant = "hero",
  className = "",
}: NextsyncLogoProps) {
  const gradId = `rainbowGrad_${variant}`;
  const filterId = `logoGlow_${variant}`;
  const stdDev = variant === "hero" ? 4 : 3;
  const glowOpacity = variant === "hero" ? 0.5 : 0.4;
  const strokeW = 6;
  const glowStrokeW = 12;

  const wrapClass =
    variant === "hero" ? `hero-logo-float ${className}` : className;

  return (
    <svg
      className={`loop-logo-svg ${wrapClass}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF3366" />
          <stop offset="20%" stopColor="#FF9933" />
          <stop offset="40%" stopColor="#FFFF33" />
          <stop offset="60%" stopColor="#33FF99" />
          <stop offset="80%" stopColor="#3399FF" />
          <stop offset="100%" stopColor="#9933FF" />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={stdDev} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <path
        d="M 50,50 C 35,20 15,20 15,50 C 15,80 35,80 50,50 C 65,20 85,20 85,50 C 85,80 65,80 50,50 Z"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={glowStrokeW}
        strokeLinecap="round"
        opacity={glowOpacity}
        filter={`url(#${filterId})`}
      />

      <path
        className="infinity-path-moving"
        d="M 50,50 C 35,20 15,20 15,50 C 15,80 35,80 50,50 C 65,20 85,20 85,50 C 85,80 65,80 50,50 Z"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
    </svg>
  );
}
