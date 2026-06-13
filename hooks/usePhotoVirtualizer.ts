// hooks/usePhotoVirtualizer.ts
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useState, type RefObject } from "react";
import type { PhotoData } from "@/components/gallery/PhotoCard";

export interface VirtualRow {
  index: number;
  start: number;
  size: number;
  photos: PhotoData[];
  rowHeight: number; // เพิ่มใหม่
}

export interface UsePhotoVirtualizerReturn {
  virtualRows: VirtualRow[];
  totalHeight: number;
  colCount: number;
  rowCount: number;
  cellWidth: number;
  gap: number;
}

/** Compute column count from container pixel width */
function getColCount(width: number): number {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  if (width < 1280) return 4;
  return 5;
}

/**
 * คำนวณ height ของ row จาก aspect ratio จริงของรูปในแถว
 * Logic:
 * 1. หา aspect ratio ของแต่ละรูปใน row (width/height)
 * 2. เอา aspect ratio ที่น้อยที่สุด (รูปที่สูงที่สุดในแถว) เพื่อไม่ให้รูปไหน crop
 * 3. cellHeight = cellWidth / minAspectRatio
 * 4. ถ้าไม่มี width/height → fallback = cellWidth * 0.75 (landscape 4:3)
 */
function getRowHeight(rowPhotos: PhotoData[], cellWidth: number): number {
  if (cellWidth <= 0) return 300;
  
  const FALLBACK_RATIO = 4 / 3; // landscape fallback แทน portrait
  
  let minRatio = Infinity;
  for (const photo of rowPhotos) {
    if (photo.width && photo.height && photo.width > 0 && photo.height > 0) {
      const ratio = photo.width / photo.height;
      if (ratio < minRatio) minRatio = ratio;
    }
  }
  
  const effectiveRatio = minRatio === Infinity ? FALLBACK_RATIO : minRatio;
  
  // clamp: ไม่สูงเกิน 90vh และไม่ต่ำกว่า 100px
  const height = Math.round(cellWidth / effectiveRatio);
  const maxAllowedHeight = typeof window !== "undefined" ? window.innerHeight * 0.9 : 1000;
  return Math.max(100, Math.min(height, maxAllowedHeight));
}

/**
 * Wraps @tanstack/react-virtual to virtualise a photo gallery grid.
 *
 * - Groups `photos` into rows based on responsive column count.
 * - Estimates row height based on dynamic row heights.
 * - Returns only the rows that TanStack says are visible.
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

  const isMobile = containerWidth < 640;
  const gap = isMobile ? 8 : 12;

  // คำนวณ cellWidth ภายใน hook
  const cellWidth = containerWidth > 0
    ? Math.floor((containerWidth - gap * (colCount - 1)) / colCount)
    : 0;

  // Chunk photos into rows
  const rows: PhotoData[][] = [];
  for (let i = 0; i < photos.length; i += colCount) {
    rows.push(photos.slice(i, i + colCount));
  }
  const rowCount = rows.length;

  // คำนวณ heights สำหรับแต่ละ row
  const rowHeights = rows.map((row) => getRowHeight(row, cellWidth));

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => {
      // Scroll on the window, not the container
      return typeof window !== "undefined" ? document.documentElement : null;
    },
    estimateSize: useCallback((index) => (rowHeights[index] ?? 300) + gap, [rowHeights, gap]),
    overscan: isMobile ? 2 : 3, // dynamic overscan
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  const virtualRows: VirtualRow[] = virtualItems.map((item) => ({
    index: item.index,
    start: item.start,
    size: item.size,
    photos: rows[item.index] ?? [],
    rowHeight: rowHeights[item.index] ?? 300,
  }));

  return { virtualRows, totalHeight, colCount, rowCount, cellWidth, gap };
}
