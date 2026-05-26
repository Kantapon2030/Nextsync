// components/gallery/FaceScanModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { loadModels, preprocessCanvasForDetection, averageEmbeddings } from "@/lib/face";
import * as faceapi from "face-api.js";
import { Camera, RefreshCw, CheckCircle2, AlertCircle, X, Sparkles, UserCheck, Info } from "lucide-react";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<"loading_models" | "ready" | "no_webcam" | "captured">("loading_models");
  const [hasFace, setHasFace] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-capture state: collect up to 3 embeddings
  const [captureCount, setCaptureCount] = useState(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  const [multiCaptureMode, setMultiCaptureMode] = useState(false);
  
  const activeDetectionRef = useRef<boolean>(true);
  const embeddingRef = useRef<number[] | null>(null);

  // 1. Initialize models & webcam when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function setup() {
      try {
        setStatus("loading_models");
        await loadModels();
        setStatus("ready");
        await startWebcam();
      } catch (err) {
        console.error("Error setting up FaceScanModal:", err);
        setModelLoadError("ไม่สามารถโหลดโมเดลตรวจจับใบหน้าได้ กรุณาตรวจสอบอินเทอร์เน็ต");
      }
    }
    setup();

    return () => {
      stopWebcam();
      activeDetectionRef.current = false;
    };
  }, [isOpen]);

  const startWebcam = async () => {
    try {
      stopWebcam();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error starting camera:", err);
      setStatus("no_webcam");
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // 2. Continuous Face Detection loop
  useEffect(() => {
    if (status !== "ready" || !stream || !isOpen) return;

    activeDetectionRef.current = true;
    let animFrameId: number;

    const detectFaceFrame = async () => {
      if (!activeDetectionRef.current || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.paused || video.ended || video.readyState < 2) {
        animFrameId = requestAnimationFrame(detectFaceFrame);
        return;
      }

      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      
      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
        faceapi.matchDimensions(canvas, displaySize);
      }

      // Preprocess for heavy makeup detection
      const preprocessed = preprocessCanvasForDetection(video);

      const detection = await faceapi
        .detectSingleFace(preprocessed, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
        .withFaceLandmarks();

      if (detection && activeDetectionRef.current) {
        setHasFace(true);
        const resizedDetections = faceapi.resizeResults(detection, displaySize);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const box = resizedDetections.detection.box;
          ctx.strokeStyle = "#2563EB"; 
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          
          const r = 10;
          // Top Left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + r);
          ctx.lineTo(box.x, box.y);
          ctx.lineTo(box.x + r, box.y);
          ctx.stroke();

          // Top Right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - r, box.y);
          ctx.lineTo(box.x + box.width, box.y);
          ctx.lineTo(box.x + box.width, box.y + r);
          ctx.stroke();

          // Bottom Left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + box.height - r);
          ctx.lineTo(box.x, box.y + box.height);
          ctx.lineTo(box.x + r, box.y + box.height);
          ctx.stroke();

          // Bottom Right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - r, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height - r);
          ctx.stroke();
        }
      } else {
        setHasFace(false);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      animFrameId = requestAnimationFrame(detectFaceFrame);
    };

    animFrameId = requestAnimationFrame(detectFaceFrame);

    return () => {
      cancelAnimationFrame(animFrameId);
      activeDetectionRef.current = false;
    };
  }, [status, stream, isOpen]);

  // 3. Capture image & calculate embedding
  const handleCapture = async () => {
    if (!videoRef.current || !hasFace) return;

    const video = videoRef.current;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const dataUrl = tempCanvas.toDataURL("image/jpeg");
    
    setCapturedImage(dataUrl);
    setStatus("captured");
    stopWebcam();
    setProcessing(true);
    setErrorMsg(null);

    try {
      // Try to detect face and extract embedding on the raw canvas (so it matches server-side indexing)
      let detection = await faceapi
        .detectSingleFace(tempCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        // Fallback: Try with preprocessed canvas (e.g. if lighting is poor or makeup is heavy)
        const processedCanvas = preprocessCanvasForDetection(tempCanvas);
        detection = await faceapi
          .detectSingleFace(processedCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.40 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (!detection) {
        throw new Error("ไม่พบใบหน้าในรูปภาพ ลองถ่ายรูปใหม่ในที่ที่แสงสว่างกว่าหรือจัดหน้าให้ตรง");
      }

      const embedding = Array.from(detection.descriptor);

      if (multiCaptureMode) {
        // Multi-capture: collect embeddings
        const newEmbeddings = [...capturedEmbeddings, embedding];
        setCapturedEmbeddings(newEmbeddings);
        setCaptureCount((c) => c + 1);

        if (newEmbeddings.length < 3) {
          // Continue capturing
          embeddingRef.current = embedding;
          // Reset to ready for next shot
          setTimeout(() => {
            setCapturedImage(null);
            setStatus("ready");
            startWebcam();
          }, 800);
        } else {
          // All 3 captured — average
          embeddingRef.current = averageEmbeddings(newEmbeddings);
        }
      } else {
        embeddingRef.current = embedding;
      }
    } catch (err: any) {
      console.error("Embedding generation error:", err);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการประมวลผลใบหน้า");
      handleReset();
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setCapturedImage(null);
    embeddingRef.current = null;
    setCapturedEmbeddings([]);
    setCaptureCount(0);
    setStatus("ready");
    startWebcam();
  };

  // Perform search with embedding
  const executeSearch = async (enrollToo = false) => {
    if (!embeddingRef.current) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      const embedding = embeddingRef.current;

      // 1. If user chose to save/enroll face as well
      if (enrollToo && session?.user) {
        const enrollRes = await fetch("/api/face/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedding }),
        });
        if (enrollRes.ok) {
          await update({ faceEnrolled: true });
        }
      }

      // 2. Fetch search results — send all captured embeddings for server-side averaging
      if (onSearchResults) {
        const embeddingsPayload = capturedEmbeddings.length > 1
          ? { embeddings: capturedEmbeddings } // multi-capture: send all
          : { embedding };                      // single capture

        const res = await fetch("/api/face/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...embeddingsPayload,
            limit: 60,
            seasonId: seasonId || undefined,
            eventId: eventId || undefined,
            timeslot: timeslot || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "เกิดข้อผิดพลาดในการค้นหาใบหน้า");
        }

        onSearchResults(data.photos || []);
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการดำเนินการ");
    } finally {
      setProcessing(false);
    }
  };

  // Perform only enrollment (e.g. from My Photos)
  const executeEnroll = async () => {
    if (!embeddingRef.current) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      const embedding = embeddingRef.current;
      const enrollRes = await fetch("/api/face/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });

      const data = await enrollRes.json();
      if (!enrollRes.ok) {
        throw new Error(data.error || "บันทึกใบหน้าล้มเหลว");
      }

      await update({ faceEnrolled: true });
      if (onEnrollSuccess) {
        onEnrollSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกใบหน้า");
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#060813]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass border border-[var(--border)] bg-[#0d0f1e]/95 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-250 select-none shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--accent-blue)] fill-[var(--accent-blue)]/10" />
            <h3 className="font-bold text-white">
              {mode === "search" ? "ค้นหารูปถ่ายด้วยใบหน้า" : "ลงทะเบียนใบหน้า"}
            </h3>
          </div>
          <button
            onClick={() => {
              stopWebcam();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text2)] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera Feed / Captured View */}
        <div className="p-6 flex-1 flex flex-col gap-4">
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-[var(--border)] bg-black/60 shadow-inner flex items-center justify-center">
            {status === "loading_models" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 bg-slate-950/90">
                <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                <p className="text-xs font-semibold animate-pulse text-slate-300">
                  กำลังดาวน์โหลดโมเดลปัญญาประดิษฐ์...
                </p>
              </div>
            )}

            {status === "no_webcam" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 bg-slate-950 text-center">
                <AlertCircle className="h-10 w-10 text-yellow-500" />
                <h4 className="font-bold text-sm">ไม่พบกล้องสำหรับใช้งาน</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  กรุณาอนุญาตสิทธิ์เข้าถึงกล้องถ่ายภาพบนเบราว์เซอร์ของคุณ หรือเชื่อมต่ออุปกรณ์กล้องแล้วลองอีกครั้ง
                </p>
                <button
                  onClick={startWebcam}
                  className="mt-2 px-4 py-2 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  ลองเชื่อมต่อใหม่
                </button>
              </div>
            )}

            {/* Video Feed */}
            {status === "ready" && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
                
                {/* Oval face guide overlay */}
                <div className="absolute inset-0 border-[20px] border-slate-950/40 pointer-events-none flex items-center justify-center">
                  <div className="w-[160px] h-[220px] rounded-[50%] border-2 border-dashed border-white/60" />
                </div>

                {/* Makeup tip */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-semibold text-amber-300 flex items-center gap-1 select-none">
                  <Info className="h-3 w-3" />
                  <span>แต่งหน้าคล้ายวันงานเพื่อผลลัพธ์ที่แม่นยำ</span>
                </div>

                {/* Multi-capture mode toggle */}
                {mode === "search" && (
                  <div className="absolute top-3 right-3 select-none">
                    <button
                      onClick={() => { setMultiCaptureMode(!multiCaptureMode); setCapturedEmbeddings([]); setCaptureCount(0); }}
                      className={`text-[9px] font-bold px-2 py-1 rounded-full border transition-all ${
                        multiCaptureMode
                          ? "bg-[var(--accent-blue)]/20 border-[var(--accent-blue)]/40 text-[var(--accent-blue)]"
                          : "bg-black/40 border-white/10 text-white/60"
                      }`}
                    >
                      {multiCaptureMode ? `📸 โหมด 3 ช็อต (${captureCount}/3)` : "📸 1 ช็อต"}
                    </button>
                  </div>
                )}
                
                {/* Status pill */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 select-none">
                  <span className={`h-2 w-2 rounded-full ${hasFace ? "bg-[var(--accent-green)] animate-ping" : "bg-yellow-500"}`} />
                  <span className="text-white">
                    {hasFace ? "ตรวจพบใบหน้า: นิ่งไว้แล้วกดถ่าย" : "กรุณาจัดใบหน้าให้อยู่ในกรอบ"}
                  </span>
                </div>
              </>
            )}

            {/* Snapshotted image */}
            {status === "captured" && capturedImage && (
              <div className="relative w-full h-full">
                <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover" />
                {processing && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white">
                    <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                    <p className="text-xs font-medium text-slate-300">กำลังคำนวณโครงสร้างใบหน้า...</p>
                  </div>
                )}
                {!processing && (
                  <div className="absolute bottom-4 right-4 bg-[var(--accent-green)] text-white rounded-full p-1 shadow-lg">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                )}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="w-full bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex items-start gap-2 text-[var(--accent-red)] text-xs font-semibold">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {modelLoadError && (
            <div className="w-full bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex items-start gap-2 text-[var(--accent-red)] text-xs font-semibold">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{modelLoadError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-5 border-t border-[var(--border)] bg-black/40 flex gap-3">
          {status === "ready" && (
            <button
              onClick={handleCapture}
              disabled={!hasFace || processing}
              className="flex-1 py-3 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Camera className="h-4.5 w-4.5" />
              <span>ถ่ายรูปสแกนใบหน้า</span>
            </button>
          )}

          {status === "captured" && !processing && (
            <>
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-white font-bold rounded-2xl shadow-sm text-sm transition-all"
              >
                ถ่ายรูปใหม่
              </button>
              
              {mode === "search" ? (
                <div className="flex-[2] flex flex-col gap-2">
                  <button
                    onClick={() => executeSearch(false)}
                    className="w-full py-3 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 text-white font-bold rounded-2xl shadow-md text-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <span>ค้นหารูปภาพทันที</span>
                  </button>
                  
                  {session?.user && !session.user.faceEnrolled && (
                    <button
                      onClick={() => executeSearch(true)}
                      className="w-full py-2 border border-[var(--border)] bg-[var(--surface-hover)] hover:bg-slate-800/40 text-[var(--accent-blue)] font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>ค้นหาพร้อมบันทึกใบหน้าลงโปรไฟล์</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={executeEnroll}
                  className="flex-[2] py-3 bg-[var(--accent-green)] hover:brightness-110 text-white font-bold rounded-2xl shadow-md text-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <UserCheck className="h-4.5 w-4.5" />
                  <span>บันทึกใบหน้าลงระบบ</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default FaceScanModal;
