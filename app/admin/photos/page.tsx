// app/admin/photos/page.tsx
"use client";

import { useState, useEffect } from "react";
import { FilterBar, FilterValues } from "@/components/gallery/FilterBar";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { BatchActions } from "@/components/admin/BatchActions";
import { Image, Layers, RefreshCw, XCircle } from "lucide-react";

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterValues>({
    sortBy: "newest",
    status: "approved",
  });

  const fetchPhotos = async (pageNum: number, currentFilters: FilterValues, isAppend = false) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: pageNum.toString(),
        limit: "24",
        status: currentFilters.status || "approved",
      });

      const res = await fetch(`/api/photos?${query.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();

      if (data.success) {
        let list = data.photos;
        if (currentFilters.sortBy === "oldest") {
          list = [...list].reverse();
        }

        setPhotos((prev) => (isAppend ? [...prev, ...list] : list));
        setHasMore(data.page < data.totalPages);
      } else {
        throw new Error(data.error || "Failed to fetch photos");
      }
    } catch (e: any) {
      console.error(e);
      setError("ไม่สามารถดึงข้อมูลรูปภาพได้ กรุณาลองใหม่อีกครั้ง");
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchPhotos(1, filters, false);
  }, [filters]);

  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPhotos(nextPage, filters, true);
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  const handleRefresh = () => {
    setPage(1);
    fetchPhotos(1, filters, false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Title */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass border border-[var(--border)] select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Image className="h-5.5 w-5.5 text-[var(--accent-purple)]" />
            <span>จัดการคลังรูปภาพทั้งหมด</span>
          </h2>
          <p className="text-xs text-[var(--text2)]">ตรวจสอบ แก้ไข และประมวลผลรูปภาพกิจกรรมทั้งหมดในระบบกลาง</p>
        </div>

        <button
          onClick={handleRefresh}
          className="p-2.5 text-[var(--text2)] hover:text-white bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Batch Processing Controls */}
      <div className="relative z-10">
        <BatchActions />
      </div>

      {/* Filter and stats details */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2 select-none pt-4">
          <Layers className="h-5 w-5 text-[var(--accent-purple)]" />
          <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">คลังรูปภาพและตัวเลือกฟิลเตอร์</h3>
        </div>

        <FilterBar onChange={handleFilterChange} showStatusFilter={true} />

        <div className="space-y-6">
          {error && photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 glass max-w-md mx-auto my-8 border border-[var(--border)]">
              <div className="h-12 w-12 bg-red-950/20 text-[var(--accent-red)] border border-red-900/30 rounded-full flex items-center justify-center mb-4">
                <XCircle className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-[var(--text)] text-sm">เกิดข้อผิดพลาดในการโหลดรูปภาพ</h4>
              <p className="text-xs text-[var(--text2)] mt-1 max-w-xs leading-relaxed">
                {error}
              </p>
              <button
                onClick={() => {
                  setPage(1);
                  fetchPhotos(1, filters, false);
                }}
                className="mt-4 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] rounded-xl transition-all"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <>
              <PhotoGrid
                photos={photos}
                loading={loading}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
              />
              {error && photos.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-red-950/20 border border-red-900/30 max-w-lg mx-auto mt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-[var(--accent-red)] shrink-0" />
                    <span className="text-xs text-[var(--accent-red)] font-medium">{error}</span>
                  </div>
                  <button
                    onClick={() => {
                      fetchPhotos(page, filters, true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--accent-red)] rounded-lg transition-all hover:brightness-110"
                  >
                    โหลดอีกครั้ง
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
