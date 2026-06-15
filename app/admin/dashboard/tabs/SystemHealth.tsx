"use client";
// app/admin/dashboard/tabs/SystemHealth.tsx
// Tab 4: System Health — DB stats, Processing Queue, Python service status
// Auto-refreshes every 30 seconds

import { useState, useEffect, useCallback } from "react";
import {
  Activity, Database, Cpu, Wifi, WifiOff, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, XCircle, RotateCcw, Server, Play
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface HealthStats {
  totalUsers: number;
  photos: { total: number; approved: number; rejected: number; pending: number };
  totalEmbeddings: number;
  jobs: { queued: number; running: number; done: number; error: number };
  recentJobs: Array<{
    id: string;
    eventId: string;
    status: string;
    processed: number;
    total: number;
    errorMsg: string | null;
    createdAt: string;
    startedAt: string | null;
    doneAt: string | null;
  }>;
}

interface HealthCheck {
  status: "online" | "offline" | "degraded" | "loading";
  responseTime: number | null;
  error?: string;
  serviceInfo?: { status?: string; model?: string; detector?: string };
}

export function SystemHealth() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [healthCheck, setHealthCheck] = useState<HealthCheck>({ status: "loading", responseTime: null });
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [processingNow, setProcessingNow] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (data.success) setStats(data);
    } catch {
      console.error("Failed to fetch stats");
    }
  }, []);

  const fetchHealthCheck = useCallback(async () => {
    setHealthCheck((prev) => ({ ...prev, status: "loading" }));
    try {
      const res = await fetch("/api/admin/health-check");
      const data = await res.json();
      setHealthCheck({
        status: data.status ?? "offline",
        responseTime: data.responseTime ?? null,
        error: data.error,
        serviceInfo: data.serviceInfo,
      });
    } catch {
      setHealthCheck({ status: "offline", responseTime: null, error: "Network error" });
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchHealthCheck()]);
    setLastRefreshed(new Date());
    setLoading(false);
  }, [fetchStats, fetchHealthCheck]);

  useEffect(() => {
    refreshAll();
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAll, 30_000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const retryFailedJobs = async () => {
    setRetrying(true);
    setRetryMessage(null);
    try {
      const res = await fetch("/api/admin/pipeline/retry", { method: "PATCH" });
      const data: { success?: boolean; retried?: number; error?: string } = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Retry failed");
      }
      setRetryMessage(`ส่งกลับเข้าคิวแล้ว ${data.retried ?? 0} งาน`);
      await refreshAll();
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const processNextBatch = async () => {
    setProcessingNow(true);
    setRetryMessage(null);
    try {
      const res = await fetch("/api/admin/pipeline/process-now", { method: "POST" });
      const data: {
        success?: boolean;
        processed?: number;
        remaining?: number;
        message?: string;
        error?: string;
      } = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Processing failed");
      }
      setRetryMessage(
        data.message ?? `Processed ${data.processed ?? 0}; remaining ${data.remaining ?? 0}`
      );
      await refreshAll();
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setProcessingNow(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string; Icon: LucideIcon }> = {
      queued: { label: "รอคิว", cls: "text-[var(--accent-yellow)] bg-amber-950/20 border-amber-900/30", Icon: Clock },
      running: { label: "กำลังประมวล", cls: "text-[var(--accent-blue)] bg-blue-950/20 border-blue-900/30", Icon: RefreshCw },
      done: { label: "เสร็จสิ้น", cls: "text-[var(--accent-green)] bg-green-950/20 border-green-900/30", Icon: CheckCircle2 },
      error: { label: "ข้อผิดพลาด", cls: "text-[var(--accent-red)] bg-red-950/20 border-red-900/30", Icon: XCircle },
    };
    const cfg = map[status] || map.error;
    const Icon = cfg.Icon;
    return (
      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
        <Icon className="h-2.5 w-2.5" />
        {cfg.label}
      </span>
    );
  };

  const healthColor = {
    online: "text-[var(--accent-green)]",
    degraded: "text-[var(--accent-yellow)]",
    offline: "text-[var(--accent-red)]",
    loading: "text-[var(--text3)]",
  }[healthCheck.status];

  const healthBg = {
    online: "bg-green-950/20 border-green-900/30",
    degraded: "bg-amber-950/20 border-amber-900/30",
    offline: "bg-red-950/20 border-red-900/30",
    loading: "bg-black/20 border-[var(--border)]",
  }[healthCheck.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--accent-red)]" />
          <h3 className="text-sm font-bold text-[var(--text)]">System Health</h3>
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-[10px] text-[var(--text3)]">
              อัปเดต: {lastRefreshed.toLocaleTimeString("th-TH")}
            </span>
          )}
          <button
            onClick={refreshAll}
            disabled={loading}
            className="p-2 text-[var(--text3)] hover:text-white bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Python Service Status */}
      <div className={`p-4 rounded-2xl border ${healthBg} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className={`h-4.5 w-4.5 ${healthColor}`} />
            <span className="text-xs font-bold text-[var(--text)]">Python ArcFace Service</span>
          </div>
          {healthCheck.status === "loading" ? (
            <RefreshCw className="h-4 w-4 text-[var(--text3)] animate-spin" />
          ) : healthCheck.status === "online" ? (
            <div className="flex items-center gap-1.5">
              <Wifi className="h-4 w-4 text-[var(--accent-green)]" />
              <span className="text-[10px] font-extrabold text-[var(--accent-green)] uppercase">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <WifiOff className="h-4 w-4 text-[var(--accent-red)]" />
              <span className="text-[10px] font-extrabold text-[var(--accent-red)] uppercase">
                {healthCheck.status === "degraded" ? "Degraded" : "Offline"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          {healthCheck.responseTime !== null && (
            <span className="text-[var(--text2)]">
              Response: <span className="font-bold text-[var(--text)]">{healthCheck.responseTime}ms</span>
            </span>
          )}
          {healthCheck.serviceInfo?.model && (
            <span className="text-[var(--text2)]">
              Model: <span className="font-bold text-[var(--text)]">{healthCheck.serviceInfo.model}</span>
            </span>
          )}
          {healthCheck.serviceInfo?.detector && (
            <span className="text-[var(--text2)]">
              Detector: <span className="font-bold text-[var(--text)]">{healthCheck.serviceInfo.detector}</span>
            </span>
          )}
        </div>

        {healthCheck.error && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-red)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{healthCheck.error}</span>
          </div>
        )}
      </div>

      {/* DB Stats */}
      {stats && (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider">
              <Database className="h-3.5 w-3.5" />
              <span>Database Statistics</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "รูปทั้งหมด", val: stats.photos.total, color: "text-[var(--accent-purple)]" },
                { label: "ผ่านเกณฑ์", val: stats.photos.approved, color: "text-[var(--accent-green)]" },
                { label: "รอตรวจ", val: stats.photos.pending, color: "text-[var(--accent-yellow)]" },
                { label: "คัดออก", val: stats.photos.rejected, color: "text-[var(--accent-red)]" },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-black/30 border border-[var(--border)] rounded-2xl text-center">
                  <div className="text-[10px] text-[var(--text3)] uppercase font-bold">{item.label}</div>
                  <div className={`text-xl font-display font-extrabold mt-0.5 ${item.color}`}>
                    {item.val.toLocaleString("th-TH")}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-black/20 border border-[var(--border)] rounded-2xl flex items-center gap-3">
              <Cpu className="h-5 w-5 text-[var(--accent-purple)] shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-[var(--text3)] uppercase">Face Embeddings Indexed</div>
                <div className="text-lg font-display font-extrabold text-[var(--accent-purple)]">
                  {stats.totalEmbeddings.toLocaleString("th-TH")} embeddings
                </div>
              </div>
            </div>
          </div>

          {/* Processing Queue */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Processing Queue</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Queued", val: stats.jobs.queued, color: "text-[var(--accent-yellow)]" },
                { label: "Running", val: stats.jobs.running, color: "text-[var(--accent-blue)]" },
                { label: "Done", val: stats.jobs.done, color: "text-[var(--accent-green)]" },
                { label: "Error", val: stats.jobs.error, color: "text-[var(--accent-red)]" },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-black/30 border border-[var(--border)] rounded-2xl text-center">
                  <div className="text-[10px] text-[var(--text3)] uppercase font-bold">{item.label}</div>
                  <div className={`text-xl font-display font-extrabold mt-0.5 ${item.color}`}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Jobs Table */}
            {stats.recentJobs.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="bg-black/25 px-4 py-2.5 flex items-center justify-between border-b border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">Processing Jobs ล่าสุด</span>
                  <div className="flex items-center gap-2">
                    {stats.jobs.queued > 0 && (
                      <button
                        onClick={processNextBatch}
                        disabled={processingNow}
                        className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-green)] hover:text-white bg-green-950/20 border border-green-900/30 px-2.5 py-1 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" />
                        {processingNow ? "Processing..." : "Process Next Batch"}
                      </button>
                    )}
                    {stats.jobs.error > 0 && (
                      <button
                        onClick={retryFailedJobs}
                        disabled={retrying}
                        className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-red)] hover:text-white bg-red-950/20 border border-red-900/30 px-2.5 py-1 rounded-xl transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {retrying ? "Retrying..." : `Retry Failed (${stats.jobs.error})`}
                      </button>
                    )}
                  </div>
                </div>
                {retryMessage && (
                  <div className="px-4 py-2 text-[10px] font-semibold text-[var(--text2)] border-b border-[var(--border)]">
                    {retryMessage}
                  </div>
                )}
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider border-b border-[var(--border)]">
                        <th className="py-2.5 px-4">Event ID</th>
                        <th className="py-2.5 px-4">สถานะ</th>
                        <th className="py-2.5 px-4">ประมวลผล</th>
                        <th className="py-2.5 px-4">เวลา</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-xs text-[var(--text2)]">
                      {stats.recentJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-[var(--surface)] transition-colors">
                          <td className="py-2.5 px-4 font-bold text-[var(--text)] max-w-[120px] truncate">
                            {job.eventId}
                          </td>
                          <td className="py-2.5 px-4">{statusBadge(job.status || "error")}</td>
                          <td className="py-2.5 px-4 font-semibold">
                            {job.processed}/{job.total}
                          </td>
                          <td className="py-2.5 px-4 text-[var(--text3)] text-[10px]">
                            {job.createdAt
                              ? new Date(job.createdAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })
                              : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
