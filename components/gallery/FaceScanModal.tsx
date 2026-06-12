// components/gallery/FaceScanModal.tsx
// Face scan modal for gallery — upgraded with SOTA client-side auto-capture:
//   "search": captures 1 face image automatically when centered
//   "enroll": captures 3 face angles (มองตรง, หันซ้าย, หันขวา) automatically with screen flash & rainbow guides
// Features:
//   ✅ Canvas AR overlay with bounding box + 68 landmark points
//   ✅ Tab switch: Camera / Upload Photo
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import {
  Camera, RefreshCw, CheckCircle2, AlertCircle, X, Sparkles,
  UserCheck, Upload, ImagePlus, Trash2,
} from "lucide-react";
import { loadModels } from "@/lib/face";
import * as faceapi from "face-api.js";

type Angle = "ตรง" | "ซ้าย" | "ขวา";
const ANGLES: Angle[] = ["ตรง", "ซ้าย", "ขวา"];
const ANGLE_HINT: Record<Angle, string> = {
  ตรง: "มองตรงเข้าหากล้อง 😐",
  ซ้าย: "หันหน้าเล็กน้อยไปทางซ้าย 👉",
  ขวา: "หันหน้าเล็กน้อยไปทางขวา 👈",
};
const REQUIRED_STABLE_FRAMES = 8;

// Landmark drawing color groups (68 points)
const LANDMARK_COLORS: Record<string, string> = {
  jaw: "#06b6d4",      // cyan
  leftBrow: "#a855f7",  // purple
  rightBrow: "#a855f7", // purple
  nose: "#f59e0b",      // yellow
  leftEye: "#22c55e",   // green
  rightEye: "#22c55e",  // green
  mouth: "#ec4899",     // pink
};

// Index ranges for each landmark group (0-based, face-api.js 68-point model)
const LANDMARK_GROUPS: { name: string; start: number; end: number }[] = [
  { name: "jaw", start: 0, end: 16 },
  { name: "leftBrow", start: 17, end: 21 },
  { name: "rightBrow", start: 22, end: 26 },
  { name: "nose", start: 27, end: 35 },
  { name: "leftEye", start: 36, end: 41 },
  { name: "rightEye", start: 42, end: 47 },
  { name: "mouth", start: 48, end: 67 },
];

type TabMode = "camera" | "upload";

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
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const currentStepRef = useRef(0);

  const [camReady, setCamReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  const [camError, setCamError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabMode>("camera");

  // Auto-capture states
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceCentered, setFaceCentered] = useState(false);
  const [faceAngle, setFaceAngle] = useState<"ตรง" | "ซ้าย" | "ขวา" | "unknown">("unknown");
  const [flashActive, setFlashActive] = useState(false);

  // For enroll mode: 3-angle capture
  const [step, setStep] = useState(0);
  const [captures, setCaptures] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [stableCount, setStableCount] = useState(0);

  // For search mode: single capture
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload tab states
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFaceDetected, setUploadFaceDetected] = useState(false);
  const [uploadDetecting, setUploadDetecting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const uploadImgRef = useRef<HTMLImageElement>(null);
  const uploadCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync step ref for animation frame closure
  useEffect(() => {
    currentStepRef.current = step;
  }, [step]);

  // Load faceapi models client-side
  useEffect(() => {
    if (!isOpen) return;
    loadModels()
      .then(() => setModelsLoaded(true))
      .catch((err) => {
        console.error("Failed to load face-api models client-side:", err);
        setCamError("ไม่สามารถดาวน์โหลดไฟล์วิเคราะห์ใบหน้าได้ กรุณารีเฟรชหน้าเว็บ");
      });
  }, [isOpen]);

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
    setFaceDetected(false);
    setFaceCentered(false);
    setFaceAngle("unknown");
    setFlashActive(false);
    setStableCount(0);
    setActiveTab("camera");
    setUploadPreview(null);
    setUploadFile(null);
    setUploadFaceDetected(false);
    setUploadDetecting(false);

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false })
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
      .catch((e) => {
        console.error("Camera access error:", e);
        if (!cancelled) setCamError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์การใช้กล้องในเบราว์เซอร์");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  // Pause/resume camera when switching tabs
  useEffect(() => {
    if (!streamRef.current) return;
    const tracks = streamRef.current.getVideoTracks();
    if (activeTab === "upload") {
      tracks.forEach((t) => (t.enabled = false));
      // Clear the AR canvas when switching away
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      tracks.forEach((t) => (t.enabled = true));
    }
  }, [activeTab]);

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
    }
    onClose();
  };

  // ── Canvas AR drawing helpers ─────────────────────────────────────

  /**
   * Draws a rounded rectangle on a 2D canvas context.
   */
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
    strokeStyle: string, lineWidth: number, dashed = false
  ) => {
    ctx.beginPath();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    if (dashed) {
      ctx.setLineDash([6, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  };

  /**
   * Draws 68 landmark points on the canvas, color-coded by group.
   */
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: faceapi.FaceLandmarks68,
    scaleX: number,
    scaleY: number,
    mirror: boolean,
    canvasW: number,
  ) => {
    const positions = landmarks.positions;
    for (const group of LANDMARK_GROUPS) {
      ctx.fillStyle = LANDMARK_COLORS[group.name] || "#ffffff";
      for (let i = group.start; i <= group.end; i++) {
        const pt = positions[i];
        const px = mirror ? canvasW - pt.x * scaleX : pt.x * scaleX;
        const py = pt.y * scaleY;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  /**
   * Draws the full AR overlay: bounding box, landmarks, confidence label.
   */
  const drawAROverlay = useCallback(
    (
      detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>,
      isCentered: boolean,
      isCorrectAngle: boolean,
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const displayW = canvas.width;
      const displayH = canvas.height;
      const videoW = video.videoWidth || 640;
      const videoH = video.videoHeight || 480;

      const scaleX = displayW / videoW;
      const scaleY = displayH / videoH;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, displayW, displayH);

      const box = detection.detection.box;
      // Mirror the X coordinate because video is mirrored via scaleX(-1)
      const bx = displayW - (box.x + box.width) * scaleX;
      const by = box.y * scaleY;
      const bw = box.width * scaleX;
      const bh = box.height * scaleY;

      // Choose bounding box color & style based on state
      let boxColor = "rgba(255, 255, 255, 0.6)";
      let dashed = true;
      if (isCentered && isCorrectAngle) {
        boxColor = "#22c55e"; // green
        dashed = false;
      } else if (isCentered) {
        boxColor = "#f59e0b"; // yellow
        dashed = false;
      } else if (detection.detection.score > 0.5) {
        boxColor = "rgba(255, 255, 255, 0.5)";
        dashed = true;
      }

      // Draw glow behind box
      ctx.shadowColor = boxColor;
      ctx.shadowBlur = 12;
      drawRoundedRect(ctx, bx, by, bw, bh, 8, boxColor, 2.5, dashed);
      ctx.shadowBlur = 0;

      // Draw landmarks
      drawLandmarks(ctx, detection.landmarks, scaleX, scaleY, true, displayW);

      // Confidence label
      const confidence = Math.round(detection.detection.score * 100);
      ctx.font = "bold 11px 'Outfit', sans-serif";
      const labelText = `${confidence}%`;
      const labelW = ctx.measureText(labelText).width + 12;
      const labelX = bx + bw / 2 - labelW / 2;
      const labelY = by - 8;

      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.beginPath();
      ctx.roundRect(labelX, labelY - 16, labelW, 20, 6);
      ctx.fill();

      ctx.fillStyle = boxColor;
      ctx.textAlign = "center";
      ctx.fillText(labelText, bx + bw / 2, labelY - 1);
      ctx.textAlign = "start";
    },
    []
  );

  const clearARCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

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
          const currentStep = currentStepRef.current;
          const label = mode === "enroll" ? ANGLES[currentStep] : "search";
          const file = new File([blob], `face_${label}.jpg`, { type: "image/jpeg" });
          resolve(file);
        },
        "image/jpeg",
        0.92
      );
    });
  }, [camReady, mode]);

  const handleEnrollSubmitWithFiles = async (filesToSubmit: File[]) => {
    setProcessing(true);
    setErrorMsg(null);

    const form = new FormData();
    filesToSubmit.forEach((f, i) => form.append(`image${i + 1}`, f));

    try {
      const res = await fetch("/api/face/enroll", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกใบหน้าล้มเหลว");

      await update({ faceEnrolled: true });
      onEnrollSuccess?.();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message ?? "เกิดข้อผิดพลาดในการส่งข้อมูล");
    } finally {
      setProcessing(false);
    }
  };

  // Trigger screen flash and store captured image
  const triggerAutoCapture = useCallback(async () => {
    // 1. Play Shutter flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 120);

    const file = await captureFrame();
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    if (mode === "enroll") {
      setCaptures((prev) => {
        const next = [...prev, file];
        if (next.length === 3) {
          // Auto submit when all 3 angles captured
          setTimeout(() => {
            handleEnrollSubmitWithFiles(next);
          }, 800);
        }
        return next;
      });
      setPreviews((prev) => [...prev, previewUrl]);
      setStep((s) => s + 1);
      setStableCount(0);
    } else {
      // Search mode: auto capture first centered face and trigger search
      setCaptureFile(file);
      setCapturePreview(previewUrl);
      setStableCount(0);
    }
  }, [captureFrame, mode]);

  // Real-time Face Tracking Loop using client-side face-api.js (throttled to 150ms to prevent lag)
  useEffect(() => {
    if (!isOpen || !camReady || !modelsLoaded || !videoRef.current || activeTab !== "camera") return;

    let active = true;
    let stableFrames = 0;
    let lastDetectionTime = 0;
    const DETECTION_INTERVAL = 150; // run detection every 150ms

    const runLoop = async () => {
      if (!active || !videoRef.current) return;

      // Pause detection when browser tab is hidden to save CPU
      if (document.visibilityState === "hidden") {
        if (active) loopRef.current = requestAnimationFrame(runLoop);
        return;
      }

      try {
        const video = videoRef.current;
        if (video.paused || video.ended || video.readyState < 2) {
          loopRef.current = requestAnimationFrame(runLoop);
          return;
        }

        const now = Date.now();
        if (now - lastDetectionTime >= DETECTION_INTERVAL) {
          lastDetectionTime = now;

          const detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks();

          if (detection) {
            setFaceDetected(true);
            const box = detection.detection.box;
            const videoWidth = video.videoWidth || 640;
            const videoHeight = video.videoHeight || 480;

            // Check if face is centered in the guide
            const faceCenterX = box.x + box.width / 2;
            const faceCenterY = box.y + box.height / 2;

            const errorX = Math.abs(faceCenterX - videoWidth / 2) / videoWidth;
            const errorY = Math.abs(faceCenterY - videoHeight / 2) / videoHeight;

            // Centered parameters: face width must occupy 25%-50% of the screen
            const isCentered = errorX < 0.16 && errorY < 0.18 && (box.width / videoWidth) > 0.25 && (box.width / videoWidth) < 0.50;
            setFaceCentered(isCentered);

            // Head yaw calculation
            const landmarks = detection.landmarks;
            const nose = landmarks.getNose()[3]; // nose tip
            const leftJaw = landmarks.getJawOutline()[0];
            const rightJaw = landmarks.getJawOutline()[16];

            const distLeft = nose.x - leftJaw.x;
            const distRight = rightJaw.x - nose.x;
            const ratio = distLeft / distRight;

            let angle: "ตรง" | "ซ้าย" | "ขวา" | "unknown" = "unknown";
            if (ratio >= 0.76 && ratio <= 1.30) {
              angle = "ตรง";
            } else if (ratio < 0.65) {
              angle = "ขวา"; // head turned right
            } else if (ratio > 1.55) {
              angle = "ซ้าย"; // head turned left
            }
            setFaceAngle(angle);

            // Draw AR overlay on canvas
            const currentAngle = ANGLES[Math.min(currentStepRef.current, ANGLES.length - 1)];
            const isCorrectAngle = mode === "enroll" ? angle === currentAngle : true;
            drawAROverlay(detection, isCentered, isCorrectAngle);

            // Auto-trigger logic
            if (isCentered) {
              if (mode === "enroll") {
                const currentStep = currentStepRef.current;
                const targetAngle = ANGLES[currentStep];
                if (angle === targetAngle) {
                  stableFrames++;
                  setStableCount(stableFrames);
                  if (stableFrames >= REQUIRED_STABLE_FRAMES) {
                    stableFrames = 0;
                    setStableCount(0);
                    triggerAutoCapture();
                  }
                } else {
                  stableFrames = 0;
                  setStableCount(0);
                }
              } else {
                // Search mode: auto capture once centered
                stableFrames++;
                setStableCount(stableFrames);
                if (stableFrames >= REQUIRED_STABLE_FRAMES && !currentStepRef.current) {
                  stableFrames = 0;
                  setStableCount(0);
                  triggerAutoCapture();
                }
              }
            } else {
              stableFrames = 0;
              setStableCount(0);
            }

          } else {
            setFaceDetected(false);
            setFaceCentered(false);
            setFaceAngle("unknown");
            stableFrames = 0;
            setStableCount(0);
            clearARCanvas();
          }
        }

      } catch (err) {
        console.error("Face detection loop error:", err);
      }

      if (active) {
        loopRef.current = requestAnimationFrame(runLoop);
      }
    };

    loopRef.current = requestAnimationFrame(runLoop);

    return () => {
      active = false;
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
    };
  }, [isOpen, camReady, modelsLoaded, mode, triggerAutoCapture, activeTab, drawAROverlay, clearARCanvas]);

  // Sync canvas size with video display size
  useEffect(() => {
    if (!camReady || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;

    const syncSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    };

    syncSize();
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(video);
    return () => resizeObserver.disconnect();
  }, [camReady]);

  const handleEnrollSubmit = () => {
    handleEnrollSubmitWithFiles(captures);
  };

  const handleSearch = async (enrollToo = false) => {
    const fileToUse = activeTab === "upload" ? uploadFile : captureFile;
    setProcessing(true);
    setErrorMsg(null);

    try {
      if (enrollToo && fileToUse) {
        const enrollForm = new FormData();
        enrollForm.append("image1", fileToUse);
        const enrollRes = await fetch("/api/face/enroll", { method: "POST", body: enrollForm });
        if (enrollRes.ok) await update({ faceEnrolled: true });
      }

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

  // ── Upload tab handlers ─────────────────────────────────────────

  const processUploadedImage = useCallback(async (file: File) => {
    setUploadDetecting(true);
    setUploadFaceDetected(false);
    setErrorMsg(null);

    const previewUrl = URL.createObjectURL(file);
    setUploadPreview(previewUrl);
    setUploadFile(file);

    // Wait for models
    try {
      await loadModels();
    } catch {
      setErrorMsg("ไม่สามารถโหลดโมเดลตรวจจับใบหน้าได้");
      setUploadDetecting(false);
      return;
    }

    // Create an image element and detect face
    const img = new window.Image();
    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
          .withFaceLandmarks();

        if (detection) {
          setUploadFaceDetected(true);

          // Draw AR overlay on upload canvas
          const canvas = uploadCanvasRef.current;
          if (canvas) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              const box = detection.detection.box;
              // No mirroring needed for uploaded images
              drawRoundedRect(
                ctx, box.x, box.y, box.width, box.height,
                8, "#22c55e", 3, false
              );

              // Draw landmarks (no mirror)
              const positions = detection.landmarks.positions;
              for (const group of LANDMARK_GROUPS) {
                ctx.fillStyle = LANDMARK_COLORS[group.name] || "#ffffff";
                for (let i = group.start; i <= group.end; i++) {
                  const pt = positions[i];
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
                  ctx.fill();
                }
              }

              // Confidence label
              const confidence = Math.round(detection.detection.score * 100);
              ctx.font = "bold 16px 'Outfit', sans-serif";
              const labelText = `ตรวจพบใบหน้า ${confidence}%`;
              const labelW = ctx.measureText(labelText).width + 16;
              const labelX = box.x + box.width / 2 - labelW / 2;
              const labelY = box.y - 10;

              ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
              ctx.beginPath();
              ctx.roundRect(labelX, labelY - 22, labelW, 28, 8);
              ctx.fill();

              ctx.fillStyle = "#22c55e";
              ctx.textAlign = "center";
              ctx.fillText(labelText, box.x + box.width / 2, labelY);
              ctx.textAlign = "start";
            }
          }

          // For search mode, set the file as capture file
          if (mode === "search") {
            setCaptureFile(file);
          }
          // For enroll mode, also set as first capture
          if (mode === "enroll") {
            setCaptures([file]);
            setPreviews([previewUrl]);
          }
        } else {
          setUploadFaceDetected(false);
          setErrorMsg("ไม่พบใบหน้าในรูปภาพ กรุณาเลือกรูปที่เห็นใบหน้าชัดเจน");
        }
      } catch (err: any) {
        console.error("Upload face detection error:", err);
        setErrorMsg("เกิดข้อผิดพลาดในการตรวจจับใบหน้า");
      } finally {
        setUploadDetecting(false);
      }
    };
    img.onerror = () => {
      setErrorMsg("ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองไฟล์อื่น");
      setUploadDetecting(false);
    };
    img.src = previewUrl;
  }, [mode, drawAROverlay]);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
        processUploadedImage(file);
      } else {
        setErrorMsg("รองรับเฉพาะไฟล์ JPG หรือ PNG เท่านั้น");
      }
    },
    [processUploadedImage]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processUploadedImage(file);
      }
    },
    [processUploadedImage]
  );

  const clearUpload = useCallback(() => {
    setUploadPreview(null);
    setUploadFile(null);
    setUploadFaceDetected(false);
    setUploadDetecting(false);
    setErrorMsg(null);
    setCaptureFile(null);
    setCaptures([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleUploadSubmit = () => {
    if (mode === "enroll") {
      if (captures.length > 0) {
        handleEnrollSubmitWithFiles(captures);
      }
    } else {
      handleSearch(false);
    }
  };

  if (!isOpen) return null;
  if (!mounted) return null;

  const currentAngle = ANGLES[Math.min(step, ANGLES.length - 1)];
  const enrollDone = step >= ANGLES.length;
  const isOnUploadTab = activeTab === "upload";
  const hasUploadResult = isOnUploadTab && uploadPreview && !uploadDetecting;
  const canSubmitUpload = isOnUploadTab && uploadFaceDetected && !processing;

  const getBottomGuideState = () => {
    if (!modelsLoaded) {
      return {
        emoji: "⚙️",
        animateClass: "animate-spin",
        label: "กำลังโหลดโมเดล",
        text: "กำลังโหลดไฟล์วิเคราะห์ใบหน้า...",
        color: "#06b6d4"
      };
    }
    if (!camReady) {
      return {
        emoji: "🎥",
        animateClass: "animate-pulse",
        label: "กำลังเปิดกล้อง",
        text: "กำลังเรียกใช้งานกล้อง...",
        color: "#06b6d4"
      };
    }
    if (!faceDetected) {
      return {
        emoji: "😐",
        animateClass: "animate-pulse",
        label: "ไม่พบใบหน้า",
        text: "กรุณาจัดวางใบหน้าให้อยู่ในหน้าจอ 😐",
        color: "#f59e0b"
      };
    }
    if (!faceCentered) {
      return {
        emoji: "📐",
        animateClass: "animate-bounce",
        label: "ตำแหน่งไม่ตรงกรอบ",
        text: "ขยับใบหน้าเข้ามาประชิดกรอบด้านใน 📐",
        color: "#f59e0b"
      };
    }

    if (mode === "enroll") {
      if (faceAngle !== currentAngle) {
        const handEmoji = currentAngle === "ตรง" ? "😐" : currentAngle === "ซ้าย" ? "👉" : "👈";
        const anim = currentAngle === "ตรง" ? "animate-heartbeat" : currentAngle === "ซ้าย" ? "animate-slide-right" : "animate-slide-left";
        return {
          emoji: handEmoji,
          animateClass: anim,
          label: "องศาไม่ถูกต้อง",
          text: ANGLE_HINT[currentAngle],
          color: "#06b6d4"
        };
      }
      return {
        emoji: currentAngle === "ตรง" ? "😐" : currentAngle === "ซ้าย" ? "👉" : "👈",
        animateClass: currentAngle === "ตรง" ? "animate-heartbeat" : currentAngle === "ซ้าย" ? "animate-slide-right" : "animate-slide-left",
        label: "ตำแหน่งถูกต้อง",
        text: "เยี่ยม! ตรึงใบหน้านิ่งไว้สักครู่... 📸",
        color: "#22c55e"
      };
    } else {
      return {
        emoji: "😐",
        animateClass: "animate-heartbeat",
        label: "ตำแหน่งถูกต้อง",
        text: "ตำแหน่งถูกต้อง! ค้างไว้เพื่อสแกน... 📸",
        color: "#22c55e"
      };
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-[#060813]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">

      <div className="glass border border-[var(--border)] bg-[#0d0f1e]/95 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-250 select-none shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--accent-blue)] fill-[var(--accent-blue)]/10" />
            <h3 className="font-bold text-white">
              {mode === "search" ? "ค้นหารูปถ่ายด้วยใบหน้า" : "ลงทะเบียนใบหน้าอัจฉริยะ (3 มุม)"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text2)] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab("camera")}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "camera"
                ? "text-[var(--accent-blue)] border-b-2 border-[var(--accent-blue)] bg-[var(--accent-blue)]/5"
                : "text-[var(--text3)] hover:text-[var(--text2)] hover:bg-white/[0.02]"
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>กล้อง</span>
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "upload"
                ? "text-[var(--accent-purple)] border-b-2 border-[var(--accent-purple)] bg-[var(--accent-purple)]/5"
                : "text-[var(--text3)] hover:text-[var(--text2)] hover:bg-white/[0.02]"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>อัปโหลดรูป</span>
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-4">
          
          {/* Angle indicators (camera tab, enroll mode only) */}
          {mode === "enroll" && activeTab === "camera" && (
            <div className="flex justify-center gap-4">
              {ANGLES.map((a, i) => (
                <div key={a} className="flex flex-col items-center gap-1.5">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i < captures.length
                      ? "bg-[var(--accent-green)] text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                      : i === step
                      ? "bg-[var(--accent-blue)] text-white scale-110 ring-4 ring-[var(--accent-blue)]/30"
                      : "bg-slate-800 text-slate-500"
                  }`}>
                    {i < captures.length ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] font-bold ${
                    i < captures.length
                      ? "text-[var(--accent-green)]"
                      : i === step
                      ? "text-[var(--accent-blue)]"
                      : "text-slate-500"
                  }`}>
                    {a === "ตรง" ? "มองตรง 😐" : a === "ซ้าย" ? "หันซ้าย 👉" : "หันขวา 👈"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ═══ CAMERA TAB ═══ */}
          {activeTab === "camera" && (
            <>
              {/* Camera Frame */}
              <div className={`relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-black/60 shadow-inner flex items-center justify-center transition-all duration-300 ${
                mode === "enroll" && faceCentered && faceAngle === currentAngle
                  ? "ring-4 ring-green-500 shadow-[0_0_25px_rgba(34,197,94,0.6)] border-transparent aligned-state"
                  : faceDetected && !capturePreview
                  ? "rainbow-border border-transparent"
                  : "border border-[var(--border)]"
              }`}>
                
                {/* Corner Brackets */}
                {camReady && !capturePreview && (
                  <>
                    <div className="corner-bracket corner-top-left" />
                    <div className="corner-bracket corner-top-right" />
                    <div className="corner-bracket corner-bottom-left" />
                    <div className="corner-bracket corner-bottom-right" />
                  </>
                )}

                {/* Camera screen flash overlay */}
                {flashActive && (
                  <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-75 opacity-100" />
                )}

                {/* Camera not ready */}
                {(!camReady || !modelsLoaded) && !camError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 z-10">
                    <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                    <p className="text-xs font-semibold animate-pulse text-slate-300">
                      {!modelsLoaded ? "กำลังดาวน์โหลดไฟล์วิเคราะห์ใบหน้า..." : "กำลังเริ่มต้นกล้อง..."}
                    </p>
                  </div>
                )}

                {/* Camera error */}
                {camError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-center p-6 z-10">
                    <AlertCircle className="h-10 w-10 text-yellow-500" />
                    <p className="text-xs text-slate-400 leading-relaxed">{camError}</p>
                  </div>
                )}

                {/* Live Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)", display: camReady ? "block" : "none" }}
                />

                {/* Canvas AR Overlay (replaces CSS oval) */}
                {camReady && !capturePreview && (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    style={{ transform: "scaleX(1)" }}
                  />
                )}

                {/* Laser Scan Line */}
                {camReady && !capturePreview && (
                  <div className="scan-line" />
                )}

                {/* Search: captured preview */}
                {mode === "search" && capturePreview && (
                  <img src={capturePreview} alt="Captured" className="absolute inset-0 w-full h-full object-cover z-20" />
                )}

                {/* Interactive Emoji Guidance Card */}
                {camReady && !capturePreview && (() => {
                  const guide = getBottomGuideState();
                  return (
                    <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2 z-20 pointer-events-none px-4">
                      <div className="bg-[#0b0c16]/95 border border-white/10 backdrop-blur-md rounded-2xl px-5 py-3 flex items-center gap-4 shadow-[0_12px_36px_rgba(0,0,0,0.6)] transition-all duration-300">
                        <div className="relative flex items-center justify-center w-14 h-14 bg-white/5 rounded-full overflow-hidden border border-white/10 shrink-0">
                          
                          {/* Animated Emoji */}
                          <span className={`text-3xl ${guide.animateClass}`}>{guide.emoji}</span>

                          {/* Progress Circle SVG */}
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                              cx="28"
                              cy="28"
                              r="25"
                              fill="none"
                              stroke="rgba(255, 255, 255, 0.08)"
                              strokeWidth="3"
                            />
                            <circle
                              cx="28"
                              cy="28"
                              r="25"
                              fill="none"
                              stroke={guide.color}
                              strokeWidth="3"
                              strokeDasharray={2 * Math.PI * 25}
                              strokeDashoffset={2 * Math.PI * 25 * (1 - stableCount / REQUIRED_STABLE_FRAMES)}
                              className="transition-all duration-150"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>

                        <div className="flex flex-col text-left">
                          <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                            {guide.label}
                          </span>
                          <span className="text-white text-xs font-bold font-sans mt-0.5 leading-snug">
                            {guide.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Processing Overlay */}
                {processing && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white z-30">
                    <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                    <p className="text-xs font-medium text-slate-300">
                      {mode === "enroll" ? "กำลังประมวลผลและเข้ารหัสใบหน้า..." : "กำลังค้นหาใบหน้าในอัลบั้ม..."}
                    </p>
                  </div>
                )}

                {/* Success check */}
                {!processing && (mode === "search" ? capturePreview : enrollDone) && (
                  <div className="absolute bottom-4 right-4 bg-[var(--accent-green)] text-white rounded-full p-1.5 shadow-lg z-20">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                )}
              </div>

              {/* Enroll: thumbnail strip */}
              {mode === "enroll" && previews.length > 0 && (
                <div className="flex gap-3">
                  {previews.map((url, i) => (
                    <div key={i} className="flex-1 aspect-square rounded-2xl overflow-hidden border-2 border-[var(--accent-green)] shadow-md transition-all duration-300 hover:scale-105">
                      <img src={url} alt={ANGLES[i]} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {ANGLES.slice(previews.length).map((a) => (
                    <div key={a} className="flex-1 aspect-square rounded-2xl border-2 border-dashed border-[var(--border)] flex items-center justify-center bg-[var(--surface)] text-[var(--text3)]">
                      <span className="text-[10px] font-bold text-center leading-tight">
                        {a === "ตรง" ? "มองตรง" : a === "ซ้าย" ? "หันซ้าย" : "หันขวา"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ═══ UPLOAD TAB ═══ */}
          {activeTab === "upload" && (
            <>
              {!uploadPreview ? (
                /* Drop zone */
                <div
                  className={`relative aspect-[4/3] w-full rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 border-2 border-dashed ${
                    dragOver
                      ? "drag-active border-[var(--accent-blue)]"
                      : "border-[var(--border)] hover:border-[var(--accent-purple)]/50 bg-[var(--surface)]/50 hover:bg-[var(--surface)]"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <div className="p-4 bg-[var(--accent-purple)]/10 rounded-full border border-[var(--accent-purple)]/20">
                    <ImagePlus className="h-10 w-10 text-[var(--accent-purple)]" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-sm font-bold text-[var(--text)]">
                      ลากรูปวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                    </p>
                    <p className="text-[11px] text-[var(--text3)]">
                      รองรับ JPG, PNG — ควรเป็นรูปที่เห็นใบหน้าชัดเจน
                    </p>
                  </div>

                  {dragOver && (
                    <div className="absolute inset-0 bg-[var(--accent-blue)]/5 flex items-center justify-center rounded-2xl pointer-events-none">
                      <p className="text-sm font-bold text-[var(--accent-blue)] animate-pulse">ปล่อยเพื่ออัปโหลด</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Preview with AR overlay */
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-black/60 border border-[var(--border)]">
                  <img
                    ref={uploadImgRef}
                    src={uploadPreview}
                    alt="Upload preview"
                    className="absolute inset-0 w-full h-full object-contain"
                  />

                  {/* Canvas overlay for face detection visualization */}
                  <canvas
                    ref={uploadCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none object-contain"
                  />

                  {/* Detecting spinner */}
                  {uploadDetecting && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                      <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                      <p className="text-xs font-semibold text-slate-300 animate-pulse">กำลังวิเคราะห์ใบหน้าจากรูปที่อัปโหลด...</p>
                    </div>
                  )}

                  {/* Detection result badge */}
                  {!uploadDetecting && (
                    <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 z-10 ${
                      uploadFaceDetected
                        ? "bg-green-950/70 text-[var(--accent-green)] border border-green-900/30"
                        : "bg-red-950/70 text-[var(--accent-red)] border border-red-900/30"
                    }`}>
                      {uploadFaceDetected ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> ตรวจพบใบหน้า</>
                      ) : (
                        <><AlertCircle className="h-3.5 w-3.5" /> ไม่พบใบหน้า</>
                      )}
                    </div>
                  )}

                  {/* Clear button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); clearUpload(); }}
                    className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white/80 hover:text-white rounded-xl backdrop-blur-sm transition-all z-10 border border-white/10"
                    title="ลบรูปนี้"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Processing overlay */}
                  {processing && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white z-20">
                      <RefreshCw className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
                      <p className="text-xs font-medium text-slate-300">
                        {mode === "enroll" ? "กำลังประมวลผลและเข้ารหัสใบหน้า..." : "กำลังค้นหาใบหน้าในอัลบั้ม..."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
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
          
          {/* ═══ CAMERA TAB FOOTER ═══ */}
          {activeTab === "camera" && (
            <>
              {/* ENROLL MODE CONTROLS */}
              {mode === "enroll" && !enrollDone && (
                <div className="w-full text-center text-xs font-medium text-slate-400 py-2">
                  💡 กรุณาจัดใบหน้าให้อยู่ในกรอบประชิดและหันตามมุมที่ระบุ ระบบจะจับภาพอัตโนมัติ
                </div>
              )}

              {mode === "enroll" && enrollDone && (
                <>
                  <button
                    onClick={() => { setStep(0); setCaptures([]); setPreviews([]); }}
                    disabled={processing}
                    className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-white font-bold rounded-2xl text-sm transition-all"
                  >
                    สแกนใหม่
                  </button>
                  <button
                    onClick={handleEnrollSubmit}
                    disabled={processing}
                    className="flex-[2] py-3 bg-[var(--accent-green)] hover:brightness-110 disabled:opacity-70 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>บันทึกใบหน้าลงระบบ</span>
                  </button>
                </>
              )}

              {/* SEARCH MODE CONTROLS */}
              {mode === "search" && !capturePreview && (
                <div className="w-full text-center text-xs font-medium text-slate-400 py-2">
                  💡 ขยับใบหน้าของคุณมาตรงกลางกรอบ ระบบจะจับภาพและสแกนค้นหารูปภาพอัตโนมัติ
                </div>
              )}

              {mode === "search" && capturePreview && !processing && (
                <>
                  <button
                    onClick={() => { setCaptureFile(null); setCapturePreview(null); }}
                    className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-white font-bold rounded-2xl text-sm transition-all"
                  >
                    สแกนใหม่
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
            </>
          )}

          {/* ═══ UPLOAD TAB FOOTER ═══ */}
          {activeTab === "upload" && (
            <>
              {!hasUploadResult && (
                <div className="w-full text-center text-xs font-medium text-slate-400 py-2">
                  📁 เลือกรูปภาพที่เห็นใบหน้าของคุณชัดเจน ระบบจะตรวจจับใบหน้าอัตโนมัติ
                </div>
              )}

              {hasUploadResult && !processing && (
                <>
                  <button
                    onClick={clearUpload}
                    className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-white font-bold rounded-2xl text-sm transition-all"
                  >
                    เลือกรูปใหม่
                  </button>

                  {canSubmitUpload && (
                    <button
                      onClick={handleUploadSubmit}
                      disabled={processing}
                      className={`flex-[2] py-3 hover:brightness-110 disabled:opacity-70 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-1.5 ${
                        mode === "enroll"
                          ? "bg-[var(--accent-green)] shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                          : "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)]"
                      }`}
                    >
                      {mode === "enroll" ? (
                        <><UserCheck className="h-4 w-4" /><span>บันทึกใบหน้าลงระบบ</span></>
                      ) : (
                        <span>ค้นหารูปภาพทันที</span>
                      )}
                    </button>
                  )}

                  {!uploadFaceDetected && (
                    <div className="flex-[2] py-3 bg-slate-800/50 text-slate-500 font-bold rounded-2xl text-sm flex items-center justify-center gap-1.5 cursor-not-allowed">
                      <AlertCircle className="h-4 w-4" />
                      <span>ไม่พบใบหน้าในรูป</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default FaceScanModal;
