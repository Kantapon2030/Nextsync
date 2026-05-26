// components/gallery/PhotoGrid.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PhotoCard, PhotoData } from "./PhotoCard";
import { PhotoModal } from "./PhotoModal";
import { LoadingGrid } from "@/components/shared/LoadingGrid";
import { ImageOff, Loader2, LayoutGrid, Rows3 } from "lucide-react";

interface PhotoGridProps {
  photos: PhotoData[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

type ColumnCount = 2 | 3 | 4 | 5;

const COLUMN_OPTIONS: { value: ColumnCount; label: string }[] = [
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const COLUMN_CLASS: Record<ColumnCount, string> = {
  2: "columns-2",
  3: "columns-2 sm:columns-3",
  4: "columns-2 sm:columns-3 md:columns-4",
  5: "columns-2 sm:columns-3 md:columns-4 lg:columns-5",
};

export function PhotoGrid({ photos, loading, hasMore, onLoadMore }: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [columns, setColumns] = useState<ColumnCount>(4);
  const observerRef = useRef<HTMLDivElement>(null);

  // Deduplicate photos by ID to prevent key duplication warnings on React rendering
  const uniquePhotos = Array.from(new Map(photos.map((p) => [p.id, p])).values());

  // IntersectionObserver for infinite scroll — threshold 0.1 for early trigger
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    const currentTarget = observerRef.current;
    if (currentTarget) observer.observe(currentTarget);
    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, loading, onLoadMore]);

  const handleView = useCallback((photo: PhotoData) => {
    const idx = uniquePhotos.findIndex((p) => p.id === photo.id);
    setSelectedIndex(idx >= 0 ? idx : 0);
    setSelectedPhoto(photo);
  }, [uniquePhotos]);

  const handleNavigate = useCallback((dir: "prev" | "next") => {
    setSelectedIndex((prev) => {
      const next = dir === "prev" ? prev - 1 : prev + 1;
      const clamped = Math.max(0, Math.min(uniquePhotos.length - 1, next));
      setSelectedPhoto(uniquePhotos[clamped]);
      return clamped;
    });
  }, [uniquePhotos]);

  return (
    <div className="space-y-4 select-none">
      {/* Column count selector */}
      {uniquePhotos.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-[var(--text3)] font-semibold uppercase tracking-wider flex items-center gap-1">
            <LayoutGrid className="h-3 w-3" /> คอลัมน์
          </span>
          <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
            {COLUMN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setColumns(opt.value)}
                className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                  columns === opt.value
                    ? "bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] text-white shadow-sm"
                    : "text-[var(--text2)] hover:text-white hover:bg-[var(--surface-hover)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Masonry Grid */}
      {uniquePhotos.length > 0 ? (
        <div className={`${COLUMN_CLASS[columns]} gap-3`}>
          {uniquePhotos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onView={handleView}
            />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center justify-center text-center p-12 glass border border-[var(--border)] rounded-3xl max-w-md mx-auto relative z-10">
            <div className="h-12 w-12 bg-[var(--surface)] text-[var(--text2)] border border-[var(--border)] rounded-full flex items-center justify-center mb-4">
              <ImageOff className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-white text-sm">ไม่พบรูปภาพในขณะนี้</h4>
            <p className="text-xs text-[var(--text2)] mt-1 max-w-xs leading-relaxed">
              ยังไม่มีรูปภาพในระบบ หรือภาพถ่ายที่คุณกำลังมองหายังไม่ผ่านการประมวลผล
            </p>
          </div>
        )
      )}

      {/* Loading skeleton */}
      {loading && <LoadingGrid count={8} />}

      {/* Infinite scroll trigger */}
      {hasMore && !loading && (
        <div ref={observerRef} className="h-16 flex items-center justify-center pt-4">
          <Loader2 className="h-6 w-6 text-[var(--accent-purple)] animate-spin" />
        </div>
      )}

      {/* Photo viewer modal */}
      <PhotoModal
        photo={selectedPhoto}
        photos={photos}
        currentIndex={selectedIndex}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export default PhotoGrid;
