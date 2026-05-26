// app/loading.tsx
import React from "react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full select-none relative z-50 text-white gap-6">
      {/* Moving infinite loop logo with drawing stroke animation */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full loop-logo-svg" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="rainbowGradLoading" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF3366" />
              <stop offset="20%" stopColor="#FF9933" />
              <stop offset="40%" stopColor="#FFFF33" />
              <stop offset="60%" stopColor="#33FF99" />
              <stop offset="80%" stopColor="#3399FF" />
              <stop offset="100%" stopColor="#9933FF" />
            </linearGradient>
            <filter id="logoGlowLoading" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path 
            className="infinity-path-glow" 
            d="M 50,50 C 35,20 15,20 15,50 C 15,80 35,80 50,50 C 65,20 85,20 85,50 C 85,80 65,80 50,50 Z" 
            fill="none" 
            stroke="url(#rainbowGradLoading)" 
            strokeWidth="12" 
            strokeLinecap="round" 
            opacity="0.3" 
            filter="url(#logoGlowLoading)" 
          />
          <path 
            className="infinity-path" 
            d="M 50,50 C 35,20 15,20 15,50 C 15,80 35,80 50,50 C 65,20 85,20 85,50 C 85,80 65,80 50,50 Z" 
            fill="none" 
            stroke="url(#rainbowGradLoading)" 
            strokeWidth="6" 
            strokeLinecap="round" 
          />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-[var(--text2)] animate-pulse">
          Nextsync
        </h3>
        <p className="text-[10px] font-bold text-[var(--text3)] animate-pulse uppercase tracking-wider">
          กำลังเตรียมความพร้อมของข้อมูล...
        </p>
      </div>
    </div>
  );
}
