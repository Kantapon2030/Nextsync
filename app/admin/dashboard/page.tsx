// app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Calendar, SlidersHorizontal, Cpu, Activity, RefreshCw, Calendar as CalIcon
} from "lucide-react";
import { StatsCards } from "@/components/admin/StatsCards";

// Lazy load heavy tab components
const FaceSettings = lazy(() => import("./tabs/FaceSettings").then((m) => ({ default: m.FaceSettings })));
const PipelineSettings = lazy(() => import("./tabs/PipelineSettings").then((m) => ({ default: m.PipelineSettings })));
const SystemHealth = lazy(() => import("./tabs/SystemHealth").then((m) => ({ default: m.SystemHealth })));

interface StatsData {
  totalUsers: number;
  photos: { total: number; approved: number; rejected: number; pending: number };
  recentActivity: Array<{ id: string; filename: string; status: string; createdAt: string }>;
}

type TabId = "overview" | "face-settings" | "pipeline" | "health";

const TABS: Array<{ id: TabId; label: string; labelEn: string; Icon: any; accent: string }> = [
  {
    id: "overview",
    label: "Events & Seasons",
    labelEn: "Events & Seasons",
    Icon: Calendar,
    accent: "var(--accent-blue)",
  },
  {
    id: "face-settings",
    label: "Face Search",
    labelEn: "Face Search Settings",
    Icon: SlidersHorizontal,
    accent: "var(--accent-purple)",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    labelEn: "Pipeline Settings",
    Icon: Cpu,
    accent: "var(--accent-green)",
  },
  {
    id: "health",
    label: "System Health",
    labelEn: "System Health",
    Icon: Activity,
    accent: "var(--accent-red)",
  },
];

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-[var(--text2)]">
      <RefreshCw className="h-5 w-5 animate-spin text-[var(--accent-purple)]" />
      <span className="text-xs font-semibold animate-pulse">กำลังโหลด...</span>
    </div>
  );
}

// ── Tab 1: Events & Seasons content (inline, original logic preserved) ──────────
function EventsOverviewTab({ data, fetchStats, loading }: {
  data: StatsData | null;
  fetchStats: () => void;
  loading: boolean;
}) {
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

  if (loading && !data) {
    return <TabLoadingFallback />;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <StatsCards data={data} />

      {/* Recent Activity */}
      <div className="glass border border-[var(--border)] overflow-hidden p-6 space-y-4 select-none">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--accent-purple)]" />
            <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">คิวอัปโหลดล่าสุดเข้าระบบ</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text2)] bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-xl">
              <CalIcon className="h-3.5 w-3.5" />
              <span>ปี 2026</span>
            </div>
            <button
              onClick={fetchStats}
              className="p-2 text-[var(--text2)] hover:text-white bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
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

// ── Main Dashboard Page ──────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated" || (status === "authenticated" && session?.user?.role !== "admin")) {
      router.push("/");
    }
  }, [status, session, router]);

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
    if (status === "authenticated") fetchStats();
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  const activeTabCfg = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Page Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass border border-[var(--border)] select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-[var(--accent-purple)]" />
            <span>แผงควบคุมระบบกลาง (Central Admin Console)</span>
          </h2>
          <p className="text-xs text-[var(--text2)]">ระบบประมวลผลวิเคราะห์ ตั้งค่า AI และสถิติภาพรวมกิจกรรม ShotSync</p>
        </div>
        <div className="text-[10px] font-bold text-[var(--text3)] bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-xl">
          {session?.user?.name || session?.user?.studentId}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 flex gap-1 p-1 glass border border-[var(--border)] rounded-2xl overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-1 justify-center ${
                isActive
                  ? "bg-[var(--surface)] text-white shadow-lg"
                  : "text-[var(--text3)] hover:text-[var(--text2)] hover:bg-black/20"
              }`}
              style={isActive ? { borderBottom: `2px solid ${tab.accent}` } : {}}
            >
              <Icon
                className="h-3.5 w-3.5"
                style={isActive ? { color: tab.accent } : {}}
              />
              <span className="hidden sm:inline">{tab.labelEn}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div className="relative z-10 glass border border-[var(--border)] p-6 min-h-[400px]">
        {/* Panel header accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl"
          style={{ background: `linear-gradient(90deg, ${activeTabCfg.accent}80, transparent)` }}
        />

        {activeTab === "overview" && (
          <EventsOverviewTab data={data} fetchStats={fetchStats} loading={loading} />
        )}

        {activeTab === "face-settings" && (
          <Suspense fallback={<TabLoadingFallback />}>
            <FaceSettings />
          </Suspense>
        )}

        {activeTab === "pipeline" && (
          <Suspense fallback={<TabLoadingFallback />}>
            <PipelineSettings />
          </Suspense>
        )}

        {activeTab === "health" && (
          <Suspense fallback={<TabLoadingFallback />}>
            <SystemHealth />
          </Suspense>
        )}
      </div>
    </div>
  );
}
