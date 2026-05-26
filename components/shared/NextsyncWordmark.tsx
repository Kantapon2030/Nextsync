interface NextsyncWordmarkProps {
  variant?: "hero" | "nav";
  className?: string;
}

export function NextsyncWordmark({
  variant = "nav",
  className = "",
}: NextsyncWordmarkProps) {
  const isHero = variant === "hero";
  const letterClass = isHero ? "sync-letter-hero" : "sync-letter-nav";

  const letters = [
    { char: "S", color: "#FF4A4A", delay: isHero ? "0s" : "0s" },
    { char: "Y", color: "#3B82F6", delay: isHero ? "0.2s" : "0.15s" },
    { char: "N", color: "#FFC107", delay: isHero ? "0.4s" : "0.3s" },
    { char: "C", color: "#10B981", delay: isHero ? "0.6s" : "0.45s" },
  ];

  return (
    <span
      className={`nextsync-wordmark nextsync-wordmark--${variant} ${className}`.trim()}
    >
      <span className="nextsync-wordmark-next">Next</span>
      <span className="nextsync-wordmark-sync" aria-label="SYNC">
        {letters.map(({ char, color, delay }) => (
          <span
            key={char}
            className={letterClass}
            style={{ color, animationDelay: delay }}
          >
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
