// app/my-uploads/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Info, 
  Eye, 
  Image as ImageIcon, 
  Calendar, 
  FolderOpen, 
  Database, 
  Sparkles, 
  ChevronRight, 
  Search, 
  AlertCircle,
  ExternalLink
} from "lucide-react";
import Image from "next/image";
import { PhotoModal } from "@/components/gallery/PhotoModal";
import { SyncStatusBadge } from "@/components/admin/SyncStatusBadge";

interface EventStats {
  id: string;
  name: string;
  type: "indoor" | "outdoor";
  date: string | null;
  driveFolderUrl: string | null;
  uploadUrl: string | null;
  lastSyncedAt: string | null;
  syncStatus: string | null;
  uploadOpen: boolean | null;
  photoCount: number;
  stats: {
    approved: number;
    rejected: number;
    pending: number;
    total: number;
  };
}

interface Photo {
  id: string;
  filename: string;
  thumbnailUrl: string;
  thumbnailSm: string;
  createdAt: string;
  status: "approved" | "rejected" | "pending";
  rejectReason: "blur" | "dark" | "bright" | "eyes" | "no_face" | null;
  blurScore: number | null;
  brightness: number | null;
  faceCount: number;
  eventId: string;
}

import { SeasonSelector } from "@/components/gallery/SeasonSelector";

export default function MyUploadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Stats & Photos states
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState<string>("");
  const [syncStats, setSyncStats] = useState<EventStats[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  // Protect route
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/photographer");
    } else if (status === "authenticated" && session?.user?.role === "student") {
      router.push("/");
    }
  }, [status, session, router]);

  const fetchSyncStats = async (seasonId?: string | null) => {
    setLoadingStats(true);
    try {
      const url = seasonId 
        ? `/api/photographer/sync-stats?seasonId=${seasonId}`
        : "/api/photographer/sync-stats";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setSyncStats(data.stats || []);
        setSeasonName(data.seasonName || "");
        if (data.seasonId) {
          setSelectedSeasonId(data.seasonId);
        }
      }
    } catch (e) {
      console.error("Error fetching sync stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchPhotosLog = async () => {
    setLoadingPhotos(true);
    try {
      const queryParams = new URLSearchParams({
        limit: "50",
        status: filterStatus,
      });
      if (selectedEventId && selectedEventId !== "all") {
        queryParams.append("eventId", selectedEventId);
      }
      if (searchQuery) {
        queryParams.append("search", searchQuery);
      }
      
      const res = await fetch(`/api/photos?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPhotos(data.photos || []);
      }
    } catch (e) {
      console.error("Error fetching photos log:", e);
    } finally {
      setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchSyncStats(selectedSeasonId);
    }
  }, [status, selectedSeasonId]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchPhotosLog();
    }
  }, [status, selectedEventId, filterStatus, searchQuery]);

  const handleRefreshAll = () => {
    fetchSyncStats(selectedSeasonId);
    fetchPhotosLog();
  };

  const getStatusBadge = (photoStatus: string) => {
    switch (photoStatus) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent-green)] bg-green-950/20 border border-green-900/30 rounded-full px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3" />
            <span>ผ่านเกณฑ์ (Approved)</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent-red)] bg-red-950/20 border border-red-900/30 rounded-full px-2 py-0.5">
            <XCircle className="h-3 w-3" />
            <span>ไม่ผ่าน (Rejected)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent-blue)] bg-blue-950/20 border border-blue-900/30 rounded-full px-2 py-0.5 animate-pulse">
            <Clock className="h-3 w-3 animate-spin" />
            <span>กำลังตรวจ (Pending)</span>
          </span>
        );
    }
  };

  const getRejectReasonTh = (reason: string | null) => {
    switch (reason) {
      case "blur":
        return "ภาพเบลอ / ความคมชัดต่ำ";
      case "dark":
        return "แสงมืดเกินไป (Under-exposed)";
      case "bright":
        return "แสงจ้าเกินไป (Over-exposed)";
      case "eyes":
        return "หลับตา / กะพริบตาขณะถ่าย";
      case "no_face":
        return "ตรวจไม่พบใบหน้าบุคคล";
      default:
        return "ไม่ระบุสาเหตุ";
    }
  };

  if (status === "loading" || loadingStats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังดึงข้อมูลรายงาน...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass border border-[var(--border)] select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Database className="h-5.5 w-5.5 text-[var(--accent-purple)]" />
            <span>ประวัติและการประมวลผลรูปถ่าย (Sync & AI Processing Monitor)</span>
          </h2>
          <p className="text-xs text-[var(--text2)]">
            ติดตามสถานะการดึงรูปภาพของ Google Drive อัตโนมัติ และดูรายงานผลการประเมินคุณภาพด้วย AI
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          className="self-start sm:self-center p-2 text-[var(--text2)] hover:text-white bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="h-4.5 w-4.5" />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* Season Selector Container */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 glass border border-[var(--border)] select-none">
        <SeasonSelector
          selectedSeasonId={selectedSeasonId}
          onChange={(id) => {
            setSelectedSeasonId(id);
          }}
        />
        {seasonName && (
          <span className="text-xs font-bold text-[var(--text2)]">
            ปีการศึกษา: <strong className="text-[var(--accent-purple)]">{seasonName}</strong>
          </span>
        )}
      </div>

      {/* 1. Google Drive Sync Status Grid */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[var(--accent-blue)]" />
            <span>โฟลเดอร์นำเข้ากิจกรรม (Active Sync Folders)</span>
          </h3>
          <span className="text-[10px] text-[var(--text3)]">คลิกการ์ดกิจกรรมเพื่อกรองตารางรูปด้านล่าง</span>
        </div>

        {syncStats.length === 0 ? (
          <div className="text-center py-12 glass border border-[var(--border)] rounded-3xl text-xs text-[var(--text3)]">
            ไม่มีรายการเชื่อมต่อโฟลเดอร์กิจกรรมในขณะนี้
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* "All" Card Filter */}
            <div
              onClick={() => setSelectedEventId("all")}
              className={`p-5 rounded-3xl border glass transition-all cursor-pointer flex flex-col justify-between ${
                selectedEventId === "all"
                  ? "border-[var(--accent-purple)] bg-[var(--accent-purple)]/5 ring-1 ring-[var(--accent-purple)]/20"
                  : "border-[var(--border)] hover:bg-white/[0.02]"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">แสดงภาพถ่ายทั้งหมด</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold text-[var(--text2)]">ALL</span>
                </div>
                <p className="text-[11px] text-[var(--text3)]">ดูรายงานคัดกรองรูปภาพทุกกิจกรรมรวมกัน</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex justify-between items-center text-xs">
                <span className="text-[var(--text3)]">กิจกรรมทั้งหมด</span>
                <span className="font-extrabold text-[var(--accent-purple)]">{syncStats.length} โฟลเดอร์</span>
              </div>
            </div>

            {/* Event Specific Cards */}
            {syncStats.map((event) => {
              const isSelected = selectedEventId === event.id;
              const hasStats = event.stats.total > 0;
              const approvedPercent = hasStats ? Math.round((event.stats.approved / event.stats.total) * 100) : 0;
              
              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={`p-5 rounded-3xl border glass transition-all cursor-pointer flex flex-col justify-between space-y-3.5 ${
                    isSelected
                      ? "border-[var(--accent-purple)] bg-[var(--accent-purple)]/5 ring-1 ring-[var(--accent-purple)]/20"
                      : "border-[var(--border)] hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate max-w-[150px]">{event.name}</h4>
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                        event.type === "indoor" 
                          ? "bg-teal-950/20 text-teal-300 border border-teal-900/30" 
                          : "bg-amber-950/20 text-amber-300 border border-amber-900/30"
                      }`}>
                        {event.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <SyncStatusBadge status={event.syncStatus} />
                    </div>
                  </div>

                  {/* Sync Photo Stats Progress Mini Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--text3)]">ผ่านเกณฑ์: {event.stats.approved} / {event.stats.total} รูป</span>
                      <span className="font-bold text-[var(--accent-green)]">{approvedPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-[var(--accent-green)] h-full" 
                        style={{ width: `${approvedPercent}%` }}
                      />
                      <div 
                        className="bg-[var(--accent-red)] h-full" 
                        style={{ width: `${hasStats ? Math.round((event.stats.rejected / event.stats.total) * 100) : 0}%` }}
                      />
                      <div 
                        className="bg-[var(--accent-blue)] h-full" 
                        style={{ width: `${hasStats ? Math.round((event.stats.pending / event.stats.total) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-[var(--text3)] font-semibold pt-0.5">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                        <span>ผ่าน: {event.stats.approved}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]" />
                        <span>คัดออก: {event.stats.rejected}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse" />
                        <span>คิว: {event.stats.pending}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border)] flex justify-between items-center text-[9px] text-[var(--text3)]">
                    <span>ซิงค์ล่าสุด: {event.lastSyncedAt ? new Date(event.lastSyncedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "ยังไม่เคย"}</span>
                    {event.uploadUrl && (
                      <a
                        href={event.uploadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent-blue)] hover:underline flex items-center gap-0.5 font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>เปิดไดรฟ์</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Photo Analysis Log Table */}
      <div className="relative z-10 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider flex items-center gap-1.5">
            <Info className="h-4 w-4 text-[var(--accent-purple)]" />
            <span>บันทึกการวิเคราะห์คุณภาพแยกรายรูป (AI Quality Logs)</span>
          </h3>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-48 bg-[var(--surface)] rounded-xl border border-[var(--border)] focus-within:border-[var(--accent-purple)] transition-colors">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="ค้นหาชื่อไฟล์..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent pl-8 pr-3 py-1.5 text-xs outline-none text-white placeholder-slate-500 font-semibold"
              />
            </div>

            {/* Filter by status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[var(--surface)] text-[var(--text2)] border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs font-semibold outline-none focus:border-[var(--accent-purple)]"
            >
              <option value="all">ทั้งหมด (All Status)</option>
              <option value="approved">เฉพาะที่ผ่าน (Approved)</option>
              <option value="pending">เฉพาะรอคิว (Pending)</option>
              <option value="rejected">เฉพาะที่คัดออก (Rejected)</option>
            </select>
          </div>
        </div>

        {loadingPhotos ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
            <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
            <p className="text-xs font-semibold text-[var(--text2)]">กำลังดึงข้อมูลล็อกรูปถ่าย...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white/[0.01] border border-[var(--border)] rounded-3xl text-center space-y-3 select-none">
            <div className="p-3 bg-black/40 border border-[var(--border)] rounded-full text-[var(--text3)]">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h4 className="font-bold text-[var(--text2)] text-xs">ไม่พบล็อกประวัติการวิเคราะห์รูปภาพ</h4>
            <p className="text-[10px] text-[var(--text3)]">รูปภาพจะปรากฏขึ้นหลังการซิงค์โฟลเดอร์ Google Drive ของกิจกรรมย่อย</p>
          </div>
        ) : (
          <div className="glass border border-[var(--border)] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-black/20 text-[var(--text3)] text-[10px] font-bold uppercase tracking-wider select-none">
                    <th className="py-4 px-6">รูปภาพ</th>
                    <th className="py-4 px-6">ชื่อไฟล์</th>
                    <th className="py-4 px-6">กิจกรรม</th>
                    <th className="py-4 px-6">วันที่ซิงค์</th>
                    <th className="py-4 px-6">การคัดกรอง AI</th>
                    <th className="py-4 px-6">เกณฑ์ชี้วัดคุณภาพ</th>
                    <th className="py-4 px-6 text-right">ดู</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-xs font-semibold text-[var(--text2)]">
                  {photos.map((photo) => {
                    const matchedEvent = syncStats.find((e) => e.id === photo.eventId);
                    return (
                      <tr key={photo.id} className="hover:bg-white/[0.01] transition-colors">
                        {/* Thumbnail */}
                        <td className="py-3 px-6 select-none">
                          <div className="relative h-11 w-11 rounded-xl overflow-hidden bg-black border border-[var(--border)]">
                            <Image
                              src={photo.thumbnailSm || photo.thumbnailUrl || "/img-placeholder.png"}
                              alt={photo.filename}
                              fill
                              sizes="44px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </td>

                        {/* Filename */}
                        <td className="py-3 px-6 font-bold text-white truncate max-w-[150px]">
                          {photo.filename}
                        </td>

                        {/* Event Name */}
                        <td className="py-3 px-6 text-[var(--text3)] max-w-[120px] truncate">
                          {matchedEvent?.name || photo.eventId}
                        </td>

                        {/* Sync Date */}
                        <td className="py-3 px-6 text-[var(--text3)] select-none">
                          {new Date(photo.createdAt).toLocaleString("th-TH", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>

                        {/* AI Status */}
                        <td className="py-3 px-6 space-y-1 select-none">
                          <div>{getStatusBadge(photo.status)}</div>
                          {photo.status === "rejected" && (
                            <p className="text-[10px] font-bold text-[var(--accent-red)] flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span>{getRejectReasonTh(photo.rejectReason)}</span>
                            </p>
                          )}
                        </td>

                        {/* Quality stats */}
                        <td className="py-3 px-6 space-y-0.5 text-[10px] text-[var(--text3)] select-none">
                          {photo.blurScore !== null && (
                            <p>ความคมชัด: <span className="text-white font-bold">{photo.blurScore.toFixed(1)}</span></p>
                          )}
                          {photo.brightness !== null && (
                            <p>ความสว่าง: <span className="text-white font-bold">{(photo.brightness * 100).toFixed(0)}%</span></p>
                          )}
                          <p>สแกนเจอ: <span className="text-white font-bold">{photo.faceCount} ใบหน้า</span></p>
                        </td>

                        {/* Action Inspect */}
                        <td className="py-3 px-6 text-right select-none">
                          <button
                            onClick={() => setSelectedPhoto(photo)}
                            className="p-2 text-[var(--text3)] hover:text-white bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all"
                            title="เปิดดูรูปภาพคุณภาพสูง"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Large Inspect Frame Modal */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </div>
  );
}
