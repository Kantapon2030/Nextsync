"use client";
// app/admin/dashboard/tabs/FaceSettings.tsx
// Tab 2: Face Search Settings — ef_search, cosine_threshold, max_results, min_face_confidence

import { useState, useEffect, useCallback } from "react";
import { SlidersHorizontal, Save, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

interface FaceSettingsData {
  efSearch: number;
  cosineThreshold: number;
  maxResults: number;
  minFaceConfidence: number;
}

const DEFAULTS: FaceSettingsData = {
  efSearch: 64,
  cosineThreshold: 0.35,
  maxResults: 50,
  minFaceConfidence: 0.85,
};

interface SliderFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  isFloat?: boolean;
  onChange: (v: number) => void;
  warningThreshold?: number;
  warningMsg?: string;
}

function SliderField({
  label, description, value, min, max, step = 1, isFloat = false,
  onChange, warningThreshold, warningMsg,
}: SliderFieldProps) {
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
    onChange(v);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
    if (!isNaN(raw)) {
      onChange(Math.max(min, Math.min(max, raw)));
    }
  };

  const showWarning = warningThreshold !== undefined && value > warningThreshold;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-3 p-4 bg-black/20 rounded-2xl border border-[var(--border)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5 flex-1">
          <div className="text-xs font-bold text-[var(--text)]">{label}</div>
          <div className="text-[11px] text-[var(--text3)]">{description}</div>
        </div>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleInput}
          className="w-20 shrink-0 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-2 py-1.5 rounded-xl text-xs font-bold text-center outline-none focus:border-[var(--accent-purple)] transition-colors"
        />
      </div>

      <div className="relative">
        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSlider}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="flex justify-between text-[10px] text-[var(--text3)] font-semibold">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      {showWarning && warningMsg && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-yellow)] bg-amber-950/20 border border-amber-900/30 px-3 py-2 rounded-xl">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{warningMsg}</span>
        </div>
      )}
    </div>
  );
}

export function FaceSettings() {
  const [settings, setSettings] = useState<FaceSettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) setSettings(data.settings);
    } catch {
      showToast("error", "ไม่สามารถโหลดการตั้งค่าได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        showToast("success", "บันทึกการตั้งค่าสำเร็จ!");
      } else {
        showToast("error", data.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch {
      showToast("error", "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof FaceSettingsData) => (v: number) =>
    setSettings((prev) => ({ ...prev, [key]: v }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[var(--text2)]">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-xs font-semibold">กำลังโหลดการตั้งค่า...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-[var(--accent-purple)]" />
          <h3 className="text-sm font-bold text-[var(--text)]">Face Search Settings</h3>
        </div>
        <button
          onClick={fetchSettings}
          className="p-2 text-[var(--text3)] hover:text-white bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-semibold transition-all ${
          toast.type === "success"
            ? "bg-green-950/20 border-green-900/30 text-[var(--accent-green)]"
            : "bg-red-950/20 border-red-900/30 text-[var(--accent-red)]"
        }`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Sliders */}
      <div className="space-y-4">
        <SliderField
          label="Vector search depth (ef_search)"
          description="ค่าสูง = แม่นยำกว่า แต่ช้ากว่า — กำหนดขอบเขตการสำรวจ HNSW graph ในแต่ละ query"
          value={settings.efSearch}
          min={16}
          max={128}
          step={1}
          onChange={set("efSearch")}
          warningThreshold={100}
          warningMsg="ef_search สูงกว่า 100 อาจทำให้ face search ช้าลงอย่างเห็นได้ชัด"
        />
        <SliderField
          label="Face match threshold (cosine distance)"
          description="ค่าต่ำ = strict (เจอน้อย แต่แม่น), ค่าสูง = loose (เจอมาก แต่อาจผิด)"
          value={settings.cosineThreshold}
          min={0.10}
          max={0.60}
          step={0.01}
          isFloat
          onChange={set("cosineThreshold")}
        />
        <SliderField
          label="Max photos per search"
          description="จำนวน LIMIT ใน query — ค่าสูงจะดึงรูปได้มากขึ้น แต่ช้าลงและใช้ bandwidth มากขึ้น"
          value={settings.maxResults}
          min={10}
          max={200}
          step={1}
          onChange={set("maxResults")}
        />
        <SliderField
          label="Minimum detection confidence"
          description="กรองผลลัพธ์ใบหน้าที่ detect ได้ไม่ชัดเจนออก — ค่าสูงทำให้ strict มากขึ้น"
          value={settings.minFaceConfidence}
          min={0.50}
          max={0.99}
          step={0.01}
          isFloat
          onChange={set("minFaceConfidence")}
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "ef_search", val: settings.efSearch },
          { label: "threshold", val: settings.cosineThreshold.toFixed(2) },
          { label: "max results", val: settings.maxResults },
          { label: "min confidence", val: settings.minFaceConfidence.toFixed(2) },
        ].map((item) => (
          <div key={item.label} className="p-3 bg-black/30 border border-[var(--border)] rounded-2xl text-center">
            <div className="text-[10px] text-[var(--text3)] uppercase font-bold">{item.label}</div>
            <div className="text-lg font-display font-extrabold text-[var(--accent-purple)] mt-0.5">{item.val}</div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า Face Search"}
      </button>
    </div>
  );
}
