// components/gallery/PhotoCard.tsx
"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";

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
}

export function PhotoCard({ photo, onView }: PhotoCardProps) {
  // Progressive loading: show small thumbnail first, then upgrade to 800px
  const lowSrc = photo.thumbnailSm || photo.thumbnailUrl || photo.driveUrl;
  const highSrc = photo.thumbnailUrl || photo.driveUrl;

  const [src, setSrc] = useState(lowSrc);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = () => {
    setLoaded(true);
    // Upgrade to high-res after low-res loads
    if (src === lowSrc && highSrc !== lowSrc) {
      const img = new window.Image();
      img.onload = () => setSrc(highSrc);
      img.src = highSrc;
    }
  };

  const handleError = () => {
    setSrc("https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=400&q=80");
  };

  return (
    <div
      onClick={() => onView(photo)}
      className="group relative bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-hover)] rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.01] transition-all duration-300 shadow-lg break-inside-avoid mb-3"
    >
      {/* Image container - auto height for masonry */}
      <div className="relative w-full bg-black/40 overflow-hidden">
        {/* Shimmer placeholder */}
        {!loaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--surface)] via-[var(--surface-hover)] to-[var(--surface)] z-10" />
        )}

        <img
          src={src}
          alt={photo.filename}
          loading="lazy"
          decoding="async"
          className={`w-full h-auto object-cover transition-all duration-700 group-hover:scale-[1.04] ${
            loaded ? "opacity-100 blur-0" : "opacity-0 blur-sm"
          }`}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* Face count badge */}
        {photo.faceCount !== undefined && photo.faceCount !== null && photo.faceCount > 0 && (
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[9px] text-[var(--text)] font-semibold px-2 py-0.5 rounded-full select-none border border-[var(--border)] z-20">
            {photo.faceCount} ใบหน้า
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 z-20">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-white/90 truncate max-w-[70%]">{photo.filename}</p>
            <div className="flex items-center gap-1.5">
              <a
                href={photo.driveUrl}
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
}

export default PhotoCard;
