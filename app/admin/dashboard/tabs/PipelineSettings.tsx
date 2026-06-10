"use client";
// app/admin/dashboard/tabs/PipelineSettings.tsx
// Tab 3: Pipeline Settings — blur threshold, brightness range, batch size, thumbnail sizes

import { useState, useEffect, useCallback } from "react";
import { Cpu, Save, CheckCircle2, RefreshCw } from "lucide-react";

interface PipelineData {
  qualityBlurThreshold: number;
  qualityBrightnessMin: number;
  qualityBrightnessMax: number;
  pipelineBatchSize: number;
  thumbnailSizeLg: number;
  thumbnailSizeSm: number;
}

const DEFAULTS: PipelineData = {
  qualityBlurThreshold: 100,
  qualityBrightnessMin: 30,
  qualityBrightnessMax: 240,
  pipelineBatchSize: 5,
  thumbnailSizeLg: 800,
  thumbnailSizeSm: 400,
};

interface SliderFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  isFloat?: boolean;
  unit?: string;
  onChange: (v: number) => void;
}

function SliderField({ label, description, value, min, max, step = 1, isFloat = false, unit, onChange }: SliderFieldProps) {
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
    onChange(v);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
    if (!isNaN(raw)) onChange(Math.max(min, Math.min(max, raw)));
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-3 p-4 bg-black/20 rounded-2xl border border-[var(--border)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5 flex-1">
          <div className="text-xs font-bold text-[var(--text)]">{label}</div>
          <div className="text-[11px] text-[var(--text3)]">{description}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={handleInput}
            className="w-20 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-2 py-1.5 rounded-xl text-xs font-bold text-center outline-none focus:border-[var(--accent-purple)] transition-colors"
          />
          {unit && <span className="text-[10px] text-[var(--text3)] font-semibold">{unit}</span>}
        </div>
      </div>

      <div className="relative">
        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-blue)] rounded-full transition-all"
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
        <span>{min}{unit ? ` ${unit}` : ""}</span>
        <span>{max}{unit ? ` ${unit}` : ""}</span>
      </div>
    </div>
  );
}

export function PipelineSettings() {
  const [settings, setSettings] = useState<PipelineData>(DEFAULTS);
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
      const res = await fetch("/api/admin/pipeline");
      const data = await res.json();
      if (data.success) setSettings(data.pipeline);
    } catch {
      showToast("error", "ไม่สามารถโหลดการตั้งค่า Pipeline ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.pipeline);
        showToast("success", "บันทึกการตั้งค่า Pipeline สำเร็จ!");
      } else {
        showToast("error", data.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch {
      showToast("error", "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof PipelineData) => (v: number) =>
    setSettings((prev) => ({ ...prev, [key]: v }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[var(--text2)]">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-xs font-semibold">กำลังโหลดการตั้งค่า Pipeline...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-[var(--accent-green)]" />
          <h3 className="text-sm font-bold text-[var(--text)]">Pipeline Settings</h3>
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
        <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-semibold ${
          toast.type === "success"
            ? "bg-green-950/20 border-green-900/30 text-[var(--accent-green)]"
            : "bg-red-950/20 border-red-900/30 text-[var(--accent-red)]"
        }`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Quality Section */}
      <div className="space-y-3">
        <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider px-1">คุณภาพรูปภาพ (Quality Filter)</div>
        <SliderField
          label="Blur rejection threshold (Laplacian variance)"
          description="รูปที่คมจะมี variance สูง รูปเบลอจะมี variance ต่ำ — ตั้งค่าสูงขึ้น = strict มากขึ้น"
          value={settings.qualityBlurThreshold}
          min={50}
          max={200}
          step={1}
          onChange={set("qualityBlurThreshold")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SliderField
            label="Brightness min"
            description="ระดับความสว่างขั้นต่ำ (0–255) — รูปที่มืดกว่านี้จะถูกคัดออก"
            value={settings.qualityBrightnessMin}
            min={0}
            max={254}
            step={1}
            onChange={set("qualityBrightnessMin")}
          />
          <SliderField
            label="Brightness max"
            description="ระดับความสว่างสูงสุด (0–255) — รูปที่สว่างเกินจะถูกคัดออก"
            value={settings.qualityBrightnessMax}
            min={1}
            max={255}
            step={1}
            onChange={set("qualityBrightnessMax")}
          />
        </div>
      </div>

      {/* Performance Section */}
      <div className="space-y-3">
        <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider px-1">ประสิทธิภาพ (Performance)</div>
        <SliderField
          label="Photos per batch"
          description="จำนวนรูปที่ประมวลผลต่อ batch — ค่าสูงเร็วกว่า แต่ใช้ RAM มากขึ้น (แนะนำ 5 สำหรับ Render Free Tier)"
          value={settings.pipelineBatchSize}
          min={1}
          max={20}
          step={1}
          onChange={set("pipelineBatchSize")}
          unit="รูป"
        />
      </div>

      {/* Thumbnails Section */}
      <div className="space-y-3">
        <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider px-1">ขนาด Thumbnail (Cloudflare R2)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SliderField
            label="Thumbnail large (lg)"
            description="ขนาดสำหรับ Gallery view — แสดงในหน้าแกลเลอรีหลัก"
            value={settings.thumbnailSizeLg}
            min={400}
            max={2000}
            step={50}
            onChange={set("thumbnailSizeLg")}
            unit="px"
          />
          <SliderField
            label="Thumbnail small (sm)"
            description="ขนาดสำหรับ grid card — ใช้ใน preview ขนาดเล็ก"
            value={settings.thumbnailSizeSm}
            min={100}
            max={800}
            step={50}
            onChange={set("thumbnailSizeSm")}
            unit="px"
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-blue)] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า Pipeline"}
      </button>
    </div>
  );
}
