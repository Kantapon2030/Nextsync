// components/gallery/PhotoGrid.tsx
"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  useMemo,
  type KeyboardEvent,
} from "react";
import { PhotoCard, type PhotoData } from "./PhotoCard";
import { PhotoModal } from "./PhotoModal";
import { PhotoSkeleton } from "./PhotoSkeleton";
import { LoadingGrid } from "@/components/shared/LoadingGrid";
import { ImageOff, Loader2, LayoutGrid } from "lucide-react";
import { usePhotoVirtualizer } from "@/hooks/usePhotoVirtualizer";
import type { UsePhotoSelectionReturn } from "@/hooks/usePhotoSelection";

interface PhotoGridProps {
  photos: PhotoData[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Optional multi-select hook — when provided, enables checkbox UI */
  selectionHook?: UsePhotoSelectionReturn;
}

type ColumnCount = 2 | 3 | 4 | 5;

const COLUMN_OPTIONS: { value: ColumnCount; label: string }[] = [
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

// SSR-safe layout effect
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function PhotoGrid({
  photos,
  loading,
  hasMore,
  onLoadMore,
  selectionHook,
}: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [customColumns, setCustomColumns] = useState<ColumnCount | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Deduplicate photos by ID
  const uniquePhotos = useMemo(
    () => Array.from(new Map(photos.map((p) => [p.id, p])).values()),
    [photos]
  );

  // Virtual scroll
  const { virtualRows, totalHeight, colCount } = usePhotoVirtualizer(
    uniquePhotos,
    containerRef,
    customColumns
  );

  // Cell dimensions from virtualizer row
  const cellWidth = useMemo(() => {
    if (!containerRef.current || colCount === 0) return 0;
    const gap = 12; // gap-3 = 12px
    return Math.floor(
      (containerRef.current.clientWidth - gap * (colCount - 1)) / colCount
    );
  }, [colCount]);

  const cellHeight = useMemo(() => {
    return cellWidth > 0 ? Math.round(cellWidth * 1.4) : 300;
  }, [cellWidth]);

  // ── Infinite scroll sentinel ──────────────────────────────────────
  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { threshold: 0.1, rootMargin: "300px" }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loading, onLoadMore]);

  // ── Photo viewer handlers ─────────────────────────────────────────
  const handleView = useCallback(
    (photo: PhotoData) => {
      const idx = uniquePhotos.findIndex((p) => p.id === photo.id);
      setSelectedIndex(idx >= 0 ? idx : 0);
      setSelectedPhoto(photo);
    },
    [uniquePhotos]
  );

  const handleNavigate = useCallback(
    (dir: "prev" | "next") => {
      setSelectedIndex((prev) => {
        const next = dir === "prev" ? prev - 1 : prev + 1;
        const clamped = Math.max(0, Math.min(uniquePhotos.length - 1, next));
        setSelectedPhoto(uniquePhotos[clamped]);
        return clamped;
      });
    },
    [uniquePhotos]
  );

  // ── Keyboard shortcuts (Escape = clear selection, Ctrl+A = select all) ──
  useEffect(() => {
    if (!selectionHook) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") selectionHook.clearAll();
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectionHook.selectAll(uniquePhotos);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionHook, uniquePhotos]);

  // Empty state
  if (!loading && uniquePhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 glass border border-[var(--border)] rounded-3xl max-w-md mx-auto relative z-10">
        <div className="h-12 w-12 bg-[var(--surface)] text-[var(--text2)] border border-[var(--border)] rounded-full flex items-center justify-center mb-4">
          <ImageOff className="h-6 w-6" />
        </div>
        <h4 className="font-bold text-white text-sm">ไม่พบรูปภาพในขณะนี้</h4>
        <p className="text-xs text-[var(--text2)] mt-1 max-w-xs leading-relaxed">
          ยังไม่มีรูปภาพในระบบ หรือภาพถ่ายที่คุณกำลังมองหายังไม่ผ่านการประมวลผล
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* Column selector UI */}
      {uniquePhotos.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-[var(--text3)] font-semibold uppercase tracking-wider flex items-center gap-1">
            <LayoutGrid className="h-3 w-3" /> คอลัมน์
          </span>
          <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
            {COLUMN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCustomColumns(opt.value)}
                className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                  colCount === opt.value
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

      {/* Virtual scroll container */}
      <div ref={containerRef} className="w-full">
        {uniquePhotos.length > 0 && (
          <div
            style={{ height: totalHeight, position: "relative" }}
            aria-label="photo-grid"
          >
            {virtualRows.map((vRow) => (
              <div
                key={vRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: vRow.size,
                  transform: `translateY(${vRow.start}px)`,
                  display: "flex",
                  gap: "12px",
                }}
              >
                {vRow.photos.map((photo) =>
                  cellWidth > 0 ? (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      onView={handleView}
                      onSelect={selectionHook?.toggle}
                      isSelected={selectionHook?.isSelected(photo.id)}
                      cellWidth={cellWidth}
                      cellHeight={cellHeight}
                    />
                  ) : (
                    <PhotoSkeleton
                      key={photo.id}
                      width={cellWidth || 200}
                      height={cellHeight}
                    />
                  )
                )}
                {/* Fill empty slots in last row */}
                {vRow.photos.length < colCount &&
                  Array.from({ length: colCount - vRow.photos.length }).map(
                    (_, i) => (
                      <div
                        key={`empty-${i}`}
                        style={{ width: cellWidth, height: cellHeight }}
                      />
                    )
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading skeleton when loading initial batch */}
      {loading && uniquePhotos.length === 0 && <LoadingGrid count={8} />}

      {/* Infinite scroll trigger sentinel */}
      {hasMore && !loading && (
        <div
          ref={sentinelRef}
          className="h-16 flex items-center justify-center pt-4"
        >
          <Loader2 className="h-6 w-6 text-[var(--accent-purple)] animate-spin" />
        </div>
      )}

      {/* Photo viewer modal */}
      <PhotoModal
        photo={selectedPhoto}
        photos={uniquePhotos}
        currentIndex={selectedIndex}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export default PhotoGrid;
