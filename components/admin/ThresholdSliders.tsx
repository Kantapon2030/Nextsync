// components/admin/ThresholdSliders.tsx
"use client";

import { useState, useEffect } from "react";
import { Save, RefreshCw, AlertTriangle, CheckCircle2, Search, Sparkles, ToggleLeft, ToggleRight } from "lucide-react";

interface FilterConfig {
  minFaceConfidence: number;
  faceSimilarityDist: number;
  watermarkEnabled: boolean;
}

export function ThresholdSliders() {
  const [config, setConfig] = useState<FilterConfig>({
    minFaceConfidence: 0.50,
    faceSimilarityDist: 0.60,
    watermarkEnabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/config");
      const data = await res.json();
      if (data.success && data.config) {
        setConfig({
          minFaceConfidence: data.config.minFaceConfidence ?? 0.50,
          faceSimilarityDist: data.config.faceSimilarityDist ?? 0.42,
          watermarkEnabled: data.config.watermarkEnabled ?? true,
        });
      } else {
        setMessage({ type: "error", text: data.error || "โหลดข้อมูลการตั้งค่าไม่สำเร็จ" });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อดึงข้อมูลได้" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "อัปเดตการตั้งค่าเรียบร้อยแล้ว" });
      } else {
        setMessage({ type: "error", text: data.error || "อัปเดตข้อมูลล้มเหลว" });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-bold text-[var(--text3)] animate-pulse">กำลังโหลดการตั้งค่าระบบ...</p>
      </div>
    );
  }

  return (
    <div className="glass border border-[var(--border)] overflow-hidden select-none">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-black/25">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--accent-purple)]" />
          <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">การตั้งค่าระบบ AI & Watermark</h3>
        </div>
        <button
          onClick={fetchConfig}
          className="p-1.5 hover:bg-[var(--surface-hover)] rounded-xl text-[var(--text2)] hover:text-white transition-colors"
          title="รีเฟรชข้อมูล"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {message && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              message.type === "success"
                ? "bg-green-950/20 border-green-900/30 text-[var(--accent-green)]"
                : "bg-red-950/20 border-red-900/30 text-[var(--accent-red)]"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Note: Quality filter removed */}
        <div className="p-4 rounded-2xl border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/5 text-xs text-[var(--accent-blue)] leading-relaxed">
          <p className="font-bold mb-1">ℹ️ ระบบคัดกรองรูปภาพถูกปิดใช้งาน</p>
          <p className="text-[var(--text3)]">รูปทุกรูปที่อัปโหลดจาก Google Drive จะได้รับการอนุมัติอัตโนมัติโดยไม่มีการกรองคุณภาพ ช่วยให้การประมวลผลเร็วกว่าเดิมหลายเท่า</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Face Confidence */}
          <div className="p-4 bg-black/35 border border-[var(--border)] rounded-2xl space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Search className="h-4 w-4 text-[var(--accent-blue)]" />
              <span className="text-xs font-bold text-[var(--text2)]">ความมั่นใจการตรวจจับใบหน้า</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text3)]">Min Face Confidence</span>
              <span className="text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-2 py-0.5 rounded-lg border border-[var(--accent-blue)]/20 font-bold">
                {(config.minFaceConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.90"
              step="0.05"
              value={config.minFaceConfidence}
              onChange={(e) => setConfig({ ...config, minFaceConfidence: Number(e.target.value) })}
              className="w-full h-1.5 bg-black/30 rounded-lg appearance-none cursor-pointer accent-[var(--accent-blue)]"
            />
            <p className="text-[10px] text-[var(--text3)] leading-normal">
              ความแม่นยำในการตรวจจับใบหน้าขณะ index รูปถ่าย ค่าต่ำรองรับใบหน้าแต่งหน้าหนักได้ดีกว่า
            </p>
          </div>

          {/* Face Similarity (L2 Distance) */}
          <div className="p-4 bg-black/35 border border-[var(--border)] rounded-2xl space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Search className="h-4 w-4 text-[var(--accent-purple)]" />
              <span className="text-xs font-bold text-[var(--text2)]">ระยะห่างจับคู่ใบหน้า (Face Distance Threshold)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text3)]">Distance Threshold (L2)</span>
              <span className="text-[var(--accent-purple)] bg-[var(--accent-purple)]/10 px-2 py-0.5 rounded-lg border border-[var(--accent-purple)]/20 font-bold">
                {config.faceSimilarityDist}
              </span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.80"
              step="0.02"
              value={config.faceSimilarityDist}
              onChange={(e) => setConfig({ ...config, faceSimilarityDist: Number(e.target.value) })}
              className="w-full h-1.5 bg-black/30 rounded-lg appearance-none cursor-pointer accent-[var(--accent-purple)]"
            />
            <p className="text-[10px] text-[var(--text3)] leading-normal">
              ระยะห่าง Euclidean distance สูงสุดในการจับคู่ใบหน้า (ค่ามาตรฐาน: 0.60, ค่าต่ำ = เข้มงวดขึ้น, ค่าสูง = ผ่อนปรนขึ้น)
            </p>
          </div>
        </div>

        {/* Watermark Toggle */}
        <div className="p-5 bg-black/35 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-bold text-[var(--text)]">โลโก้ NextSync ∞ บนรูปที่แต่ง</span>
              </div>
              <p className="text-[11px] text-[var(--text3)] leading-relaxed max-w-md">
                เมื่อเปิดใช้งาน รูปที่ผ่านการตกแต่งและดาวน์โหลดจะมีโลโก้ &quot;NextSync ∞&quot; ที่มุมขวาล่างโดยอัตโนมัติ
              </p>
            </div>
            <button
              onClick={() => setConfig({ ...config, watermarkEnabled: !config.watermarkEnabled })}
              className="shrink-0 transition-all hover:scale-105 active:scale-95"
              title={config.watermarkEnabled ? "คลิกเพื่อปิดโลโก้" : "คลิกเพื่อเปิดโลโก้"}
            >
              {config.watermarkEnabled ? (
                <ToggleRight className="h-10 w-10 text-[var(--accent-green)]" />
              ) : (
                <ToggleLeft className="h-10 w-10 text-[var(--text3)]" />
              )}
            </button>
          </div>
          <div className={`mt-3 text-[10px] font-bold px-3 py-1.5 rounded-lg w-fit ${
            config.watermarkEnabled 
              ? "bg-green-950/30 text-[var(--accent-green)] border border-green-900/30"
              : "bg-[var(--surface)] text-[var(--text3)] border border-[var(--border)]"
          }`}>
            {config.watermarkEnabled ? "✅ โลโก้เปิดใช้งาน" : "⭕ โลโก้ปิดใช้งาน"}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <button
            onClick={fetchConfig}
            disabled={saving}
            className="px-5 py-2.5 text-xs font-bold text-[var(--text2)] hover:text-white hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all"
          >
            ล้างค่า / รีเฟรช
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThresholdSliders;
