// components/gallery/SelectionBar.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import {
  Download,
  CheckSquare,
  XCircle,
  FolderOpen,
  Loader2,
} from "lucide-react";
import type { PhotoData } from "@/components/gallery/PhotoCard";
import type { UsePhotoSelectionReturn } from "@/hooks/usePhotoSelection";

interface SelectionBarProps {
  selectionHook: UsePhotoSelectionReturn;
  allPhotos: PhotoData[];
}

interface DownloadProgress {
  current: number;
  total: number;
}

/**
 * Floating action bar shown when photos are selected.
 *
 * Download strategy:
 *   A — File System Access API (Chrome/Edge): user picks a folder, files are
 *       written directly without popup-blocker interference.
 *   B — Fallback (Safari/Firefox): sequential <a> tag clicks with 800 ms delay.
 *
 * Progress is shown inline; a cancel button aborts mid-download.
 */
export function SelectionBar({ selectionHook, allPhotos }: SelectionBarProps) {
  const { selected, selectedCount, clearAll, selectAll } = selectionHook;
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const getSelectedPhotos = useCallback((): PhotoData[] => {
    return allPhotos.filter((p) => selected.has(p.id));
  }, [allPhotos, selected]);

  // ── Strategy A: File System Access API ──────────────────────────
  const downloadWithFSA = useCallback(async (photos: PhotoData[]) => {
    try {
      const dir = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      cancelledRef.current = false;
      setProgress({ current: 0, total: photos.length });

      for (let i = 0; i < photos.length; i++) {
        if (cancelledRef.current) break;

        const photo = photos[i];
        try {
          const res = await fetch(`/api/photos/download?id=${photo.id}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const fileHandle = await dir.getFileHandle(
            photo.filename || `nextsync_${photo.id}.jpg`,
            { create: true }
          );
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err) {
          console.error(`Failed to download ${photo.filename}:`, err);
        }

        setProgress({ current: i + 1, total: photos.length });
      }

      if (!cancelledRef.current) {
        showToast(`ดาวน์โหลดเสร็จแล้ว ${photos.length} ไฟล์ ✓`);
        clearAll();
      }
    } catch (err: unknown) {
      // User cancelled directory picker or permission denied
      if ((err as DOMException)?.name !== "AbortError") {
        console.error("FSA download error:", err);
      }
    } finally {
      setProgress(null);
    }
  }, [clearAll, showToast]);

  // ── Strategy B: Sequential <a> tag fallback ───────────────────────
  const downloadSequential = useCallback(async (photos: PhotoData[]) => {
    cancelledRef.current = false;
    setProgress({ current: 0, total: photos.length });
    showToast("ไฟล์จะถูกบันทึกที่โฟลเดอร์ Downloads ของคุณ");

    for (let i = 0; i < photos.length; i++) {
      if (cancelledRef.current) break;

      const photo = photos[i];
      try {
        const a = document.createElement("a");
        a.href = `/api/photos/download?id=${photo.id}`;
        a.download = photo.filename || `nextsync_${photo.id}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error(`Failed to trigger download for ${photo.filename}:`, err);
      }

      setProgress({ current: i + 1, total: photos.length });
      // Delay to prevent popup blocker from blocking sequential downloads
      await new Promise((r) => setTimeout(r, 800));
    }

    if (!cancelledRef.current) {
      showToast(`เริ่มดาวน์โหลด ${photos.length} ไฟล์ แล้ว ✓`);
      clearAll();
    }
    setProgress(null);
  }, [clearAll, showToast]);

  const handleDownload = useCallback(async () => {
    const photos = getSelectedPhotos();
    if (photos.length === 0 || progress !== null) return;

    if ("showDirectoryPicker" in window) {
      await downloadWithFSA(photos);
    } else {
      await downloadSequential(photos);
    }
  }, [getSelectedPhotos, progress, downloadWithFSA, downloadSequential]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setProgress(null);
    showToast("ยกเลิกการดาวน์โหลดแล้ว");
  }, [showToast]);

  if (selectedCount === 0) return null;

  const isDownloading = progress !== null;

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-300">
          {toast}
        </div>
      )}

      {/* Floating selection bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-[#0d0f1e]/95 border border-[var(--border)] rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 select-none min-w-0 max-w-[calc(100vw-2rem)]">

        {/* Selection count */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-full bg-[var(--accent-blue)] flex items-center justify-center">
            <span className="text-[9px] font-black text-white">✓</span>
          </div>
          <span className="text-xs font-bold text-[var(--text)] whitespace-nowrap">
            เลือก {selectedCount} รูป
          </span>
        </div>

        <div className="w-px h-5 bg-[var(--border)] shrink-0" />

        {/* Select all */}
        <button
          onClick={() => selectAll(allPhotos)}
          className="text-[11px] font-semibold text-[var(--accent-blue)] hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <CheckSquare className="h-3.5 w-3.5 inline mr-1" />
          เลือกทั้งหมด
        </button>

        {/* Clear */}
        <button
          onClick={clearAll}
          className="text-[11px] font-semibold text-[var(--text2)] hover:text-[var(--accent-red)] transition-colors whitespace-nowrap shrink-0"
        >
          <XCircle className="h-3.5 w-3.5 inline mr-1" />
          ล้าง
        </button>

        <div className="w-px h-5 bg-[var(--border)] shrink-0" />

        {/* Progress bar (during download) */}
        {isDownloading && progress && (
          <div className="flex items-center gap-2 shrink-0 min-w-[120px]">
            <div className="flex-1 h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] transition-all duration-300 rounded-full"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-[var(--text2)] font-semibold whitespace-nowrap">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}

        {/* Download button */}
        {!isDownloading ? (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md shrink-0"
          >
            {"showDirectoryPicker" in (typeof window !== "undefined" ? window : {}) ? (
              <FolderOpen className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            ดาวน์โหลด {selectedCount} รูป
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--accent-red)] bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-xl active:scale-95 transition-all shrink-0"
          >
            <XCircle className="h-3.5 w-3.5" />
            ยกเลิก
          </button>
        )}

        {/* Loading spinner during download */}
        {isDownloading && (
          <Loader2 className="h-4 w-4 text-[var(--accent-purple)] animate-spin shrink-0" />
        )}
      </div>
    </>
  );
}

export default SelectionBar;
