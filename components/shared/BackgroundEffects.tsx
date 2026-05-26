"use client";

import { useEffect, useRef } from "react";

const ICON_PATHS: Record<string, string> = {
  camera:
    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>',
  face: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="12" r="3"></circle>',
  lightning:
    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
  photo:
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>',
  star: '<path d="M12 3C12 7.97 7.97 12 3 12C7.97 12 12 16.03 12 21C12 16.03 16.03 12 21 12C16.03 12 12 7.97 12 3Z" fill="currentColor"></path>',
};

const PARTICLE_CONFIGS = [
  { type: "face", x: 10, y: 28, size: 28, speed: 0.03, delay: 0 },
  { type: "camera", x: 23, y: 36, size: 24, speed: 0.05, delay: 1 },
  { type: "photo", x: 24, y: 52, size: 20, speed: 0.04, delay: 2 },
  { type: "lightning", x: 12, y: 68, size: 24, speed: 0.06, delay: 0.5 },
  { type: "lightning", x: 89, y: 31, size: 20, speed: 0.05, delay: 1.5 },
  { type: "camera", x: 74, y: 40, size: 22, speed: 0.04, delay: 3 },
  { type: "face", x: 71, y: 65, size: 20, speed: 0.03, delay: 2 },
  { type: "lightning", x: 84, y: 76, size: 22, speed: 0.06, delay: 0.8 },
  {
    type: "star",
    x: 94,
    y: 92,
    size: 42,
    speed: 0.08,
    delay: 0,
    color: "#f3f4f6",
    opacity: 0.7,
  },
];

const STAR_DATA = Array.from({ length: 45 }, (_, i) => ({
  x: ((i * 47 + 13) % 97) + 1,
  y: ((i * 31 + 7) % 95) + 1,
  size: ((i * 17) % 3) + 1,
  delay: ((i * 7) % 40) / 10,
  duration: 3 + ((i * 11) % 40) / 10,
}));

export function BackgroundEffects() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const glowBlue = document.querySelector<HTMLElement>(".glow-blob-blue");
    const glowPurple = document.querySelector<HTMLElement>(".glow-blob-purple");
    const floatEls = container.querySelectorAll<HTMLElement>(".floating-icon-el");

    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      floatEls.forEach((el, i) => {
        const cfg = PARTICLE_CONFIGS[i];
        if (!cfg) return;
        el.style.transform = `translate(${(e.clientX - cx) * cfg.speed}px, ${(e.clientY - cy) * cfg.speed}px)`;
      });

      if (glowBlue) {
        glowBlue.style.transform = `translate(${(e.clientX - cx) * -0.015}px, ${(e.clientY - cy) * -0.015}px)`;
      }
      if (glowPurple) {
        glowPurple.style.transform = `translate(${(e.clientX - cx) * -0.02}px, ${(e.clientY - cy) * -0.02}px)`;
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <>
      <div className="glow-blob glow-blob-blue" />
      <div className="glow-blob glow-blob-purple" />

      <div ref={containerRef} className="stars-container" aria-hidden="true">
        {STAR_DATA.map((s, i) => (
          <div
            key={`star-${i}`}
            className="twinkle-star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}

        {PARTICLE_CONFIGS.map((cfg, i) => (
          <div
            key={`icon-${i}`}
            className="floating-icon-el"
            style={{
              left: `${cfg.x}%`,
              top: `${cfg.y}%`,
              animationDelay: `${cfg.delay}s`,
              animationDuration: `${5 + (i % 5)}s`,
              color: cfg.color ?? "rgba(255,255,255,0.4)",
              opacity: cfg.opacity ?? 0.22,
            }}
          >
            <svg
              width={cfg.size}
              height={cfg.size}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: ICON_PATHS[cfg.type] }}
            />
          </div>
        ))}
      </div>

      <div className="rainbow-bar" aria-hidden="true" />
    </>
  );
}
