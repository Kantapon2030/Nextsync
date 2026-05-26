// components/gallery/PhotoModal.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Download, ChevronLeft, ChevronRight, Wand2, Calendar, FileText } from "lucide-react";
import { PhotoData } from "./PhotoCard";
import { formatBytes } from "@/lib/utils";
import { PhotoEditorModal } from "./PhotoEditorModal";

interface PhotoModalProps {
  photo: PhotoData | null;
  photos?: PhotoData[];
  currentIndex?: number;
  onClose: () => void;
  onNavigate?: (dir: "prev" | "next") => void;
}

export function PhotoModal({ photo, photos = [], currentIndex = 0, onClose, onNavigate }: PhotoModalProps) {
  const [src, setSrc] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (photo) {
      setSrc(photo.thumbnailUrl || photo.thumbnailSm || photo.driveUrl);
    }
  }, [photo]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const navigate = useCallback((dir: "prev" | "next") => {
    if (onNavigate) onNavigate(dir);
  }, [onNavigate]);

  useEffect(() => {
    if (!photo) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) navigate("prev");
      if (e.key === "ArrowRight" && hasNext) navigate("next");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photo, hasPrev, hasNext, navigate, onClose]);

  if (!photo) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-5xl glass rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[92vh] border border-[var(--border)] bg-[#0D0F1C]/95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-[var(--surface-hover)] border border-[var(--border)] text-white rounded-full transition-colors backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Left: Image display */}
          <div className="relative flex-1 bg-black/50 flex items-center justify-center min-h-[300px] md:max-h-[92vh] border-b md:border-b-0 md:border-r border-[var(--border)]">
            <img
              src={src}
              alt={photo.filename}
              className="max-w-full max-h-full object-contain p-2"
              onError={() => setSrc("https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80")}
            />

            {/* Navigation arrows */}
            {hasPrev && (
              <button
                onClick={() => navigate("prev")}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md border border-white/10 transition-all hover:scale-110"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => navigate("next")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md border border-white/10 transition-all hover:scale-110"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            {/* Photo counter */}
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-3 py-1 rounded-full border border-white/10">
                {currentIndex + 1} / {photos.length}
              </div>
            )}
          </div>

          {/* Right: Info panel */}
          <div className="w-full md:w-72 p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-[92vh] shrink-0 bg-transparent text-[var(--text2)]">
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] break-all leading-snug">{photo.filename}</h3>
              </div>

              <div className="space-y-2 pt-4 border-t border-[var(--border)]">
                <h4 className="text-[10px] font-bold text-[var(--text)] uppercase tracking-wider">รายละเอียด</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                    <span className="text-[var(--text3)] flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> วันที่
                    </span>
                    <span className="font-semibold text-[var(--text2)]">
                      {photo.createdAt ? new Date(photo.createdAt).toLocaleDateString("th-TH") : "-"}
                    </span>
                  </div>
                  {photo.fileSize && (
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                      <span className="text-[var(--text3)] flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> ขนาดไฟล์
                      </span>
                      <span className="font-semibold text-[var(--text2)]">{formatBytes(photo.fileSize)}</span>
                    </div>
                  )}
                  {photo.width && photo.height && (
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                      <span className="text-[var(--text3)]">ขนาดภาพ</span>
                      <span className="font-semibold text-[var(--text2)]">{photo.width} × {photo.height}</span>
                    </div>
                  )}
                  {photo.faceCount !== undefined && photo.faceCount !== null && (
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                      <span className="text-[var(--text3)]">ใบหน้า</span>
                      <span className="font-semibold text-[var(--text2)]">{photo.faceCount} คน</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-5 mt-5 border-t border-[var(--border)] space-y-2">
              {/* Edit button */}
              <button
                onClick={() => setEditorOpen(true)}
                className="w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:brightness-110 text-white font-bold text-sm rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Wand2 className="h-4 w-4" />
                <span>✨ ตกแต่งรูปภาพ</span>
              </button>

              {/* Download original */}
              <a
                href={photo.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-white font-semibold text-sm rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>ดาวน์โหลดต้นฉบับ</span>
              </a>
              <p className="text-[9px] text-center text-[var(--text3)]">
                ต้นฉบับความละเอียดสูงจาก Google Drive
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Editor Modal */}
      {editorOpen && (
        <PhotoEditorModal
          photo={photo}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  );
}

export default PhotoModal;
