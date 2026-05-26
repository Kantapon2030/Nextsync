// components/admin/RejectQueue.tsx
"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Trash2, Loader2, RefreshCw, AlertTriangle, Eye, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

interface Photo {
  id: string;
  eventId: string;
  filename: string;
  thumbnailUrl: string;
  thumbnailSm: string;
  blurScore: number | null;
  brightness: number | null;
  faceCount: number;
  eyesOpen: boolean | null;
  status: "approved" | "rejected" | "pending";
  rejectReason: "blur" | "dark" | "bright" | "eyes" | "no_face" | null;
  createdAt: string;
}

export function RejectQueue() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Pagination & filter state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterReason, setFilterReason] = useState<string>("all");

  const fetchRejectedPhotos = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        status: "rejected",
        page: page.toString(),
        limit: "24",
      });
      // Filter by reason if specified
      const res = await fetch(`/api/photos?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        let filtered = data.photos;
        if (filterReason !== "all") {
          filtered = filtered.filter((p: Photo) => p.rejectReason === filterReason);
        }
        setPhotos(filtered);
        setTotalPages(data.totalPages || 1);
      } else {
        setMessage({ type: "error", text: data.error || "ดึงข้อมูลรูปภาพไม่สำเร็จ" });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRejectedPhotos();
    setSelectedIds([]);
  }, [page, filterReason]);

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === photos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(photos.map((p) => p.id));
    }
  };

  const handleBulkAction = async (action: "approve" | "delete") => {
    if (selectedIds.length === 0) return;
    
    setActionLoading(true);
    setMessage(null);
    try {
      if (action === "approve") {
        const res = await fetch("/api/admin/photos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoIds: selectedIds,
            action: "approve",
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `อนุมัติรูปภาพสำเร็จจำนวน ${data.updated} รูป` });
          setSelectedIds([]);
          fetchRejectedPhotos();
        } else {
          setMessage({ type: "error", text: data.error || "เกิดข้อผิดพลาดในการอนุมัติรูปภาพ" });
        }
      } else {
        // Delete action
        const res = await fetch(`/api/admin/photos?ids=${selectedIds.join(",")}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `ลบรูปภาพเสร็จสิ้นจำนวน ${data.deleted} รูป` });
          setSelectedIds([]);
          fetchRejectedPhotos();
        } else {
          setMessage({ type: "error", text: data.error || "เกิดข้อผิดพลาดในการลบรูปภาพ" });
        }
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการทำรายการ" });
    } finally {
      setActionLoading(false);
    }
  };

  const getReasonLabelTh = (reason: string | null) => {
    switch (reason) {
      case "blur":
        return "ภาพเบลอเกินเกณฑ์";
      case "dark":
        return "ภาพมืดเกินไป";
      case "bright":
        return "ภาพสว่างเกินไป";
      case "eyes":
        return "กะพริบตา/หลับตา";
      case "no_face":
        return "ไม่พบใบหน้าบุคคล";
      default:
        return "ไม่ระบุเหตุผล";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 glass border border-[var(--border)] select-none">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider block">คัดกรองตามสาเหตุ:</label>
          <select
            value={filterReason}
            onChange={(e) => {
              setFilterReason(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold px-3 py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-[var(--accent-purple)]/50"
          >
            <option value="all">ทั้งหมด (ทุกกรณี)</option>
            <option value="blur">ภาพเบลอ</option>
            <option value="dark">ภาพมืด</option>
            <option value="bright">ภาพสว่างเกินไป</option>
            <option value="eyes">หลับตา/ตาปิด</option>
            <option value="no_face">ไม่พบใบหน้า</option>
          </select>

          <button
            onClick={fetchRejectedPhotos}
            className="p-2 text-[var(--text2)] hover:text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-3">
          {photos.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-xs font-bold text-[var(--text2)] hover:text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 hover:bg-[var(--surface-hover)] transition-colors"
            >
              {selectedIds.length === photos.length ? "ยกเลิกการเลือกทั้งหมด" : "เลือกทั้งหมด"}
            </button>
          )}

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="text-xs font-bold text-[var(--text3)] mr-1">เลือกแล้ว {selectedIds.length} รูป:</span>
              <button
                onClick={() => handleBulkAction("approve")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50 transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                {actionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>อนุมัติ (เผยแพร่)</span>
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[var(--accent-red)] hover:brightness-110 rounded-xl disabled:opacity-50 transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                {actionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>ลบรูปภาพถาวร</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-green-950/20 border-green-900/30 text-[var(--accent-green)]"
              : "bg-red-950/20 border-red-900/30 text-[var(--accent-red)]"
          }`}
        >
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-[var(--accent-purple)] animate-spin" />
          <p className="text-xs font-bold text-[var(--text3)]">กำลังโหลดคิวรูปภาพคัดออก...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 glass text-center space-y-4 max-w-md mx-auto p-8 border border-[var(--border)] select-none">
          <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-full text-[var(--text3)]">
            <ImageIcon className="h-10 w-10" />
          </div>
          <p className="text-sm font-extrabold text-[var(--text)]">ไม่มีรูปภาพที่ถูกคัดออกในขณะนี้</p>
          <p className="text-xs text-[var(--text2)]">รูปภาพทั้งหมดที่ช่างภาพอัปโหลดผ่านการกรองคุณภาพแล้ว</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
          {photos.map((photo) => {
            const isSelected = selectedIds.includes(photo.id);
            return (
              <div
                key={photo.id}
                onClick={() => handleSelect(photo.id)}
                className={`relative group glass border rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 ${
                  isSelected ? "ring-2 ring-[var(--accent-purple)] border-transparent scale-[0.98]" : "border-[var(--border)] hover:-translate-y-0.5"
                }`}
              >
                {/* Checkbox badge */}
                <div
                  className={`absolute top-3 left-3 z-10 h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? "bg-[var(--accent-purple)] border-[var(--accent-purple)] text-white" : "bg-black/40 backdrop-blur-sm border-[var(--border)]"
                  }`}
                >
                  {isSelected && <div className="h-2 w-2 bg-white rounded-full" />}
                </div>

                {/* Rejection reason badge */}
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 items-end">
                  <span className="px-2 py-0.5 rounded-full border border-red-900/30 bg-red-950/90 text-[var(--accent-red)] text-[9px] font-bold shadow-sm">
                    {getReasonLabelTh(photo.rejectReason)}
                  </span>
                </div>

                {/* Thumbnail Image */}
                <div className="relative aspect-square w-full bg-black/20 overflow-hidden">
                  <Image
                    src={photo.thumbnailSm || photo.thumbnailUrl || "/img-placeholder.png"}
                    alt={photo.filename}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Glassmorphism details overlay on hover */}
                  <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white text-[10px] space-y-1">
                    <p className="font-semibold truncate">{photo.filename}</p>
                    <div className="flex flex-col gap-0.5 font-medium text-[var(--text2)]">
                      {photo.blurScore !== null && <p>ความคมชัด: {photo.blurScore.toFixed(1)}</p>}
                      {photo.brightness !== null && <p>ความสว่าง: {(photo.brightness * 100).toFixed(0)}%</p>}
                      <p>ตรวจจับใบหน้า: {photo.faceCount} ใบหน้า</p>
                    </div>
                  </div>
                </div>

                {/* Card footer details (visible on mobile / desktop) */}
                <div className="p-3 border-t border-[var(--border)] space-y-1">
                  <p className="text-[10px] font-bold text-[var(--text)] truncate">{photo.filename}</p>
                  <p className="text-[9px] font-medium text-[var(--text3)]">
                    {new Date(photo.createdAt).toLocaleDateString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4 select-none">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3.5 py-1.5 text-xs font-bold glass rounded-xl text-[var(--text2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <span className="text-xs font-extrabold text-[var(--text3)]">
            หน้า {page} จากทั้งหมด {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3.5 py-1.5 text-xs font-bold glass rounded-xl text-[var(--text2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}
export default RejectQueue;
