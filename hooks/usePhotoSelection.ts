// hooks/usePhotoSelection.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { PhotoData } from "@/components/gallery/PhotoCard";

export interface UsePhotoSelectionReturn {
  selected: Set<string>;
  toggle: (photo: PhotoData, shiftHeld?: boolean, index?: number) => void;
  selectAll: (photos: PhotoData[]) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

/**
 * Manages multi-select state for the photo gallery.
 *
 * Features:
 * - Toggle single photo
 * - Shift+click range select (requires caller to pass `index`)
 * - selectAll / clearAll helpers
 * - Stable callback references (useCallback)
 */
export function usePhotoSelection(): UsePhotoSelectionReturn {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);
  // Keep a ref to the full photos array so we can do range selects
  const photosRef = useRef<PhotoData[]>([]);

  const toggle = useCallback(
    (photo: PhotoData, shiftHeld = false, index?: number) => {
      setSelected((prev) => {
        const next = new Set(prev);

        if (
          shiftHeld &&
          lastClickedIndexRef.current !== null &&
          index !== undefined &&
          photosRef.current.length > 0
        ) {
          // Range select between lastClickedIndex and current index
          const from = Math.min(lastClickedIndexRef.current, index);
          const to = Math.max(lastClickedIndexRef.current, index);
          const rangePhotos = photosRef.current.slice(from, to + 1);

          // If the anchor was selected, select the range; otherwise deselect
          const anchorId = photosRef.current[lastClickedIndexRef.current]?.id;
          const shouldSelect = anchorId ? prev.has(anchorId) : true;

          for (const p of rangePhotos) {
            if (shouldSelect) {
              next.add(p.id);
            } else {
              next.delete(p.id);
            }
          }
        } else {
          // Simple toggle
          if (next.has(photo.id)) {
            next.delete(photo.id);
          } else {
            next.add(photo.id);
          }
        }

        if (index !== undefined) {
          lastClickedIndexRef.current = index;
        }
        return next;
      });
    },
    []
  );

  const selectAll = useCallback((photos: PhotoData[]) => {
    photosRef.current = photos;
    setSelected(new Set(photos.map((p) => p.id)));
  }, []);

  const clearAll = useCallback(() => {
    lastClickedIndexRef.current = null;
    setSelected(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selected.has(id),
    [selected]
  );

  return {
    selected,
    toggle,
    selectAll,
    clearAll,
    isSelected,
    selectedCount: selected.size,
  };
}
