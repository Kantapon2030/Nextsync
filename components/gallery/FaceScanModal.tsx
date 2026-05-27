// components/gallery/FaceScanModal.tsx
// Face scan modal for gallery — two modes:
//   "search": captures face images → sends to /api/face/search (uses stored enrollment)
//   "enroll": captures face images → sends to /api/face/enroll (3-angle ArcFace)
// All face processing now happens server-side via the Python ArcFace microservice.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Camera, RefreshCw, CheckCircle2, AlertCircle, X, Sparkles, UserCheck, Info } from "lucide-react";

type Angle = "ตรง" | "ซ้าย" | "ขวา";
const ANGLES: Angle[] = ["ตรง", "ซ้าย", "ขวา"];
const ANGLE_HINT: Record<Angle, string> = {
  ตรง: "มองตรงเข้าหากล้อง",
  ซ้าย: "หันหน้าเล็กน้อยไปทางซ้าย",
  ขวา: "หันหน้าเล็กน้อยไปทางขวา",
};

interface FaceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "search" | "enroll";
  onSearchResults?: (photos: any[]) => void;
  onEnrollSuccess?: () => void;
  seasonId?: string | null;
  eventId?: string | null;
  timeslot?: string | null;
}

export function FaceScanModal({
  isOpen,
  onClose,
  mode,
  onSearchResults,
  onEnrollSuccess,
  seasonId,
  eventId,
  timeslot,
}: FaceScanModalProps) {
  const { data: session, update } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  // For enroll mode: 3-angle capture
  const [step, setStep] = useState(0);
  const [captures, setCaptures] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // For search mode: single capture
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    // Reset state on open
    setStep(0);
    setCaptures([]);
    setPreviews([]);
    setCaptureFile(null);
    setCapturePreview(null);
    setErrorMsg(null);
    setCamReady(false);
    setCamError(null);

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamReady(true);
      })
      .catch(() => {
        if (!cancelled) setCamError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  // Capture one frame from camera
  const captureFrame = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || !camReady) return resolve(null);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);

      // Un-mirror so server gets correct orientation
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          const label = mode === "enroll" ? ANGLES[step] : "search";
          const file = new File([blob], `face_${label}.jpg`, { type: "image/jpeg" });
          resolve(file);
        },
        "image/jpeg",
        0.92
      );
    });
  }, [step, camReady, mode]);

  // ── ENROLL MODE CAPTURE ────────────────────────────────────────
  const handleEnrollCapture = async () => {
    const file = await captureFrame();
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setCaptures((prev) => [...prev, file]);
    setPreviews((prev) => [...prev, previewUrl]);
    setStep((s) => s + 1);
  };

  const enrollDone = step >= ANGLES.length;

  const handleEnrollSubmit = async () => {
    if (captures.length === 0) return;
    setProcessing(true);
    setErrorMsg(null);

    const form = new FormData();
    captures.forEach((f, i) => form.append(`image${i + 1}`, f));

    try {
      const res = await fetch("/api/face/enroll", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกใบหน้าล้มเหลว");

      await update({ faceEnrolled: true });
      onEnrollSuccess?.();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setProcessing(false);
    }
  };

  // ── SEARCH MODE CAPTURE + SEARCH ────────────────────────────────
  const handleSearchCapture = async () => {
    const file = await captureFrame();
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCaptureFile(file);
    setCapturePreview(previewUrl);
  };

  const handleSearch = async (enrollToo = false) => {
    setProcessing(true);
    setErrorMsg(null);

    try {
      // Optionally enroll while searching
      if (enrollToo && captureFile) {
        const enrollForm = new FormData();
        enrollForm.append("image1", captureFile);
        const enrollRes = await fetch("/api/face/enroll", { method: "POST", body: enrollForm });
        if (enrollRes.ok) await update({ faceEnrolled: true });
      }

      // Search using stored enrollment (server uses enrolled embedding)
      const res = await fetch("/api/face/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 200,
          seasonId: seasonId || undefined,
          eventId: eventId || undefined,
          timeslot: timeslot || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาดในการค้นหาใบหน้า");

      onSearchResults?.(data.photos ?? []);
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const currentAngle = ANGLES[Math.min(step, ANGLES.length - 1)];

  return (
    <div className="fixed inset-0 bg-[#060813]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass border border-[var(--border)] bg-[#0d0f1e]/95 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-250 select-none shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--accent-blue)] fill-[var(--accent-blue)]/10" />
            <h3 className="font-bold text-white">
              {mode === "search" ? "ค้นหารูปถ่ายด้วยใบหน้า" : "ลงทะเบียนใบหน้า (3 มุม)"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text2)] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-4">
          {/* Enroll mode: angle progress pills */}
          {mode === "enroll" && (
            <div className="flex justify-center gap-3">
              {ANGLES.map((a, i) => (
                <div key={a} className="flex flex-col items-center gap-1">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    i < captures.length
                      ? "bg-[var(--accent-green)] text-white"
                      : i === step
                      ? "bg-[var(--accent-blue)] text-white scale-110"
                      : "bg-slate-800 text-slate-500"
                  }`}>
                    {i < captures.length ? "✓" : i + 1}
                  </div>
                  <span className={`text-[8px] font-bold ${i < captures.length ? "text-[var(--accent-green)]" : i === step ? "text-[var(--accent-blue)]" : "text-slate-600"}`}>{a}</span>
                </div>
              ))}
            </div>
          )}

          {/* Camera Feed */}
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-[var(--border)] bg-black/60 shadow-inner flex items-center justify-center">

            {/* Camera not ready */}
            {!camReady && !camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90">
                <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                <p className="text-xs font-semibold animate-pulse text-slate-300">กำลังเปิดกล้อง...</p>
              </div>
            )}

            {/* Camera error */}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-center p-6">
                <AlertCircle className="h-10 w-10 text-yellow-500" />
                <p className="text-xs text-slate-400 leading-relaxed">{camError}</p>
              </div>
            )}

            {/* Live video (always rendered for srcObject assignment) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: "scaleX(-1)", display: camReady ? "block" : "none" }}
            />

            {/* Search: captured preview */}
            {mode === "search" && capturePreview && (
              <img src={capturePreview} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
            )}

            {/* Oval guide */}
            {camReady && !capturePreview && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[160px] h-[210px] rounded-[50%] border-2 border-dashed border-white/40" />
              </div>
            )}

            {/* Tip banner */}
            {camReady && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-semibold text-amber-300 flex items-center gap-1 select-none whitespace-nowrap">
                <Info className="h-3 w-3" />
                {mode === "enroll"
                  ? ANGLE_HINT[currentAngle]
                  : "แต่งหน้าคล้ายวันงานเพื่อผลลัพธ์ที่แม่นยำ"}
              </div>
            )}

            {/* Processing overlay */}
            {processing && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white">
                <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                <p className="text-xs font-medium text-slate-300">
                  {mode === "enroll" ? "กำลังบันทึกใบหน้า..." : "กำลังค้นหา..."}
                </p>
              </div>
            )}

            {/* Success check */}
            {!processing && (mode === "search" ? capturePreview : enrollDone) && (
              <div className="absolute bottom-4 right-4 bg-[var(--accent-green)] text-white rounded-full p-1 shadow-lg">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            )}
          </div>

          {/* Enroll: thumbnail strip */}
          {mode === "enroll" && previews.length > 0 && (
            <div className="flex gap-2">
              {previews.map((url, i) => (
                <div key={i} className="flex-1 aspect-square rounded-xl overflow-hidden border-2 border-[var(--accent-green)]">
                  <img src={url} alt={ANGLES[i]} className="w-full h-full object-cover" />
                </div>
              ))}
              {ANGLES.slice(previews.length).map((a) => (
                <div key={a} className="flex-1 aspect-square rounded-xl border-2 border-dashed border-[var(--border)] flex items-center justify-center bg-[var(--surface)]">
                  <span className="text-[8px] font-bold text-[var(--text3)]">{a}</span>
                </div>
              ))}
            </div>
          )}

          {/* Errors */}
          {errorMsg && (
            <div className="w-full bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex items-start gap-2 text-[var(--accent-red)] text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-[var(--border)] bg-black/40 flex gap-3">

          {/* ENROLL MODE CONTROLS */}
          {mode === "enroll" && !enrollDone && (
            <button
              onClick={handleEnrollCapture}
              disabled={!camReady || processing}
              className="flex-1 py-3 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              <span>ถ่ายหน้า{currentAngle} ({step + 1}/3)</span>
            </button>
          )}

          {mode === "enroll" && enrollDone && (
            <>
              <button
                onClick={() => { setStep(0); setCaptures([]); setPreviews([]); }}
                disabled={processing}
                className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-white font-bold rounded-2xl text-sm transition-all"
              >
                ถ่ายใหม่
              </button>
              <button
                onClick={handleEnrollSubmit}
                disabled={processing}
                className="flex-[2] py-3 bg-[var(--accent-green)] hover:brightness-110 disabled:opacity-70 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-1.5"
              >
                <UserCheck className="h-4 w-4" />
                <span>บันทึกใบหน้าลงระบบ</span>
              </button>
            </>
          )}

          {/* SEARCH MODE CONTROLS */}
          {mode === "search" && !capturePreview && (
            <button
              onClick={handleSearchCapture}
              disabled={!camReady || processing}
              className="flex-1 py-3 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Camera className="h-4 w-4" />
              <span>ถ่ายรูปสแกนใบหน้า</span>
            </button>
          )}

          {mode === "search" && capturePreview && !processing && (
            <>
              <button
                onClick={() => { setCaptureFile(null); setCapturePreview(null); }}
                className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-white font-bold rounded-2xl text-sm transition-all"
              >
                ถ่ายรูปใหม่
              </button>

              <div className="flex-[2] flex flex-col gap-2">
                <button
                  onClick={() => handleSearch(false)}
                  className="w-full py-3 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <span>ค้นหารูปภาพทันที</span>
                </button>

                {session?.user && !session.user.faceEnrolled && (
                  <button
                    onClick={() => handleSearch(true)}
                    className="w-full py-2 border border-[var(--border)] bg-[var(--surface-hover)] hover:bg-slate-800/40 text-[var(--accent-blue)] font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>ค้นหาพร้อมบันทึกใบหน้าลงโปรไฟล์</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FaceScanModal;
