// components/gallery/PhotoEditorModal.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Download, RotateCcw, Wand2, Sun, Contrast,
  Droplets, Thermometer, Circle, Zap, Layers,
  Sparkles, RefreshCw, SplitSquareHorizontal
} from "lucide-react";
import { PhotoData } from "./PhotoCard";

interface PhotoEditorModalProps {
  photo: PhotoData;
  onClose: () => void;
}

interface BasicSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  vignette: number;
}

interface AdvancedSettings {
  highlights: number;
  shadows: number;
  sharpen: number;
  fade: number;
  grain: number;
}

const DEFAULT_BASIC: BasicSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  vignette: 0,
};

const DEFAULT_ADVANCED: AdvancedSettings = {
  highlights: 0,
  shadows: 0,
  sharpen: 0,
  fade: 0,
  grain: 0,
};

type TabType = "basic" | "advanced" | "auto";

function Slider({
  label,
  icon,
  value,
  min = -100,
  max = 100,
  onChange,
  color = "var(--accent-blue)",
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-[var(--text2)] flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg border min-w-[40px] text-center"
          style={{
            color,
            borderColor: `${color}33`,
            background: `${color}15`,
          }}
        >
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}

export function PhotoEditorModal({ photo, onClose }: PhotoEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const [tab, setTab] = useState<TabType>("basic");
  const [basic, setBasic] = useState<BasicSettings>(DEFAULT_BASIC);
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_ADVANCED);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);

  // Fetch watermark setting from admin config
  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.config) {
          setWatermarkEnabled(data.config.watermarkEnabled ?? true);
        }
      })
      .catch(() => {}); // graceful fallback
  }, []);

  // Load the original image
  useEffect(() => {
    const imgSrc = photo.thumbnailUrl || photo.driveUrl;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      originalImageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      // Fallback: try proxying the backup drive URL via local api
      if (img.src !== `/api/photos/proxy?url=${encodeURIComponent(photo.driveUrl)}`) {
        img.src = `/api/photos/proxy?url=${encodeURIComponent(photo.driveUrl)}`;
      }
    };
    // Use local proxy to bypass CORS
    img.src = `/api/photos/proxy?url=${encodeURIComponent(imgSrc)}`;
  }, [photo]);

  // Re-render canvas whenever settings change
  useEffect(() => {
    if (!imageLoaded) return;
    renderCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basic, advanced, imageLoaded, showBefore]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d")!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    if (showBefore) {
      ctx.drawImage(img, 0, 0);
      return;
    }

    // ─── Apply CSS filters (basic adjustments) ───
    const brightnessVal = 1 + basic.brightness / 100;
    const contrastVal = 1 + basic.contrast / 100;
    const saturateVal = 1 + basic.saturation / 100;

    ctx.filter = [
      `brightness(${brightnessVal})`,
      `contrast(${contrastVal})`,
      `saturate(${saturateVal})`,
    ].join(" ");

    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";

    // ─── Warmth: shift red/blue channels ───
    if (basic.warmth !== 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = basic.warmth;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] + w * 0.8);       // R up for warm
        data[i + 2] = Math.max(0, data[i + 2] - w * 0.6); // B down for warm
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // ─── Fade (lift blacks / matte) ───
    if (advanced.fade > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const lift = advanced.fade * 0.5;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] + lift);
        data[i + 1] = Math.min(255, data[i + 1] + lift);
        data[i + 2] = Math.min(255, data[i + 2] + lift);
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // ─── Highlights & Shadows ───
    if (advanced.highlights !== 0 || advanced.shadows !== 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;

        let adjust = 0;
        if (lum > 0.6) {
          adjust = advanced.highlights * (lum - 0.6) / 0.4;
        } else if (lum < 0.4) {
          adjust = advanced.shadows * (0.4 - lum) / 0.4;
        }

        data[i] = Math.min(255, Math.max(0, data[i] + adjust));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + adjust));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + adjust));
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // ─── Sharpen (unsharp mask) ───
    if (advanced.sharpen > 0) {
      const strength = advanced.sharpen / 100;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const src = new Uint8ClampedArray(imageData.data);
      const { width, height } = canvas;
      const kernel = [0, -1, 0, -1, 4 + 1 / strength, -1, 0, -1, 0];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            const orig = src[idx + c];
            const blur =
              src[((y - 1) * width + x) * 4 + c] * -0.1 +
              src[(y * width + x - 1) * 4 + c] * -0.1 +
              orig * 1.4 +
              src[(y * width + x + 1) * 4 + c] * -0.1 +
              src[((y + 1) * width + x) * 4 + c] * -0.1;
            imageData.data[idx + c] = Math.min(255, Math.max(0, blur));
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // ─── Grain ───
    if (advanced.grain > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const amount = advanced.grain * 0.8;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * amount;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // ─── Vignette ───
    if (basic.vignette > 0) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.sqrt(cx * cx + cy * cy);
      const grad = ctx.createRadialGradient(cx, cy, r * (1 - basic.vignette / 130), cx, cy, r);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${basic.vignette / 120})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ─── NextSync Watermark ───
    if (watermarkEnabled) {
      const fontSize = Math.max(16, canvas.width * 0.028);
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("NextSync ∞", canvas.width - fontSize * 0.5, canvas.height - fontSize * 0.4);
      ctx.shadowBlur = 0;
    }
  }, [basic, advanced, showBefore, watermarkEnabled]);

  // ─── Auto Mode ───
  const applyAuto = useCallback(() => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    // Draw fresh for histogram analysis
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    let totalR = 0, totalG = 0, totalB = 0;
    let minLum = 255, maxLum = 0;
    const n = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }

    const avgR = totalR / n;
    const avgG = totalG / n;
    const avgB = totalB / n;
    const avgGray = (avgR + avgG + avgB) / 3;
    const meanLum = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB);

    // Auto white balance: push toward gray
    const warmthAdjust = Math.round(((avgR - avgB) / avgGray) * -15);
    const warmthClamped = Math.max(-50, Math.min(50, warmthAdjust));

    // Auto levels: adjust brightness based on mean luminance
    const targetMean = 130;
    const brightAdj = Math.round(((targetMean - meanLum) / 255) * 60);
    const brightClamped = Math.max(-40, Math.min(40, brightAdj));

    // Auto contrast: based on dynamic range
    const range = maxLum - minLum;
    const contrastAdj = range < 150 ? Math.round((1 - range / 255) * 30) : 0;

    setBasic({
      brightness: brightClamped,
      contrast: contrastAdj,
      saturation: 10,
      warmth: warmthClamped,
      vignette: 20,
    });
    setAdvanced({
      highlights: -10,
      shadows: 15,
      sharpen: 20,
      fade: 0,
      grain: 0,
    });
    setAutoApplied(true);
  }, []);

  const handleReset = () => {
    setBasic(DEFAULT_BASIC);
    setAdvanced(DEFAULT_ADVANCED);
    setAutoApplied(false);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const baseName = photo.filename.replace(/\.[^/.]+$/, "");
          a.download = `nextsync_${baseName}_edited.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        },
        "image/jpeg",
        0.90
      );
    } finally {
      setSaving(false);
    }
  };

  const TAB_ITEMS: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "basic", label: "Basic", icon: <Sun className="h-3.5 w-3.5" /> },
    { key: "advanced", label: "Advanced", icon: <Layers className="h-3.5 w-3.5" /> },
    { key: "auto", label: "Auto ✨", icon: <Sparkles className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative w-full max-w-6xl h-[90vh] glass rounded-3xl overflow-hidden border border-[var(--border)] bg-[#080b18]/95 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-violet-400" />
            <h2 className="text-sm font-bold text-white">ตกแต่งรูปภาพ</h2>
            <span className="text-[10px] text-[var(--text3)] font-mono truncate max-w-[200px]">{photo.filename}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--surface-hover)] text-[var(--text2)] hover:text-white rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Canvas Preview */}
          <div className="flex-1 relative bg-[#05070f] flex items-center justify-center p-4 overflow-hidden">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center gap-3 text-white">
                <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
                <span className="text-sm">กำลังโหลดรูปภาพ...</span>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              style={{ display: imageLoaded ? "block" : "none" }}
            />

            {/* Before/After toggle button */}
            {imageLoaded && (
              <button
                onMouseDown={() => setShowBefore(true)}
                onMouseUp={() => setShowBefore(false)}
                onTouchStart={() => setShowBefore(true)}
                onTouchEnd={() => setShowBefore(false)}
                className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-semibold rounded-xl backdrop-blur-md border border-white/10 transition-all"
              >
                <SplitSquareHorizontal className="h-3.5 w-3.5" />
                กดค้างเพื่อดูก่อนแต่ง
              </button>
            )}

            {/* Watermark indicator */}
            {watermarkEnabled && imageLoaded && (
              <div className="absolute bottom-4 right-4 text-[10px] text-white/40 font-semibold">
                โลโก้ NextSync ∞ จะติดบนรูปที่บันทึก
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="w-72 xl:w-80 shrink-0 border-l border-[var(--border)] flex flex-col bg-[#0a0d1a]/80">
            {/* Tabs */}
            <div className="flex p-3 gap-1 border-b border-[var(--border)] shrink-0">
              {TAB_ITEMS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    if (t.key === "auto" && !autoApplied) applyAuto();
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
                    tab === t.key
                      ? "bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md"
                      : "text-[var(--text2)] hover:text-white hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sliders */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {tab === "basic" && (
                <>
                  <Slider
                    label="ความสว่าง"
                    icon={<Sun className="h-3.5 w-3.5" />}
                    value={basic.brightness}
                    onChange={(v) => setBasic((b) => ({ ...b, brightness: v }))}
                    color="var(--accent-yellow)"
                  />
                  <Slider
                    label="ความคมชัด"
                    icon={<Contrast className="h-3.5 w-3.5" />}
                    value={basic.contrast}
                    onChange={(v) => setBasic((b) => ({ ...b, contrast: v }))}
                    color="var(--accent-blue)"
                  />
                  <Slider
                    label="ความอิ่มสี"
                    icon={<Droplets className="h-3.5 w-3.5" />}
                    value={basic.saturation}
                    onChange={(v) => setBasic((b) => ({ ...b, saturation: v }))}
                    color="var(--accent-purple)"
                  />
                  <Slider
                    label="ความอุ่น"
                    icon={<Thermometer className="h-3.5 w-3.5" />}
                    value={basic.warmth}
                    onChange={(v) => setBasic((b) => ({ ...b, warmth: v }))}
                    color="#f97316"
                  />
                  <Slider
                    label="Vignette"
                    icon={<Circle className="h-3.5 w-3.5" />}
                    value={basic.vignette}
                    min={0}
                    max={100}
                    onChange={(v) => setBasic((b) => ({ ...b, vignette: v }))}
                    color="var(--accent-red)"
                  />
                </>
              )}

              {tab === "advanced" && (
                <>
                  <Slider
                    label="Highlights"
                    icon={<Sun className="h-3.5 w-3.5" />}
                    value={advanced.highlights}
                    onChange={(v) => setAdvanced((a) => ({ ...a, highlights: v }))}
                    color="#fbbf24"
                  />
                  <Slider
                    label="Shadows"
                    icon={<Layers className="h-3.5 w-3.5" />}
                    value={advanced.shadows}
                    onChange={(v) => setAdvanced((a) => ({ ...a, shadows: v }))}
                    color="#60a5fa"
                  />
                  <Slider
                    label="Sharpen"
                    icon={<Zap className="h-3.5 w-3.5" />}
                    value={advanced.sharpen}
                    min={0}
                    max={100}
                    onChange={(v) => setAdvanced((a) => ({ ...a, sharpen: v }))}
                    color="var(--accent-green)"
                  />
                  <Slider
                    label="Fade / Matte"
                    icon={<SplitSquareHorizontal className="h-3.5 w-3.5" />}
                    value={advanced.fade}
                    min={0}
                    max={100}
                    onChange={(v) => setAdvanced((a) => ({ ...a, fade: v }))}
                    color="#a78bfa"
                  />
                  <Slider
                    label="Film Grain"
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    value={advanced.grain}
                    min={0}
                    max={100}
                    onChange={(v) => setAdvanced((a) => ({ ...a, grain: v }))}
                    color="#94a3b8"
                  />
                </>
              )}

              {tab === "auto" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-violet-950/30 border border-violet-800/30 text-xs text-violet-300 leading-relaxed">
                    <p className="font-bold mb-1">✨ Auto Enhancement</p>
                    <p>ระบบวิเคราะห์ histogram ของภาพและปรับ brightness, contrast, white balance, และ vignette ให้อัตโนมัติ</p>
                  </div>
                  <button
                    onClick={() => { applyAuto(); setAutoApplied(true); }}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-700 hover:brightness-110 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    ปรับอัตโนมัติ
                  </button>
                  {autoApplied && (
                    <p className="text-[11px] text-center text-[var(--accent-green)] font-semibold">
                      ✅ ปรับค่าอัตโนมัติแล้ว สามารถ fine-tune ต่อใน Basic/Advanced ได้
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-[var(--border)] space-y-2 shrink-0">
              <button
                onClick={handleReset}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-[var(--text2)] hover:text-white border border-[var(--border)] hover:bg-[var(--surface-hover)] rounded-xl transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                รีเซ็ตทั้งหมด
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !imageLoaded}
                className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-700 hover:brightness-110 rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-violet-900/40"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {watermarkEnabled ? "💾 บันทึก + โลโก้ NextSync" : "💾 บันทึกรูปภาพ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhotoEditorModal;
