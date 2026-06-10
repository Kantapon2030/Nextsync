// app/upload/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Camera, 
  FolderOpen, 
  Copy, 
  ExternalLink, 
  CheckCircle2, 
  RefreshCw, 
  Info, 
  Calendar, 
  Sparkles, 
  Lock, 
  CloudUpload,
  AlertCircle
} from "lucide-react";
import { SyncStatusBadge } from "@/components/admin/SyncStatusBadge";

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

interface Season {
  id: string;
  name: string;
  year: number;
  isActive: boolean;
}

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [season, setSeason] = useState<Season | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Protect route: photographer & admin access only
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated" && session?.user?.role === "student") {
      router.push("/");
    }
  }, [status, session, router]);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.success) {
        setSeason(data.season);
        setEvents(data.events || []);
      } else {
        setError(data.error || "ไม่สามารถโหลดข้อมูลกิจกรรมได้");
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรมย่อย");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchEvents();
    }
  }, [status]);

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return "ยังไม่เคยซิงค์";
    return new Date(timeStr).toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังดึงข้อมูลระบบอัปโหลด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass border border-[var(--border)] select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Camera className="h-5.5 w-5.5 text-[var(--accent-purple)] animate-pulse" />
            <span>พอร์ทัลช่างภาพ (Photographer Portal)</span>
          </h2>
          <p className="text-xs text-[var(--text2)]">
            {season ? `ปีการศึกษา: ${season.name}` : "จัดการอัปโหลดภาพถ่าย"}
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="self-start sm:self-center p-2 text-[var(--text2)] hover:text-white bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="h-4.5 w-4.5" />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {error && (
        <div className="relative z-10 p-4 bg-red-950/20 border border-red-900/30 text-[var(--accent-red)] rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Instructions Card */}
      <div className="relative z-10 glass border border-[var(--border)] p-6 space-y-4">
        <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent-blue)]" />
          <span>ขั้นตอนการส่งงานและการทำงานของระบบ</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-black/10 p-4 rounded-xl border border-[var(--border)] space-y-1.5">
            <div className="font-extrabold text-[var(--accent-blue)]">1. อัปโหลดตรงเข้า Google Drive</div>
            <p className="text-[var(--text2)] leading-relaxed">
              เลือกกิจกรรมด้านล่างแล้วเปิดโฟลเดอร์ Google Drive ช่างภาพสามารถลากและวางรูปภาพได้โดยตรง (รวดเร็วมาก ไม่จำกัดความเร็วเบราว์เซอร์)
            </p>
          </div>
          <div className="bg-black/10 p-4 rounded-xl border border-[var(--border)] space-y-1.5">
            <div className="font-extrabold text-[var(--accent-purple)]">2. ระบบ Auto-Sync & AI คัดกรอง</div>
            <p className="text-[var(--text2)] leading-relaxed">
              เซิร์ฟเวอร์จะทำการดึงรูปภาพจาก Drive เข้าสู่ระบบทุกๆ 5 นาที จากนั้น AI จะตรวจสอบความเบลอ ความมืด และคัดแยกพิกัดใบหน้าอัตโนมัติ
            </p>
          </div>
          <div className="bg-black/10 p-4 rounded-xl border border-[var(--border)] space-y-1.5">
            <div className="font-extrabold text-[var(--accent-green)]">3. ตรวจสอบประวัติการส่ง</div>
            <p className="text-[var(--text2)] leading-relaxed">
              ไปที่หน้า <a href="/my-uploads" className="text-[var(--accent-purple)] underline font-bold">ประวัติการอัปโหลด</a> เพื่อตรวจดูคะแนนความชัดและรายละเอียดรูปภาพที่ผ่านการอนุมัติแบบเรียลไทม์
            </p>
          </div>
        </div>

        {/* Local Mock Hint */}
        <div className="bg-yellow-950/20 border border-yellow-900/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-[var(--accent-yellow)]">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">💡 โหมดทดสอบการจำลองระบบ (Local Mock Mode Active)</span>
            <p className="text-[11px] text-[var(--text2)] leading-relaxed">
              เนื่องจากแอปพลิเคชันกำลังรันอยู่ในโหมดพัฒนา ลิงก์โฟลเดอร์ Google Drive จะสร้างแบบจำลอง เมื่อระบบทำการซิงค์ (Auto-sync/Sync Now) ระบบจะจำลองการโหลดภาพถ่ายนักกีฬาวิ่งจาก Unsplash เข้าสู่ระบบแทนเพื่อทดสอบระบบ AI คัดกรอง
            </p>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="relative z-10 space-y-4">
        <h3 className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider">
          รายการกิจกรรมใน Season ปัจจุบัน
        </h3>

        {events.length === 0 ? (
          <div className="text-center py-16 glass border border-[var(--border)] rounded-3xl text-xs text-[var(--text3)]">
            ไม่มีกิจกรรมเปิดใช้งานในขณะนี้
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {events.map((event) => {
              const isOpen = event.uploadOpen && event.uploadUrl;
              const hasUrl = !!event.uploadUrl;

              return (
                <div 
                  key={event.id}
                  className={`p-5 rounded-3xl border glass transition-all ${
                    isOpen 
                      ? "hover:border-[var(--accent-purple)]/50 border-[var(--border)]" 
                      : "opacity-75 border-[var(--border)]"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Event Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">{event.name}</h4>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                          event.type === "indoor" 
                            ? "bg-teal-950/20 text-teal-300 border border-teal-900/30" 
                            : "bg-amber-950/20 text-amber-300 border border-amber-900/30"
                        }`}>
                          {event.type === "indoor" ? "Indoor" : "Outdoor"}
                        </span>
                        
                        {!hasUrl ? (
                          <span className="bg-blue-950/20 text-blue-300 border border-blue-900/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                            รอแอดมินสร้างโฟลเดอร์
                          </span>
                        ) : !event.uploadOpen ? (
                          <span className="bg-red-950/20 text-[var(--accent-red)] border border-red-900/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            <span>ปิดรับรูปชั่วคราว</span>
                          </span>
                        ) : (
                          <span className="bg-green-950/20 text-[var(--accent-green)] border border-green-900/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                            เปิดรับรูปอยู่
                          </span>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-xs text-[var(--text3)]">{event.description}</p>
                      )}

                      <div className="text-[10px] text-[var(--text3)] flex items-center gap-3.5 flex-wrap pt-1">
                        {event.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
                            <span>วันที่: {event.date}</span>
                          </span>
                        )}
                        <span className="font-bold text-[var(--text2)]">
                          รูปภาพในระบบ: <span className="text-[var(--accent-blue)] font-extrabold">{event.photoCount || 0} รูป</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <SyncStatusBadge status={event.syncStatus ?? "idle"} />
                          <span className="text-[9px]">อัปเดต: {formatTime(event.lastSyncedAt)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                      {isOpen ? (
                        <>
                          <a
                            href={event.uploadUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                          >
                            <FolderOpen className="h-4 w-4" />
                            <span>📂 เปิดโฟลเดอร์ Google Drive</span>
                          </a>
                          
                          <button
                            onClick={() => handleCopyLink(event.uploadUrl!, event.id)}
                            className="p-2.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-hover)] text-white rounded-xl transition-all flex items-center justify-center gap-1.5"
                            title="คัดลอกลิงก์โฟลเดอร์"
                          >
                            {copiedId === event.id ? (
                              <CheckCircle2 className="h-4 w-4 text-[var(--accent-green)]" />
                            ) : (
                              <Copy className="h-4 w-4 text-[var(--text2)]" />
                            )}
                          </button>
                        </>
                      ) : (
                        <div className="px-4 py-2.5 bg-gray-800 text-gray-500 text-xs font-bold rounded-xl flex items-center gap-2 cursor-not-allowed select-none border border-gray-700/30">
                          <Lock className="h-4 w-4" />
                          <span>ไม่เปิดรับรูปภาพในขณะนี้</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
