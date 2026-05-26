// app/admin/events/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Calendar, 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Save, 
  CheckCircle2, 
  RefreshCw, 
  Info, 
  ChevronRight,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  FolderOpen,
  Copy,
  ExternalLink,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { SyncStatusBadge } from "@/components/admin/SyncStatusBadge";

interface Season {
  id: string;
  name: string;
  year: number;
  isActive: boolean;
}

interface Event {
  id: string;
  seasonId: string;
  name: string;
  type: "indoor" | "outdoor";
  date: string | null;
  sortOrder: number;
  description: string | null;
  isActive: boolean;
  photoCount: number;
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  uploadUrl?: string | null;
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
  uploadOpen?: boolean | null;
}

export default function AdminEventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Navigation protection
  useEffect(() => {
    if (status === "unauthenticated" || (status === "authenticated" && session?.user?.role !== "admin")) {
      router.push("/");
    }
  }, [status, session, router]);

  // Seasons & Events state
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forms states
  const [newSeason, setNewSeason] = useState({ id: "", name: "", year: new Date().getFullYear(), isActive: false });
  const [newEvent, setNewEvent] = useState<{
    id: string;
    name: string;
    type: "indoor" | "outdoor";
    date: string;
    sortOrder: number;
    description: string;
  }>({ id: "", name: "", type: "indoor", date: "", sortOrder: 0, description: "" });
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editSeasonForm, setEditSeasonForm] = useState({ name: "", year: 2026, isActive: false });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventForm, setEditEventForm] = useState<{
    name: string;
    type: "indoor" | "outdoor";
    date: string;
    sortOrder: number;
    description: string;
    driveFolderId: string;
  }>({ name: "", type: "indoor", date: "", sortOrder: 0, description: "", driveFolderId: "" });

  const fetchSeasons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seasons");
      const data = await res.json();
      if (data.success) {
        setSeasons(data.seasons || []);
        if (data.seasons && data.seasons.length > 0 && !selectedSeasonId) {
          // Find active season first, or default to first
          const active = data.seasons.find((s: Season) => s.isActive);
          setSelectedSeasonId(active ? active.id : data.seasons[0].id);
        }
      } else {
        setError(data.error || "ไม่สามารถดึงข้อมูลปีการศึกษาได้");
      }
    } catch (e) {
      console.error(e);
      setError("เกิดข้อผิดพลาดในการดึงข้อมูลปีการศึกษา");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async (seasonId: string) => {
    if (!seasonId) return;
    try {
      const res = await fetch(`/api/admin/events?seasonId=${seasonId}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      } else {
        setError(data.error || "ไม่สามารถดึงข้อมูลกิจกรรมได้");
      }
    } catch (e) {
      console.error(e);
      setError("เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม");
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      fetchSeasons();
    }
  }, [status, session]);

  useEffect(() => {
    if (selectedSeasonId) {
      fetchEvents(selectedSeasonId);
    }
  }, [selectedSeasonId]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Season Handlers
  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSeason),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("สร้างปีการศึกษาสำเร็จ!");
        setNewSeason({ id: "", name: "", year: new Date().getFullYear(), isActive: false });
        fetchSeasons();
      } else {
        setError(data.error || "สร้างปีการศึกษาล้มเหลว");
      }
    } catch (e) {
      setError("เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  const handleStartEditSeason = (season: Season) => {
    setEditingSeasonId(season.id);
    setEditSeasonForm({ name: season.name, year: season.year, isActive: season.isActive });
  };

  const handleSaveSeason = async (id: string) => {
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editSeasonForm }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("อัปเดตปีการศึกษาสำเร็จ!");
        setEditingSeasonId(null);
        fetchSeasons();
      } else {
        setError(data.error || "อัปเดตปีการศึกษาล้มเหลว");
      }
    } catch (e) {
      setError("เกิดข้อผิดพลาด");
    }
  };

  const handleToggleSeasonActive = async (season: Season) => {
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: season.id, isActive: !season.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("สลับสถานะปีการศึกษาสำเร็จ!");
        fetchSeasons();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Event Handlers
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedSeasonId) return;

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEvent, seasonId: selectedSeasonId }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("สร้างกิจกรรมย่อยสำเร็จ!");
        setNewEvent({ id: "", name: "", type: "indoor", date: "", sortOrder: 0, description: "" });
        fetchEvents(selectedSeasonId);
      } else {
        setError(data.error || "สร้างกิจกรรมล้มเหลว");
      }
    } catch (e) {
      setError("เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  const handleStartEditEvent = (event: Event) => {
    setEditingEventId(event.id);
    setEditEventForm({
      name: event.name,
      type: event.type,
      date: event.date || "",
      sortOrder: event.sortOrder,
      description: event.description || "",
      driveFolderId: event.driveFolderId || "",
    });
  };

  const handleSaveEvent = async (id: string) => {
    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editEventForm }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("อัปเดตกิจกรรมย่อยสำเร็จ!");
        setEditingEventId(null);
        fetchEvents(selectedSeasonId);
      } else {
        setError(data.error || "อัปเดตกิจกรรมล้มเหลว");
      }
    } catch (e) {
      setError("เกิดข้อผิดพลาด");
    }
  };

  // Drive & Sync States
  const [syncingIds, setSyncingIds] = useState<Record<string, boolean>>({});

  const handleCreateFolder = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/create-folder`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showSuccess("สร้างโฟลเดอร์ Google Drive สำเร็จ!");
        fetchEvents(selectedSeasonId);
      } else {
        setError(data.error || "สร้างโฟลเดอร์ล้มเหลว");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  const handleSyncNow = async (eventId: string) => {
    setSyncingIds((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch(`/api/admin/events/${eventId}/sync`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showSuccess(`เริ่มซิงค์สำเร็จ! นำเข้าแล้ว ${data.synced} รูป (ระบบกำลังประมวลผล AI ในพื้นหลัง)`);
        
        // Update local status to syncing first
        setEvents((prev) =>
          prev.map((evt) =>
            evt.id === eventId ? { ...evt, syncStatus: "syncing" } : evt
          )
        );

        // Poll status every 2 seconds
        const interval = setInterval(async () => {
          const statusRes = await fetch(`/api/admin/events/${eventId}/sync-status`);
          const statusData = await statusRes.json();
          if (statusData.success) {
            setEvents((prevEvents) =>
              prevEvents.map((evt) =>
                evt.id === eventId
                  ? {
                      ...evt,
                      syncStatus: statusData.syncStatus,
                      lastSyncedAt: statusData.lastSyncedAt,
                      photoCount: statusData.photoCount,
                    }
                  : evt
              )
            );
            if (statusData.syncStatus !== "syncing") {
              clearInterval(interval);
              setSyncingIds((prev) => ({ ...prev, [eventId]: false }));
            }
          } else {
            clearInterval(interval);
            setSyncingIds((prev) => ({ ...prev, [eventId]: false }));
          }
        }, 2000);
      } else {
        setError(data.error || "เริ่มซิงค์ล้มเหลว");
        setSyncingIds((prev) => ({ ...prev, [eventId]: false }));
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด");
      setSyncingIds((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const handleCloseUpload = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/close-upload`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showSuccess("ปิดการรับรูปเรียบร้อยแล้ว (Drive เป็นแบบอ่านอย่างเดียว)");
        fetchEvents(selectedSeasonId);
      } else {
        setError(data.error || "ปิดการอัปโหลดล้มเหลว");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด");
    }
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return "ยังไม่เคยซิงค์";
    return new Date(timeStr).toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบกิจกรรมนี้?")) return;
    try {
      const res = await fetch(`/api/admin/events?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("ลบกิจกรรมสำเร็จ (Soft-Delete)!");
        fetchEvents(selectedSeasonId);
      } else {
        setError(data.error || "ไม่สามารถลบกิจกรรมได้");
      }
    } catch (e) {
      setError("เกิดข้อผิดพลาดในการส่งคำสั่งลบ");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass border border-[var(--border)] select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Calendar className="h-5.5 w-5.5 text-[var(--accent-purple)]" />
            <span>จัดการโครงสร้างงานกิจกรรม (Season & Events)</span>
          </h2>
          <p className="text-xs text-[var(--text2)]">จัดแบ่งปีการศึกษา/Season และกิจกรรมย่อยเพื่อรองรับฟิลเตอร์หน้าแกลเลอรี</p>
        </div>
      </div>

      {error && (
        <div className="relative z-10 p-4 bg-red-950/20 border border-red-900/30 text-[var(--accent-red)] rounded-2xl text-xs font-semibold flex items-center gap-2">
          <Info className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-[var(--accent-red)] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="relative z-10 p-4 bg-green-950/20 border border-green-900/30 text-[var(--accent-green)] rounded-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* COLUMN 1: Seasons List (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass border border-[var(--border)] p-5 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-[var(--accent-blue)]" />
              <span>ปีการศึกษา / Seasons</span>
            </h3>

            {/* Create Season Form */}
            <form onSubmit={handleCreateSeason} className="space-y-3 bg-black/10 p-4 rounded-2xl border border-[var(--border)]">
              <div className="text-[10px] font-bold text-[var(--text3)] uppercase">เพิ่ม Season ใหม่</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="รหัส เช่น sports_2567"
                  value={newSeason.id}
                  onChange={(e) => setNewSeason({ ...newSeason, id: e.target.value })}
                  required
                  className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                />
                <input
                  type="number"
                  placeholder="ปี พ.ศ. เช่น 2567"
                  value={newSeason.year || ""}
                  onChange={(e) => setNewSeason({ ...newSeason, year: parseInt(e.target.value) })}
                  required
                  className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                />
              </div>
              <input
                type="text"
                placeholder="ชื่อเต็ม เช่น กีฬาสี ปีการศึกษา 2567"
                value={newSeason.name}
                onChange={(e) => setNewSeason({ ...newSeason, name: e.target.value })}
                required
                className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
              />
              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่ม Season</span>
              </button>
            </form>

            {/* Seasons List Render */}
            <div className="space-y-2">
              {seasons.map((season) => {
                const isSelected = selectedSeasonId === season.id;
                const isEditing = editingSeasonId === season.id;

                return (
                  <div
                    key={season.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-[var(--accent-blue)]/5 border-[var(--accent-blue)]"
                        : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editSeasonForm.name}
                          onChange={(e) => setEditSeasonForm({ ...editSeasonForm, name: e.target.value })}
                          className="w-full bg-black/30 border border-[var(--border)] text-white text-xs px-2 py-1 rounded"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={editSeasonForm.year}
                            onChange={(e) => setEditSeasonForm({ ...editSeasonForm, year: parseInt(e.target.value) })}
                            className="w-20 bg-black/30 border border-[var(--border)] text-white text-xs px-2 py-1 rounded"
                          />
                          <button
                            onClick={() => handleSaveSeason(season.id)}
                            className="bg-green-600 px-3 py-1 rounded text-white text-xs font-bold"
                          >
                            บันทึก
                          </button>
                          <button
                            onClick={() => setEditingSeasonId(null)}
                            className="bg-slate-700 px-3 py-1 rounded text-white text-xs"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedSeasonId(season.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-white">{season.name}</span>
                            {season.isActive && (
                              <span className="bg-green-950/20 text-[var(--accent-green)] border border-green-900/30 text-[9px] px-1.5 py-0.5 rounded font-extrabold">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text3)] mt-0.5">ID: {season.id} · พ.ศ. {season.year}</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleSeasonActive(season)}
                            className="text-[var(--text3)] hover:text-white"
                            title={season.isActive ? "ปิดการใช้งาน" : "เปิดใช้งานเป็นหลัก"}
                          >
                            {season.isActive ? (
                              <ToggleRight className="h-5 w-5 text-[var(--accent-green)]" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-[var(--text3)]" />
                            )}
                          </button>
                          <button
                            onClick={() => handleStartEditSeason(season)}
                            className="text-[var(--text3)] hover:text-[var(--accent-blue)] p-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Events List (Right 3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass border border-[var(--border)] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-[var(--accent-purple)]" />
                <span>กิจกรรมย่อย (Events)</span>
              </h3>
              <span className="text-[10px] font-extrabold text-[var(--text3)] uppercase">
                ใน Season: {selectedSeasonId}
              </span>
            </div>

            {/* Create Event Form */}
            {selectedSeasonId ? (
              <form onSubmit={handleCreateEvent} className="bg-black/10 p-4 rounded-2xl border border-[var(--border)] space-y-3">
                <div className="text-[10px] font-bold text-[var(--text3)] uppercase">เพิ่มกิจกรรมย่อยใหม่</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="รหัส เช่น day1_opening"
                    value={newEvent.id}
                    onChange={(e) => setNewEvent({ ...newEvent, id: e.target.value })}
                    required
                    className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                  />
                  <input
                    type="text"
                    placeholder="ชื่อ เช่น วันที่ 1 — พิธีเปิด"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    required
                    className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newEvent.type}
                    onChange={(e: any) => setNewEvent({ ...newEvent, type: e.target.value })}
                    className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                  >
                    <option value="indoor">Indoor (ในโรงเรียน)</option>
                    <option value="outdoor">Outdoor (นอกสถานที่/มี Timeslot)</option>
                  </select>

                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                  />

                  <input
                    type="number"
                    placeholder="ลำดับ Sort"
                    value={newEvent.sortOrder || ""}
                    onChange={(e) => setNewEvent({ ...newEvent, sortOrder: parseInt(e.target.value) || 0 })}
                    className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                  />
                </div>

                <input
                  type="text"
                  placeholder="คำอธิบายเพิ่มเติม (ตัวเลือก)"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold outline-none w-full"
                />

                <button
                  type="submit"
                  className="w-full py-2 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>เพิ่มกิจกรรม</span>
                </button>
              </form>
            ) : (
              <div className="text-center p-8 border border-dashed border-[var(--border)] rounded-2xl text-xs text-[var(--text3)]">
                กรุณาเลือกหรือสร้าง Season ด้านซ้ายก่อน เพื่อเพิ่มกิจกรรมย่อย
              </div>
            )}

            {/* Events List Render */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {events.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--text3)]">
                  ไม่มีกิจกรรมในโครงสร้างปัจจุบัน
                </div>
              ) : (
                events.map((event) => {
                  const isEditing = editingEventId === event.id;

                  return (
                    <div
                      key={event.id}
                      className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl transition-all hover:bg-[var(--surface-hover)]"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editEventForm.name}
                              onChange={(e) => setEditEventForm({ ...editEventForm, name: e.target.value })}
                              className="w-full bg-black/30 border border-[var(--border)] text-white text-xs px-2 py-1 rounded"
                            />
                            <select
                              value={editEventForm.type}
                              onChange={(e: any) => setEditEventForm({ ...editEventForm, type: e.target.value })}
                              className="w-full bg-black/30 border border-[var(--border)] text-white text-xs px-2 py-1 rounded"
                            >
                              <option value="indoor">Indoor</option>
                              <option value="outdoor">Outdoor</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={editEventForm.date}
                              onChange={(e) => setEditEventForm({ ...editEventForm, date: e.target.value })}
                              className="w-full bg-black/30 border border-[var(--border)] text-white text-xs px-2 py-1 rounded"
                            />
                            <input
                              type="number"
                              value={editEventForm.sortOrder}
                              onChange={(e) => setEditEventForm({ ...editEventForm, sortOrder: parseInt(e.target.value) || 0 })}
                              className="w-full bg-black/30 border border-[var(--border)] text-white text-xs px-2 py-1 rounded"
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <input
                              type="text"
                              placeholder="Google Drive Folder ID (ป้อนรหัสโฟลเดอร์เองได้)"
                              value={editEventForm.driveFolderId}
                              onChange={(e) => setEditEventForm({ ...editEventForm, driveFolderId: e.target.value })}
                              className="w-full bg-black/30 border border-[var(--border)] text-white text-xs px-2 py-1 rounded"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleSaveEvent(event.id)}
                              className="bg-green-600 px-3 py-1 rounded text-white text-xs font-bold"
                            >
                              บันทึก
                            </button>
                            <button
                              onClick={() => setEditingEventId(null)}
                              className="bg-slate-700 px-3 py-1 rounded text-white text-xs"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white">{event.name}</span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                  event.type === "indoor" 
                                    ? "bg-teal-950/20 text-teal-300 border border-teal-900/30" 
                                    : "bg-amber-950/20 text-amber-300 border border-amber-900/30"
                                }`}>
                                  {event.type === "indoor" ? "Indoor" : "Outdoor"}
                                </span>
                              </div>
                              <div className="text-[10px] text-[var(--text3)] flex items-center gap-2 flex-wrap">
                                <span>ID: {event.id}</span>
                                <span>·</span>
                                <span>ลำดับ: {event.sortOrder}</span>
                                {event.date && (
                                  <>
                                    <span>·</span>
                                    <span>วันที่: {event.date}</span>
                                  </>
                                )}
                                <span>·</span>
                                <span className="text-[var(--accent-purple)] font-bold">{event.photoCount || 0} รูป</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEditEvent(event)}
                                className="text-[var(--text3)] hover:text-[var(--accent-blue)] p-1.5 transition-colors"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                className="text-[var(--text3)] hover:text-[var(--accent-red)] p-1.5 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Drive integration settings */}
                          <div className="mt-2 pt-3 border-t border-[var(--border)] space-y-2">
                            {event.driveFolderId ? (
                              <div className="space-y-2 text-[11px]">
                                <div className="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-[var(--border)] flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 truncate max-w-xs sm:max-w-md">
                                    <FolderOpen className="h-4 w-4 text-[var(--accent-blue)]" />
                                    <span className="text-[var(--text2)]">ลิงก์อัปโหลด:</span>
                                    <code className="text-white select-all truncate bg-black/40 px-1.5 py-0.5 rounded">{event.uploadUrl}</code>
                                  </div>
                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(event.uploadUrl || "");
                                        showSuccess("คัดลอกลิงก์อัปโหลดแล้ว!");
                                      }}
                                      className="p-1 text-slate-400 hover:text-white transition-colors bg-white/5 rounded"
                                      title="คัดลอกลิงก์"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                    <a
                                      href={event.uploadUrl || ""}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 text-slate-400 hover:text-white transition-colors bg-white/5 rounded flex items-center gap-0.5"
                                      title="เปิดหน้า Drive"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
                                  <div className="flex items-center gap-2">
                                    <SyncStatusBadge status={event.syncStatus ?? null} />
                                    <span className="text-[10px] text-[var(--text3)]">ซิงค์ล่าสุด: {formatTime(event.lastSyncedAt)}</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {event.uploadOpen ? (
                                      <button
                                        onClick={() => handleCloseUpload(event.id)}
                                        className="text-[10px] font-bold text-[var(--accent-red)] hover:bg-red-950/20 border border-[var(--accent-red)]/20 px-2.5 py-1 rounded-lg transition-colors"
                                      >
                                        ปิดรับรูป
                                      </button>
                                    ) : (
                                      <span className="bg-red-950/20 text-[var(--accent-red)] border border-red-900/30 text-[9px] font-extrabold px-2 py-0.5 rounded">
                                        ปิดรับรูปแล้ว
                                      </span>
                                    )}

                                    <button
                                      onClick={() => handleSyncNow(event.id)}
                                      disabled={syncingIds[event.id] || event.syncStatus === "syncing"}
                                      className="text-[10px] font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 px-3 py-1 rounded-lg transition-all flex items-center gap-1"
                                    >
                                      {syncingIds[event.id] || event.syncStatus === "syncing" ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-3 w-3" />
                                      )}
                                      <span>Sync Now</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCreateFolder(event.id)}
                                className="w-full py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                              >
                                <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                                <span>สร้าง Drive Folder กิจกรรม</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
