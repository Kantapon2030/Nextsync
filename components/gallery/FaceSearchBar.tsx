// components/gallery/FaceSearchBar.tsx
"use client";

import { useState } from "react";
import { Sparkles, User, ArrowRight, Loader2, Camera } from "lucide-react";
import { useSession } from "next-auth/react";
import { FaceScanModal } from "./FaceScanModal";

interface FaceSearchBarProps {
  onSearchResults: (photos: any[]) => void;
  onSearchStarted: () => void;
  onSearchEnded: () => void;
  seasonId?: string | null;
  eventId?: string | null;
  timeslot?: string | null;
}

export function FaceSearchBar({
  onSearchResults,
  onSearchStarted,
  onSearchEnded,
  seasonId,
  eventId,
  timeslot,
}: FaceSearchBarProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProfileSearch = async () => {
    if (!session?.user) return;
    
    setLoading(true);
    setError(null);
    onSearchStarted();

    try {
      const res = await fetch("/api/face/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 60,
          seasonId: seasonId || undefined,
          eventId: eventId || undefined,
          timeslot: timeslot || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการค้นหาใบหน้า");
      }

      onSearchResults(data.photos || []);
    } catch (err: any) {
      console.error("Face search component error:", err);
      setError(err.message || "เกิดข้อผิดพลาดในการค้นหาใบหน้า");
      onSearchResults([]);
    } finally {
      setLoading(false);
      onSearchEnded();
    }
  };

  const isEnrolled = session?.user?.faceEnrolled;

  return (
    <div className="w-full glass border border-[var(--border)] rounded-3xl p-6 text-white shadow-xl rainbow-glow-shadow flex flex-col md:flex-row md:items-center justify-between gap-6 select-none relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-0 right-0 h-40 w-40 bg-[var(--accent-purple)]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-28 w-28 bg-[var(--accent-blue)]/15 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

      <div className="space-y-2 relative z-10">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 animate-pulse text-yellow-300 fill-yellow-300" />
          <span>ระบบค้นหารูปภาพด้วยใบหน้า (Face Recognition Search)</span>
        </h2>
        <p className="text-xs text-[var(--text2)] max-w-xl leading-relaxed">
          ค้นหารูปถ่ายของคุณทั้งหมดในงานได้ทันทีด้วยปัญญาประดิษฐ์ ค้นหาจากภาพกว่า 10,000+ ใบหน้าในเสี้ยววินาที!
        </p>
        {error && (
          <p className="text-xs text-red-200 font-semibold bg-red-500/20 px-3 py-1 rounded-xl w-fit">
            {error}
          </p>
        )}
      </div>

      <div className="relative z-10 shrink-0 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
        {isEnrolled ? (
          <>
            <button
              onClick={handleProfileSearch}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 text-white font-bold text-sm rounded-2xl shadow-md transition-all hover:scale-[1.03] flex items-center justify-center gap-2 select-none active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>กำลังค้นหาใบหน้า...</span>
                </>
              ) : (
                <>
                  <User className="h-4.5 w-4.5" />
                  <span>ค้นหารูปภาพของฉัน (อัตโนมัติ)</span>
                </>
              )}
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-white font-semibold text-sm rounded-2xl border border-[var(--border)] transition-all flex items-center justify-center gap-2 select-none active:scale-[0.98]"
            >
              <Camera className="h-4.5 w-4.5" />
              <span>สแกนใบหน้าใหม่</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-bold text-sm rounded-2xl shadow-lg transition-all hover:scale-[1.03] flex items-center justify-center gap-2 select-none active:scale-[0.98]"
          >
            <Camera className="h-4.5 w-4.5" />
            <span>สแกนกล้องเพื่อค้นหารูปถ่าย</span>
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      <FaceScanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="search"
        onSearchResults={(results) => {
          onSearchResults(results);
        }}
        seasonId={seasonId}
        eventId={eventId}
        timeslot={timeslot}
      />
    </div>
  );
}
export default FaceSearchBar;
