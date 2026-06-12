// app/gallery/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { usePhotos } from "@/hooks/usePhotos";
import { usePhotoSelection } from "@/hooks/usePhotoSelection";
import { FaceSearchBar } from "@/components/gallery/FaceSearchBar";
import { FilterBar, FilterValues } from "@/components/gallery/FilterBar";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { SeasonBanner } from "@/components/gallery/SeasonBanner";
import { EventSelector } from "@/components/gallery/EventSelector";
import { SeasonSelector } from "@/components/gallery/SeasonSelector";
import { SelectionBar } from "@/components/gallery/SelectionBar";
import { RefreshCw, XCircle, Sparkles } from "lucide-react";
import Link from "next/link";

export default function GalleryPage() {
  const { data: session } = useSession();
  const selectionHook = usePhotoSelection();

  const {
    photos,
    setPhotos,
    loading,
    error,
    hasMore,
    page,
    selectedSeason,
    setSelectedSeason,
    selectedEvent,
    setSelectedEvent,
    selectedTimeslot,
    setSelectedTimeslot,
    eventsList,
    seasonLoading,
    setSeasonLoading,
    filters,
    setFilters,
    faceSearchResults,
    setFaceSearchResults,
    faceSearchLoading,
    setFaceSearchLoading,
    handleLoadMore,
    fetchPhotos,
  } = usePhotos();

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    // Clear selection on filter change to avoid stale selected IDs
    selectionHook.clearAll();
  };

  // Sum photoCount of all events
  const totalPhotosInSeason = eventsList.reduce(
    (acc, curr) => acc + (curr.photoCount || 0),
    0
  );

  const displayPhotos = faceSearchResults !== null ? faceSearchResults : photos;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Season Selection & Banner */}
      {selectedSeason && (
        <div className="space-y-4">
          <div className="flex justify-between items-center glass p-4 relative z-20">
            <SeasonSelector
              selectedSeasonId={selectedSeason.id}
              onChange={(id) => {
                setSeasonLoading(true);
                setSelectedSeason((prev: any) => ({ ...prev, id }));
              }}
            />
          </div>
          <SeasonBanner
            seasonName={selectedSeason.name || "กำลังโหลด..."}
            year={selectedSeason.year || 0}
            eventCount={eventsList.length}
            photoCount={totalPhotosInSeason}
          />
        </div>
      )}

      {/* Face search banner */}
      <FaceSearchBar
        onSearchResults={(results) => setFaceSearchResults(results)}
        onSearchStarted={() => {
          setFaceSearchLoading(true);
          setPhotos([]);
          selectionHook.clearAll();
        }}
        onSearchEnded={() => setFaceSearchLoading(false)}
        seasonId={selectedSeason?.id}
        eventId={selectedEvent}
        timeslot={selectedTimeslot}
      />

      {/* Event Selector */}
      {!seasonLoading && eventsList.length > 0 && (
        <EventSelector
          events={eventsList}
          selectedEventId={selectedEvent}
          onEventChange={(ev) => {
            setSelectedEvent(ev);
            selectionHook.clearAll();
          }}
          selectedTimeslot={selectedTimeslot}
          onTimeslotChange={(ts) => {
            setSelectedTimeslot(ts);
            selectionHook.clearAll();
          }}
        />
      )}

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-2 select-none">
          <h2 className="text-sm font-extrabold text-[var(--text)] uppercase tracking-wider">
            {faceSearchResults !== null
              ? "ผลการค้นหาด้วยใบหน้าของคุณ"
              : "แกลเลอรีภาพถ่ายกิจกรรม"}
          </h2>
          {faceSearchResults !== null && (
            <span className="bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--accent-blue)] text-xs font-bold px-2.5 py-0.5 rounded-full">
              พบ {faceSearchResults.length} รูป
            </span>
          )}
        </div>

        {faceSearchResults !== null && (
          <button
            onClick={() => {
              setFaceSearchResults(null);
              selectionHook.clearAll();
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[var(--accent-red)] bg-red-950/20 hover:bg-red-950/40 rounded-xl transition-all border border-red-900/30"
          >
            <XCircle className="h-4 w-4" />
            <span>ยกเลิกการค้นหาใบหน้า</span>
          </button>
        )}
      </div>

      {faceSearchResults === null && (
        <FilterBar onChange={handleFilterChange} />
      )}

      {/* Grid rendering */}
      {faceSearchLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 select-none relative z-10">
          <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
          <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">
            ระบบปัญญาประดิษฐ์กำลังวิเคราะห์เปรียบเทียบใบหน้า...
          </p>
        </div>
      ) : (
        <div className="space-y-6 relative z-10">
          {error && photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 glass max-w-md mx-auto my-8 border border-[var(--border)]">
              <div className="h-12 w-12 bg-red-950/20 text-[var(--accent-red)] border border-red-900/30 rounded-full flex items-center justify-center mb-4">
                <XCircle className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-[var(--text)] text-sm">
                เกิดข้อผิดพลาดในการโหลดรูปภาพ
              </h4>
              <p className="text-xs text-[var(--text2)] mt-1 max-w-xs leading-relaxed">
                {error}
              </p>
              <button
                onClick={() => fetchPhotos(1, filters, false)}
                className="mt-4 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] rounded-xl transition-all hover:brightness-110"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <>
              <PhotoGrid
                photos={displayPhotos}
                loading={loading}
                hasMore={faceSearchResults !== null ? false : hasMore}
                onLoadMore={handleLoadMore}
                selectionHook={selectionHook}
              />

              {error && photos.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-red-950/10 rounded-2xl border border-red-900/20 max-w-lg mx-auto mt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-[var(--accent-red)] shrink-0" />
                    <span className="text-xs text-[var(--accent-red)] font-medium">
                      {error}
                    </span>
                  </div>
                  <button
                    onClick={() => fetchPhotos(page, filters, true)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--accent-red)] rounded-lg transition-all hover:brightness-110"
                  >
                    โหลดอีกครั้ง
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Multi-select download bar */}
      <SelectionBar selectionHook={selectionHook} allPhotos={displayPhotos} />

      {/* Floating FAB for logged-in students */}
      {session?.user && selectionHook.selectedCount === 0 && (
        <Link
          href="/my-photos"
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white px-5 py-3 rounded-full font-bold shadow-lg shadow-[var(--glow-blue)] hover:brightness-110 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-sm select-none"
        >
          <Sparkles className="h-4 w-4" />
          <span>หารูปของฉัน</span>
        </Link>
      )}
    </div>
  );
}
