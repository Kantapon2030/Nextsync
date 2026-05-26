// components/auth/FaceEnrollment.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { loadModels } from "@/lib/face";
import * as faceapi from "face-api.js";
import { Camera, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface FaceEnrollmentProps {
  onEnroll: (embedding: number[]) => void;
  isLoading: boolean;
  errorMsg: string | null;
}

export function FaceEnrollment({ onEnroll, isLoading: submitLoading, errorMsg }: FaceEnrollmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [status, setStatus] = useState<"loading_models" | "ready" | "no_webcam" | "captured">("loading_models");
  const [hasFace, setHasFace] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [generatingEmbedding, setGeneratingEmbedding] = useState(false);
  
  const activeDetectionRef = useRef<boolean>(true);

  // 1. Initialize models & webcam
  useEffect(() => {
    async function setup() {
      try {
        setStatus("loading_models");
        await loadModels();
        setStatus("ready");
        await startWebcam();
      } catch (err) {
        console.error("Error setting up FaceEnrollment:", err);
        setModelLoadError("ไม่สามารถโหลดโมเดลตรวจจับใบหน้าได้ กรุณาตรวจสอบอินเทอร์เน็ต");
      }
    }
    setup();

    return () => {
      stopWebcam();
      activeDetectionRef.current = false;
    };
  }, []);

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
    if (status !== "ready" || !stream) return;

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

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks();

      if (detection && activeDetectionRef.current) {
        setHasFace(true);
        const resizedDetections = faceapi.resizeResults(detection, displaySize);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const box = resizedDetections.detection.box;
          ctx.strokeStyle = "#9B7FF7"; // Purple accent glow
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
  }, [status, stream]);

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
    setGeneratingEmbedding(true);

    try {
      const detection = await faceapi
        .detectSingleFace(tempCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error("ไม่พบใบหน้าในรูปภาพที่ถ่าย กรุณาสแกนใหม่อีกครั้ง");
      }

      const embedding = Array.from(detection.descriptor);
      onEnroll(embedding);
    } catch (err: any) {
      console.error("Embedding generation error:", err);
      setModelLoadError(err.message || "เกิดข้อผิดพลาดในการประมวลผลใบหน้า");
      handleReset();
    } finally {
      setGeneratingEmbedding(false);
    }
  };

  const handleReset = () => {
    setCapturedImage(null);
    setStatus("ready");
    startWebcam();
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-[var(--border)] bg-black/40 shadow-2xl flex items-center justify-center">
        {status === "loading_models" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 bg-[#080A12]/95">
            <RefreshCw className="h-10 w-10 text-[var(--accent-purple)] animate-spin" />
            <p className="text-sm font-medium animate-pulse text-[var(--text2)]">กำลังโหลดปัญญาประดิษฐ์ตรวจจับใบหน้า...</p>
          </div>
        )}

        {status === "no_webcam" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 bg-[#080A12]/95 text-center">
            <AlertCircle className="h-12 w-12 text-[var(--accent-yellow)]" />
            <h4 className="font-semibold text-lg text-[var(--text)]">ไม่พบการเชื่อมต่อกล้อง</h4>
            <p className="text-sm text-[var(--text2)]">กรุณาอนุญาตสิทธิ์การใช้กล้องในเบราว์เซอร์หรือเชื่อมต่อกล้องแล้วรีเฟรชหน้าเว็บ</p>
            <button 
              onClick={startWebcam}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 text-white rounded-xl text-sm font-semibold transition-all"
            >
              ลองเชื่อมต่อใหม่
            </button>
          </div>
        )}

        {/* Live Video Feed */}
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
            
            {/* Guide overlay */}
            <div className="absolute inset-0 border-[20px] border-black/50 pointer-events-none flex items-center justify-center">
              <div className="w-[220px] h-[280px] rounded-[110px] border-2 border-dashed border-white/20" />
            </div>
            
            {/* Status pill */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-4 py-1.5 border border-[var(--border)] rounded-full text-xs font-semibold select-none flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${hasFace ? "bg-[var(--accent-green)] animate-pulse" : "bg-[var(--accent-yellow)]"}`} />
              <span className="text-[var(--text)]">
                {hasFace ? "นิ่งไว้แล้วกดถ่าย" : "กรุณาจัดใบหน้าให้อยู่ในกรอบ"}
              </span>
            </div>
          </>
        )}

        {/* Captured Snapshot preview */}
        {status === "captured" && capturedImage && (
          <div className="relative w-full h-full">
            <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover" />
            {generatingEmbedding && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white">
                <RefreshCw className="h-8 w-8 text-[var(--accent-blue)] animate-spin" />
                <p className="text-xs font-medium text-[var(--text2)]">กำลังประมวลผลโครงสร้างใบหน้า...</p>
              </div>
            )}
            {!generatingEmbedding && !submitLoading && (
              <div className="absolute bottom-4 right-4 bg-[var(--accent-green)] text-black rounded-full p-1.5 shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        )}
      </div>

      {modelLoadError && (
        <div className="w-full bg-red-950/20 border border-red-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-[var(--accent-red)] text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{modelLoadError}</span>
        </div>
      )}

      {errorMsg && (
        <div className="w-full bg-red-950/20 border border-red-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-[var(--accent-red)] text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Button Controls */}
      <div className="flex gap-4 w-full">
        {status === "ready" && (
          <button
            onClick={handleCapture}
            disabled={!hasFace || submitLoading}
            className="flex-1 py-3.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 text-white font-semibold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Camera className="h-5 w-5" />
            <span>ถ่ายรูปสแกนใบหน้า</span>
          </button>
        )}

        {status === "captured" && !generatingEmbedding && (
          <>
            <button
              onClick={handleReset}
              disabled={submitLoading}
              className="flex-1 py-3.5 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text)] font-semibold rounded-2xl transition-all"
            >
              ถ่ายรูปใหม่
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FaceEnrollment;
