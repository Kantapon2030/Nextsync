// app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { StatsCards } from "@/components/admin/StatsCards";
import { RefreshCw, LayoutDashboard, Calendar, Activity } from "lucide-react";

interface StatsData {
  totalUsers: number;
  photos: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
  recentActivity: Array<{
    id: string;
    filename: string;
    status: string;
    createdAt: string;
  }>;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (json.success) {
        setData({
          totalUsers: json.totalUsers,
          photos: json.photos,
          recentActivity: json.recentActivity || [],
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchStats();
    }
  }, [session, status]);

  if (status === "loading" || (loading && !data)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังดาวน์โหลดข้อมูลสถิติรวมของระบบ...</p>
      </div>
    );
  }

  if (!data) return null;

  const getStatusLabel = (statusVal: string) => {
    switch (statusVal) {
      case "approved":
        return <span className="text-[9px] font-bold text-[var(--accent-green)] bg-green-950/20 border border-green-900/30 rounded-full px-2.5 py-0.5">ผ่านเกณฑ์</span>;
      case "rejected":
        return <span className="text-[9px] font-bold text-[var(--accent-red)] bg-red-950/20 border border-red-900/30 rounded-full px-2.5 py-0.5">คัดออก</span>;
      default:
        return <span className="text-[9px] font-bold text-[var(--accent-yellow)] bg-amber-950/20 border border-amber-900/30 rounded-full px-2.5 py-0.5">รอตรวจ</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Title */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass border border-[var(--border)] select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-5.5 w-5.5 text-[var(--accent-purple)]" />
            <span>แผงควบคุมระบบกลาง (Central Admin Console)</span>
          </h2>
          <p className="text-xs text-[var(--text2)]">ระบบประมวลผลวิเคราะห์และสถิติตัวเลขภาพรวมกิจกรรม Nextsync</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text2)] bg-[var(--surface)] border border-[var(--border)] px-3 py-2 rounded-xl">
            <Calendar className="h-4 w-4" />
            <span>ปี 2026</span>
          </div>
          <button
            onClick={fetchStats}
            className="p-2.5 text-[var(--text2)] hover:text-white bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="relative z-10">
        <StatsCards data={data} />
      </div>

      {/* Recent Upload Activity */}
      <div className="relative z-10 glass border border-[var(--border)] overflow-hidden p-6 space-y-4 select-none">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <Activity className="h-5 w-5 text-[var(--accent-purple)]" />
          <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">คิวอัปโหลดล่าสุดเข้าระบบ (Recent Upload Stream)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider bg-black/25">
                <th className="py-3 px-4">ชื่อไฟล์รูปภาพ</th>
                <th className="py-3 px-4">สถานะตรวจ</th>
                <th className="py-3 px-4">เวลาอัปโหลด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-xs font-semibold text-[var(--text2)]">
              {data.recentActivity.map((activity) => (
                <tr key={activity.id} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[var(--text)] truncate max-w-xs">{activity.filename}</td>
                  <td className="py-3.5 px-4">{getStatusLabel(activity.status)}</td>
                  <td className="py-3.5 px-4 text-[var(--text3)]">
                    {new Date(activity.createdAt).toLocaleString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
