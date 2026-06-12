// app/my-photos/page.tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePhotos } from "@/hooks/usePhotos";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { EventSelector } from "@/components/gallery/EventSelector";
import { Sparkles, RefreshCw, Lock, Camera, Download } from "lucide-react";
import { FaceScanModal } from "@/components/gallery/FaceScanModal";

export default function MyPhotosPage() {
  const { data: session, status } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const {
    photos,
    loading,
    error,
    selectedEvent,
    setSelectedEvent,
    selectedTimeslot,
    setSelectedTimeslot,
    eventsList,
    seasonLoading,
    fetchMyPhotos,
  } = usePhotos({
    faceSearchMode: true,
    user: session?.user as { faceEnrolled?: boolean } | null,
  });

  const handleDownloadAll = async () => {
    if (photos.length === 0 || downloading) return;
    setDownloading(true);
    try {
      for (const photo of photos) {
        // Use R2 thumbnailUrl (same-origin) for reliable download, fallback to Drive URL
        const url = photo.thumbnailUrl || photo.thumbnailSm || photo.driveUrl;
        if (!url) continue;

        // Use fetch to download and create object URL for cross-origin support
        try {
          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = photo.filename || "nextsync_photo.jpg";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
          } else {
            // Fallback: open in new tab
            window.open(url, "_blank", "noopener,noreferrer");
          }
        } catch {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        await new Promise((resolve) => setTimeout(resolve, 800)); // Delay to prevent browser blocking
      }
    } catch (err) {
      console.error("Download all error:", err);
    } finally {
      setDownloading(false);
    }
  };

  // Show loading state while session is being determined
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังตรวจสอบข้อมูลสมาชิก...</p>
      </div>
    );
  }

  // Show redirect message while redirecting unauthenticated users
  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังนำท่านไปหน้าเข้าสู่ระบบ...</p>
      </div>
    );
  }

  const isEnrolled = session?.user?.faceEnrolled;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Title Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--accent-purple)] animate-pulse" />
            <span>รูปถ่ายของฉัน (My Photos)</span>
          </h2>
          {isEnrolled && !loading && (
            <p className="text-[11px] text-[var(--text3)]">
              แสดงภาพที่ระบบตรวจพบใบหน้าของคุณ ({photos.length} รูป)
            </p>
          )}
        </div>

        {isEnrolled && (
          <div className="flex items-center gap-2">
            {photos.length > 0 && (
              <button
                onClick={handleDownloadAll}
                disabled={downloading}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:from-gray-800 disabled:to-gray-800"
              >
                <Download className={`h-4 w-4 ${downloading ? "animate-bounce" : ""}`} />
                <span>{downloading ? "กำลังดาวน์โหลด..." : "ดาวน์โหลดทั้งหมด"}</span>
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-[var(--text)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all flex items-center gap-1.5"
            >
              <Camera className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
              <span>ปรับปรุงใบหน้า</span>
            </button>
            <button
              onClick={fetchMyPhotos}
              disabled={loading}
              className="p-2 text-[var(--text2)] hover:text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
              title="รีเฟรชรูปถ่าย"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {/* Event selector filter for students */}
      {isEnrolled && !seasonLoading && eventsList.length > 0 && (
        <div className="relative z-10">
          <EventSelector
            events={eventsList}
            selectedEventId={selectedEvent}
            onEventChange={setSelectedEvent}
            selectedTimeslot={selectedTimeslot}
            onTimeslotChange={setSelectedTimeslot}
          />
        </div>
      )}

      {/* Main Container State */}
      <div className="relative z-10">
        {!isEnrolled ? (
          <div className="flex flex-col items-center justify-center py-16 glass text-center space-y-4 max-w-lg mx-auto p-8 border border-[var(--border)] select-none">
            <div className="p-4 bg-yellow-950/20 rounded-full border border-yellow-900/30 text-[var(--accent-yellow)] animate-pulse">
              <Lock className="h-10 w-10" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text)]">ยังไม่ได้บันทึกข้อมูลใบหน้าของท่าน</h3>
            <p className="text-xs text-[var(--text2)] leading-relaxed max-w-sm">
              กรุณาสแกนและบันทึกข้อมูลใบหน้าของคุณ เพื่อให้ระบบ AI เริ่มทำงานประมวลผลจับคู่รูปภาพของคุณในงานวิ่งนี้โดยอัตโนมัติ
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Camera className="h-4 w-4" />
              <span>เริ่มต้นบันทึกใบหน้า (Enroll Face)</span>
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
            <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
            <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">AI กำลังวิเคราะห์ใบหน้าเพื่อนำเสนอรูปภาพของคุณ...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/20 border border-red-900/30 text-[var(--accent-red)] rounded-2xl text-xs font-semibold select-none max-w-md mx-auto text-center">
            {error}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass text-center space-y-4 max-w-md mx-auto p-8 border border-[var(--border)] select-none">
            <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-full text-[var(--text3)]">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </div>
            <h4 className="font-bold text-[var(--text)] text-sm">ไม่พบรูปภาพของคุณในคลังภาพขณะนี้</h4>
            <p className="text-xs text-[var(--text2)] leading-relaxed max-w-xs">
              ระบบกำลังอัปโหลดและสแกนรูปภาพเพิ่มเติม เมื่อพบภาพที่มีใบหน้าคุณที่ผ่านเกณฑ์คุณภาพ รูปจะมาแสดงที่นี่ทันที!
            </p>
          </div>
        ) : (
          <PhotoGrid
            photos={photos}
            loading={false}
            hasMore={false}
            onLoadMore={() => {}}
          />
        )}
      </div>

      <FaceScanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="enroll"
        onEnrollSuccess={fetchMyPhotos}
      />
    </div>
  );
}
