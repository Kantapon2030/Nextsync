"use client";

import { useRef, MouseEvent, ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  iconColorClass: string;
  title: string;
  description: string;
}

export function FeatureCard({
  icon,
  iconColorClass,
  title,
  description,
}: FeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--x", `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={cardRef}
      className="feature-card-spotlight glass"
      onMouseMove={handleMouseMove}
      style={{
        background: "rgba(15,22,42,0.6)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "20px",
        padding: "32px 28px",
        transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
        backdropFilter: "blur(12px)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-6px)";
        el.style.borderColor = "rgba(255,255,255,0.15)";
        el.style.boxShadow = "0 12px 30px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "";
        el.style.borderColor = "";
        el.style.boxShadow = "";
      }}
    >
      <div
        className={`card-icon-wrapper ${iconColorClass}`}
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          position: "relative",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 12,
          letterSpacing: "-0.3px",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}
