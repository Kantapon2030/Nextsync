// hooks/usePhotoVirtualizer.ts
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PhotoData } from "@/components/gallery/PhotoCard";

export interface VirtualRow {
  index: number;
  start: number;
  size: number;
  photos: PhotoData[];
}

export interface UsePhotoVirtualizerReturn {
  virtualRows: VirtualRow[];
  totalHeight: number;
  colCount: number;
  rowCount: number;
}

/** Compute column count from container pixel width */
function getColCount(width: number): number {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  if (width < 1280) return 4;
  return 5;
}

/**
 * Wraps @tanstack/react-virtual to virtualise a photo gallery grid.
 *
 * - Groups `photos` into rows based on responsive column count.
 * - Estimates row height as `containerWidth / colCount * 1.4` (portrait aspect).
 * - Returns only the rows that TanStack says are visible so the caller renders
 *   ~40-60 DOM nodes regardless of total photo count.
 */
export function usePhotoVirtualizer(
  photos: PhotoData[],
  containerRef: RefObject<HTMLDivElement>,
  customColCount?: number
): UsePhotoVirtualizerReturn {
  const [containerWidth, setContainerWidth] = useState(0);

  // Observe container width changes (responsive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    // Initial read
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [containerRef]);

  const autoColCount = containerWidth > 0 ? getColCount(containerWidth) : 4;
  const colCount = customColCount ?? autoColCount;

  // Estimated row height (portrait-oriented photos default)
  const estimatedRowHeight = containerWidth > 0
    ? Math.round((containerWidth / colCount) * 1.4)
    : 300;

  // Chunk photos into rows
  const rows: PhotoData[][] = [];
  for (let i = 0; i < photos.length; i += colCount) {
    rows.push(photos.slice(i, i + colCount));
  }
  const rowCount = rows.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => {
      // Scroll on the window, not the container
      return typeof window !== "undefined" ? document.documentElement : null;
    },
    estimateSize: useCallback(() => estimatedRowHeight + 12, [estimatedRowHeight]), // +12 gap
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  const virtualRows: VirtualRow[] = virtualItems.map((item) => ({
    index: item.index,
    start: item.start,
    size: item.size,
    photos: rows[item.index] ?? [],
  }));

  return { virtualRows, totalHeight, colCount, rowCount };
}
