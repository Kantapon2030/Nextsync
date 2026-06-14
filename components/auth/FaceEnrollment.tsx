// components/auth/FaceEnrollment.tsx
// Single front-facing capture UI using camera capture with automatic countdown.
// Sends images directly to /api/face/enroll which delegates to Python ArcFace service.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Camera, Sparkles } from "lucide-react";

type Angle = "ตรง";

const ANGLES: Angle[] = ["ตรง"];

const ANGLE_HINT: Record<Angle, string> = {
  ตรง: "มองตรงเข้าหากล้อง รักษาระยะห่าง 40–60 ซม. 😐",
};

const ANGLE_COLOR: Record<Angle, string> = {
  ตรง: "var(--accent-blue)",
};

interface FaceEnrollmentProps {
  /** Called when enrollment completes successfully. */
  onComplete: () => void;
}

export function FaceEnrollment({ onComplete }: FaceEnrollmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState(0); // 0=front, 1=done
  const [captures, setCaptures] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);

  // Auto scan states
  const [autoScan, setAutoScan] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Start camera on mount, stop on unmount
  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCamReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Capture the current camera frame as a File
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !camReady) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror-flip so the saved image is not mirrored
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const currentAngle = ANGLES[step];
        const file = new File([blob], `face_${currentAngle}.jpg`, {
          type: "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(blob);

        setCaptures((prev) => [...prev, file]);
        setPreviews((prev) => [...prev, previewUrl]);
        setStep((s) => s + 1);
      },
      "image/jpeg",
      0.92
    );
  }, [step, camReady]);

  // Submit all captured images to /api/face/enroll
  const handleSubmit = useCallback(async () => {
    if (captures.length === 0) return;
    setUploading(true);
    setError(null);

    const form = new FormData();
    captures.forEach((f, i) => form.append(`image${i + 1}`, f));

    try {
      const res = await fetch("/api/face/enroll", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "เกิดข้อผิดพลาดในการบันทึกใบหน้า");
      }

      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setUploading(false);
    }
  }, [captures, onComplete]);

  // Auto Scan Countdown Logic
  useEffect(() => {
    if (!autoScan || !camReady || step >= ANGLES.length || uploading) {
      setCountdown(null);
      return;
    }

    // Reset countdown to 3 when entering a new step
    setCountdown(3);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          // Trigger capture in the next tick
          setTimeout(() => {
            captureFrame();
          }, 50);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, autoScan, camReady, uploading, captureFrame]);

  // Auto Submit Logic
  useEffect(() => {
    if (autoScan && step === ANGLES.length && captures.length === ANGLES.length && !uploading && !error) {
      handleSubmit();
    }
  }, [step, captures, autoScan, uploading, error, handleSubmit]);

  const done = step >= ANGLES.length;
  const currentAngle = ANGLES[Math.min(step, ANGLES.length - 1)];
  const accentColor = ANGLE_COLOR[currentAngle];

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      {/* Step Progress Pills */}
      <div className="flex items-center gap-3">
        {ANGLES.map((a, i) => {
          const completed = i < captures.length;
          const active = i === step && !done;
          return (
            <div
              key={a}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  completed
                    ? "bg-[var(--accent-green)] text-white scale-110 shadow-lg"
                    : active
                    ? "scale-110 shadow-lg"
                    : "bg-slate-800 text-slate-500"
                }`}
                style={active ? { background: ANGLE_COLOR[a], color: "#000" } : undefined}
              >
                {completed ? "✓" : i + 1}
              </div>
              <span
                className="text-[9px] font-bold uppercase"
                style={{ color: completed || active ? ANGLE_COLOR[a] : "var(--text3)" }}
              >
                {a}
              </span>
            </div>
          );
        })}
      </div>

      {/* Camera / Preview Box */}
      <div
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border bg-black/40 shadow-2xl"
        style={{
          borderColor: `${accentColor}60`,
          boxShadow: `0 0 30px ${accentColor}18`,
        }}
      >
        {/* Live video (mirrored for user comfort) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Show last captured preview as flash overlay */}
        {previews.length > 0 && !done && (
          <div
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: step === previews.length ? 0 : 0 }}
          />
        )}

        {/* When done, show the captured front-facing preview */}
        {done && previews[0] && (
          <img
            src={previews[0]}
            alt="Captured"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Face guide */}
        {!done && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative w-[160px] h-[210px] rounded-[50%] border-2 border-dashed transition-all duration-500 flex items-center justify-center"
              style={{
                borderColor: `${accentColor}80`,
                transform: "none",
              }}
            />
          </div>
        )}

        {/* Countdown overlay for Auto Scan */}
        {countdown !== null && !done && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 backdrop-blur-[2px] transition-all duration-300">
            <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-4 border-white bg-black/50 shadow-[0_0_20px_rgba(255,255,255,0.4)] animate-pulse">
              <span className="text-5xl font-black text-white">{countdown}</span>
            </div>
            <span className="mt-4 text-xs font-semibold text-white bg-black/60 px-3 py-1.5 rounded-full border border-slate-800/80 shadow">
              กรุณานิ่งและมองกล้อง
            </span>
          </div>
        )}

        {/* Bottom status bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3.5">
          <p
            className="text-xs font-semibold text-center"
            style={{ color: done ? "var(--accent-green)" : accentColor }}
          >
            {done
              ? "✓ ถ่ายหน้าตรงแล้ว กำลังดำเนินการ..."
              : camReady
              ? ANGLE_HINT[currentAngle]
              : "กำลังเปิดกล้อง..."}
          </p>
        </div>

        {/* No camera error overlay */}
        {error && error.includes("กล้อง") && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="h-10 w-10 text-[var(--accent-yellow)]" />
            <p className="text-sm font-medium text-[var(--text)]">{error}</p>
          </div>
        )}
      </div>

      {/* Auto Scan Toggle Switch */}
      <div className="flex items-center justify-between w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl px-4 py-3 backdrop-blur-sm shadow">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            สแกนอัตโนมัติ (Auto Scan)
          </span>
          <span className="text-[10px] text-[var(--text3)]">
            ระบบจะนับถอยหลังและถ่ายภาพหน้าตรงให้โดยไม่ต้องกดปุ่ม
          </span>
        </div>
        <button
          onClick={() => {
            setAutoScan(!autoScan);
            if (autoScan) {
              setCountdown(null);
            }
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            autoScan ? "bg-[var(--accent-blue)]" : "bg-slate-800"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              autoScan ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Thumbnail strip of captured images */}
      {previews.length > 0 && (
        <div className="flex gap-3 w-full">
          {previews.map((url, i) => (
            <div
              key={i}
              className="relative flex-1 aspect-square rounded-xl overflow-hidden border-2 border-[var(--accent-green)] shadow"
            >
              <img src={url} alt={ANGLES[i]} className="w-full h-full object-cover" />
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/70 px-1.5 py-0.5 rounded-full">
                <span className="text-[8px] font-bold text-[var(--accent-green)]">
                  ✓ {ANGLES[i]}
                </span>
              </div>
            </div>
          ))}
          {/* Empty placeholders for upcoming angles */}
          {ANGLES.slice(previews.length).map((a) => (
            <div
              key={a}
              className="flex-1 aspect-square rounded-xl border-2 border-dashed border-[var(--border)] flex items-center justify-center bg-[var(--surface)]"
            >
              <span className="text-[8px] font-bold text-[var(--text3)]">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Non-camera errors */}
      {error && !error.includes("กล้อง") && (
        <div className="w-full bg-red-950/20 border border-red-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-[var(--accent-red)] text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 w-full">
        {!done ? (
          <button
            onClick={captureFrame}
            disabled={!camReady || autoScan}
            className="flex-1 py-3.5 font-semibold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: camReady && !autoScan ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` : undefined,
              backgroundColor: camReady && !autoScan ? undefined : "var(--surface)",
              color: camReady && !autoScan ? (currentAngle === "ตรง" ? "#fff" : "#000") : "var(--text3)",
            }}
          >
            <Camera className="h-4 w-4" />
            <span>
              {autoScan 
                ? `กำลังสแกนหน้า${currentAngle}อัตโนมัติ...`
                : `ถ่ายหน้า${currentAngle}`
              }
            </span>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex-1 py-3.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:opacity-70 text-white font-semibold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            {uploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>กำลังบันทึกใบหน้า...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>✓ ยืนยันและบันทึกใบหน้า</span>
              </>
            )}
          </button>
        )}

        {/* Reset button if some captures exist but not done */}
        {step > 0 && !done && !uploading && (
          <button
            onClick={() => {
              setStep(0);
              setCaptures([]);
              setPreviews([]);
              setError(null);
            }}
            className="px-4 py-3.5 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text2)] font-semibold rounded-2xl text-sm transition-all"
          >
            รีเซ็ต
          </button>
        )}
      </div>

      {/* Tip */}
      <p className="text-[10px] text-[var(--text3)] text-center leading-relaxed max-w-xs">
        ถ่ายหน้าตรงในที่สว่าง และมองกล้องให้ชัดเจน
      </p>
    </div>
  );
}

export default FaceEnrollment;
