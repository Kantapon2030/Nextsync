// components/gallery/PhotoCard.tsx
"use client";

import { useState, memo, useCallback } from "react";
import { Download, Eye, Check } from "lucide-react";

export interface PhotoData {
  id: string;
  eventId: string;
  photographerId?: string | null;
  driveFileId: string;
  driveUrl: string;
  thumbnailUrl?: string | null;
  thumbnailSm?: string | null;
  filename: string;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  blurScore?: number | null;
  brightness?: number | null;
  faceCount?: number | null;
  status?: string | null;
  createdAt?: string | Date | null;
}

interface PhotoCardProps {
  photo: PhotoData;
  onView: (photo: PhotoData) => void;
  /** Called when checkbox is toggled (multi-select mode) */
  onSelect?: (photo: PhotoData) => void;
  /** Whether this card is in the selected set */
  isSelected?: boolean;
  /** Width of the card cell (from virtualizer) — used for fixed-height layout */
  cellWidth?: number;
  /** Height of the card cell (from virtualizer) */
  cellHeight?: number;
}

export const PhotoCard = memo(function PhotoCard({
  photo,
  onView,
  onSelect,
  isSelected = false,
  cellWidth,
  cellHeight,
}: PhotoCardProps) {
  // Progressive loading: show small thumbnail first, then upgrade to 800px
  const lowSrc = photo.thumbnailSm || photo.thumbnailUrl || photo.driveUrl;
  const highSrc = photo.thumbnailUrl || photo.driveUrl;

  const [src, setSrc] = useState(lowSrc);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    // Upgrade to high-res after low-res loads
    if (src === lowSrc && highSrc !== lowSrc) {
      const img = new window.Image();
      img.onload = () => setSrc(highSrc);
      img.src = highSrc;
    }
  }, [src, lowSrc, highSrc]);

  const handleError = useCallback(() => {
    setSrc(
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%230f1629'/%3E%3Ctext x='50%25' y='45%25' text-anchor='middle' fill='%2364748b' font-size='14' font-family='sans-serif'%3E%E0%B9%84%E0%B8%A1%E0%B9%88%E0%B8%AA%E0%B8%B2%E0%B8%A1%E0%B8%B2%E0%B8%A3%E0%B8%96%E0%B9%82%E0%B8%AB%E0%B8%A5%E0%B8%94%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%A0%E0%B8%B2%E0%B8%9E%E0%B9%84%E0%B8%94%E0%B9%89%3C/text%3E%3Ctext x='50%25' y='62%25' text-anchor='middle' fill='%2364748b' font-size='12' font-family='sans-serif'%3EImage not available%3C/text%3E%3C/svg%3E"
    );
  }, []);

  const handleSelectClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.(photo);
    },
    [onSelect, photo]
  );

  // Compute aspect ratio for skeleton placeholder (masonry mode)
  const hasKnownDimensions =
    photo.width && photo.height && photo.width > 0 && photo.height > 0;
  const aspectRatio = hasKnownDimensions
    ? `${photo.width} / ${photo.height}`
    : "4 / 3";

  // Virtual grid mode: use explicit cell dimensions
  const isVirtual = cellWidth !== undefined && cellHeight !== undefined;
  const containerStyle = isVirtual
    ? { width: cellWidth, height: cellHeight }
    : {};

  return (
    <div
      onClick={() => onView(photo)}
      style={containerStyle}
      className={`group relative bg-[var(--surface)] border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-lg ${
        isVirtual ? "" : "break-inside-avoid mb-3 hover:scale-[1.01]"
      } ${
        isSelected
          ? "border-[var(--accent-blue)] ring-2 ring-[var(--accent-blue)]/40"
          : "border-[var(--border)] hover:border-[var(--border-hover)]"
      }`}
    >
      {/* Selection Checkbox — top-left */}
      {onSelect && (
        <button
          onClick={handleSelectClick}
          aria-label={isSelected ? "ยกเลิกการเลือก" : "เลือกรูปนี้"}
          className={`absolute top-2 left-2 z-30 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
            isSelected
              ? "bg-[var(--accent-blue)] border-[var(--accent-blue)] opacity-100 scale-100"
              : "bg-black/50 border-white/50 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
          } backdrop-blur-sm`}
        >
          {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </button>
      )}

      {/* Image container */}
      <div
        className={`relative w-full bg-black/40 overflow-hidden ${isVirtual ? "h-full" : ""}`}
      >
        {/* Skeleton shimmer placeholder */}
        {!loaded && (
          <div
            className="w-full z-10 relative"
            style={isVirtual ? { height: "100%" } : { aspectRatio }}
          >
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
          </div>
        )}

        <img
          src={src}
          alt={photo.filename}
          loading="lazy"
          decoding="async"
          className={`w-full transition-all duration-700 group-hover:scale-[1.04] ${
            isVirtual ? "h-full object-cover" : "h-auto object-cover"
          } ${loaded ? "opacity-100 blur-0" : "opacity-0 blur-sm absolute inset-0"}`}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* Face count badge */}
        {photo.faceCount !== undefined &&
          photo.faceCount !== null &&
          photo.faceCount > 0 && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-[9px] text-[var(--text)] font-semibold px-2 py-0.5 rounded-full select-none border border-[var(--border)] z-20">
              {photo.faceCount} ใบหน้า
            </div>
          )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 z-20">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-white/90 truncate max-w-[70%]">
              {photo.filename}
            </p>
            <div className="flex items-center gap-1.5">
              <a
                href={`/api/photos/download?id=${photo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg backdrop-blur-sm transition-colors border border-white/10"
                title="ดาวน์โหลด"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <span className="p-1.5 bg-white/15 text-white rounded-lg border border-white/10">
                <Eye className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PhotoCard;
