// components/gallery/PhotoSkeleton.tsx
"use client";

interface PhotoSkeletonProps {
  width: number;
  height: number;
}

/**
 * Skeleton card for virtual scroll rows.
 * Dimensions are explicit (from virtualizer) to guarantee zero layout shift.
 */
export function PhotoSkeleton({ width, height }: PhotoSkeletonProps) {
  return (
    <div
      style={{ width, height }}
      className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden"
    >
      {/* Shimmer sweep */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface)] via-[var(--surface-hover)] to-[var(--surface)]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 60%, transparent 100%)",
            animation: "shimmer 1.8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Placeholder icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 select-none">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-[var(--text3)]"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    </div>
  );
}

export default PhotoSkeleton;
