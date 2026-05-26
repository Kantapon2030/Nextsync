// app/auth/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { Key, User, CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { FaceEnrollment } from "@/components/auth/FaceEnrollment";
import { NextsyncLogo } from "@/components/shared/NextsyncLogo";
import { NextsyncWordmark } from "@/components/shared/NextsyncWordmark";

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  // Step state: 1 (Info), 2 (Face Enroll), 3 (Success)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form inputs
  const [studentId, setStudentId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 2 Face Enroll states
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  // Handle Step 1: Info -> Register + Sign In in background -> Go to Step 2
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    if (studentId.length !== 5 || !/^\d+$/.test(studentId)) {
      setValidationError("รหัสนักเรียนต้องเป็นตัวเลข 5 หลักเท่านั้น");
      return;
    }
    if (password.length < 6) {
      setValidationError("รหัสผ่านต้องมีความยาวไม่ต่ำกว่า 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      // 1. Post to API register
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          displayName: displayName || undefined,
          password,
          role: "student",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถลงทะเบียนได้");
      }

      // 2. Sign In dynamically in background to authorize session
      const authResult = await signIn("credentials", {
        redirect: false,
        studentId,
        password,
      });

      if (authResult?.error) {
        throw new Error("สมัครสมาชิกแล้ว แต่ไม่สามารถเข้าสู่ระบบในเบื้องหลังได้ กรุณาล็อกอินด้วยตนเอง");
      }

      // Go to Step 2
      setStep(2);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Face Enrollment
  const handleFaceEnroll = async (embedding: number[]) => {
    setEnrollError(null);
    setEnrolling(true);

    try {
      const res = await fetch("/api/face/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึกใบหน้า");
      }

      // Sync Next-Auth session properties
      await update({ faceEnrolled: true });

      // Go to Step 3
      setStep(3);

      // Auto redirect to gallery after 3 seconds
      setTimeout(() => {
        router.push("/gallery");
        router.refresh();
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setEnrollError(err.message || "ไม่สามารถส่งข้อมูลสแกนใบหน้าได้");
    } finally {
      setEnrolling(false);
    }
  };

  const handleSkipEnroll = () => {
    setStep(3);
    setTimeout(() => {
      router.push("/gallery");
      router.refresh();
    }, 3000);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background glow */}
      <div className="gemini-bg opacity-40" />

      {/* Card Wrapper */}
      <div className="relative z-10 max-w-lg w-full glass p-8 space-y-6">
        
        {/* Step Indicator (3 Dots) */}
        <div className="flex items-center justify-between max-w-[240px] mx-auto mb-4">
          <div className="flex flex-col items-center gap-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 1 ? "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white scale-110 shadow-lg" : "bg-slate-800 text-slate-500"
            }`}>1</div>
            <span className="text-[9px] font-bold text-[var(--text2)] uppercase">ข้อมูลหลัก</span>
          </div>
          <div className={`h-0.5 flex-1 mx-2 transition-all duration-300 ${step >= 2 ? "bg-[var(--accent-blue)]" : "bg-slate-800"}`} />
          <div className="flex flex-col items-center gap-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 2 ? "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white scale-110 shadow-lg" : "bg-slate-800 text-slate-500"
            }`}>2</div>
            <span className="text-[9px] font-bold text-[var(--text2)] uppercase">สแกนหน้า</span>
          </div>
          <div className={`h-0.5 flex-1 mx-2 transition-all duration-300 ${step >= 3 ? "bg-[var(--accent-purple)]" : "bg-slate-800"}`} />
          <div className="flex flex-col items-center gap-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 3 ? "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white scale-110 shadow-lg" : "bg-slate-800 text-slate-500"
            }`}>3</div>
            <span className="text-[9px] font-bold text-[var(--text2)] uppercase">สำเร็จ</span>
          </div>
        </div>

        {/* Step 1: Account Info Form */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto flex flex-col items-center gap-3 mb-2">
                <NextsyncLogo size={56} variant="nav" />
                <NextsyncWordmark variant="nav" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[var(--text)]">ลงทะเบียน</h3>
                <p className="text-xs text-[var(--text2)]">สร้างบัญชีผู้ใช้งานส่วนตัวเพื่อเริ่มบันทึกรูปภาพ</p>
              </div>
            </div>

            {validationError && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 text-xs font-semibold text-[var(--accent-red)] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 text-xs font-semibold text-[var(--accent-red)] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสนักเรียน 5 หลัก</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
                  <input
                    type="text"
                    maxLength={5}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                    placeholder="กรอกรหัส 5 หลัก เช่น 00000"
                    className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">ชื่อ-นามสกุล (เว้นว่างได้)</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="กรอกชื่อและนามสกุลสำหรับแสดงผล"
                    className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสผ่าน</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ตั้งรหัสผ่านความปลอดภัย (ขั้นต่ำ 6 ตัวอักษร)"
                    className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">ยืนยันรหัสผ่าน</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="พิมพ์รหัสผ่านอีกครั้งเพื่อยืนยัน"
                    className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:from-gray-800 disabled:to-gray-800 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>กำลังส่งข้อมูลลงทะเบียน...</span>
                  </>
                ) : (
                  <>
                    <span>ลงทะเบียนและบันทึกใบหน้าต่อ</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-[var(--border)] text-center">
              <p className="text-xs text-[var(--text2)]">
                มีบัญชีอยู่แล้ว?{" "}
                <Link href="/auth/login" className="text-[var(--accent-blue)] hover:underline font-semibold">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Face Enrollment Webcam */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-[var(--text)]">สแกนใบหน้าบันทึกระบบ</h3>
              <p className="text-xs text-[var(--text2)]">
                มองตรงมายังกล้องและรักษาระยะห่างเพื่อให้ AI สร้างแผนผังใบหน้าสำหรับการค้นหารูป
              </p>
            </div>

            <FaceEnrollment
              onEnroll={handleFaceEnroll}
              isLoading={enrolling}
              errorMsg={enrollError}
            />

            <div className="text-center pt-2">
              <button
                onClick={handleSkipEnroll}
                className="text-xs text-[var(--text3)] hover:text-[var(--text2)] underline font-semibold transition-colors"
              >
                ข้ามขั้นตอนการสแกนใบหน้าไปก่อน (สามารถทำภายหลังได้ที่เมนู รูปของฉัน)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success Screen with Floating Dots CSS Confetti */}
        {step === 3 && (
          <div className="relative overflow-hidden flex flex-col items-center text-center space-y-6 py-12">
            
            {/* CSS-only floating confetti dots background */}
            <div className="absolute inset-0 pointer-events-none">
              <span className="absolute bg-[var(--accent-blue)] h-2 w-2 rounded-full animate-bubble" style={{ left: "20%", animationDelay: "0s" }} />
              <span className="absolute bg-[var(--accent-purple)] h-3 w-3 rounded-full animate-bubble" style={{ left: "40%", animationDelay: "1s" }} />
              <span className="absolute bg-[var(--accent-green)] h-2 w-2 rounded-full animate-bubble" style={{ left: "60%", animationDelay: "0.5s" }} />
              <span className="absolute bg-[var(--accent-yellow)] h-2.5 w-2.5 rounded-full animate-bubble" style={{ left: "80%", animationDelay: "1.5s" }} />
              <span className="absolute bg-[var(--accent-red)] h-2 w-2 rounded-full animate-bubble" style={{ left: "15%", animationDelay: "2s" }} />
            </div>

            <div className="h-16 w-16 bg-[var(--surface)] border border-[var(--accent-green)] rounded-full flex items-center justify-center text-[var(--accent-green)] shadow-lg shadow-green-950/20">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>
            
            <div className="space-y-2 relative z-10">
              <h3 className="text-2xl font-bold text-[var(--text)]">ลงทะเบียนสำเร็จ!</h3>
              <p className="text-sm font-medium text-[var(--text2)]">ยินดีต้อนรับเข้าสู่คลังภาพของ <NextsyncWordmark variant="nav" /></p>
              <p className="text-xs text-[var(--text3)]">ระบบกำลังนำคุณเข้าสู่แกลเลอรีรูปภาพกิจกรรมในอีกครู่...</p>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[var(--text2)] animate-pulse font-medium bg-[var(--surface)] px-4 py-2 rounded-full border border-[var(--border)] relative z-10">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-purple)]" />
              <span>กำลังเตรียมความพร้อมเข้าสู่ระบบ...</span>
            </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes bubble {
          0% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-100px) scale(1.2);
            opacity: 0;
          }
        }
        .animate-bubble {
          bottom: 0;
          animation: bubble 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
