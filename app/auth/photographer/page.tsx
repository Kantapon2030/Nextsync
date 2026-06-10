// app/auth/photographer/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Key, User, ShieldCheck, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { NextsyncLogo } from "@/components/shared/NextsyncLogo";
import { NextsyncWordmark } from "@/components/shared/NextsyncWordmark";

export default function PhotographerAuthPage() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Register form state
  const [registerId, setRegisterId] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!registerId || !registerName || !registerPassword || !inviteCode) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (registerId.length < 3) {
      setError("รหัส ID ต้องมีความยาวอย่างน้อย 3 ตัวอักษร");
      return;
    }

    if (registerPassword.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: registerId,
          displayName: registerName,
          password: registerPassword,
          role: "photographer",
          inviteCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
      }

      setSuccess("สมัครสมาชิกช่างภาพสำเร็จ! กำลังนำคุณไปยังหน้าเข้าสู่ระบบ...");
      
      // Clear registration state
      setRegisterId("");
      setRegisterName("");
      setRegisterPassword("");
      setInviteCode("");
      
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "การสมัครสมาชิกเกิดข้อผิดพลาด");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Card Wrapper */}
      <div className="relative z-10 max-w-md w-full glass p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex flex-col items-center gap-3">
            <NextsyncLogo size={56} variant="nav" />
            <NextsyncWordmark variant="nav" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">ลงทะเบียนช่างภาพ</h2>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-[var(--accent-purple)] border border-purple-500/20 uppercase tracking-wider">
              สำหรับช่างภาพ
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 text-xs font-semibold text-[var(--accent-red)] flex items-start gap-2.5">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-950/20 border border-green-900/30 rounded-xl p-3 text-xs font-semibold text-[var(--accent-green)] flex items-start gap-2.5">
            <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">ตั้งรหัสประจำตัว (Username/ID)</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="text"
                value={registerId}
                onChange={(e) => setRegisterId(e.target.value)}
                placeholder="เช่น photographer01"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">ชื่อ-นามสกุล ช่างภาพ</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="text"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสผ่าน</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                placeholder="รหัสผ่านเข้าใช้งาน (ขั้นต่ำ 6 ตัว)"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--accent-purple)] uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>รหัสเชิญช่างภาพ (Photographer Invite Code)</span>
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="กรอกรหัสเชิญจากผู้ดูแลระบบ"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] transition-all"
                required
              />
            </div>
            <p className="text-[10px] text-[var(--text3)] mt-0.5">
              * ต้องมีรหัสเชิญจากผู้ดูแลระบบ (Admin) เพื่อลงทะเบียนบทบาทช่างภาพ
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:from-gray-800 disabled:to-gray-800 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังสมัครสมาชิก...</span>
              </>
            ) : (
              <>
                <span>สมัครสมาชิกช่างภาพ</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-[var(--border)] text-center space-y-2">
          <p className="text-xs text-[var(--text2)]">
            มีบัญชีช่างภาพอยู่แล้ว?{" "}
            <Link href="/auth/login" className="text-[var(--accent-blue)] hover:underline font-semibold">
              เข้าสู่ระบบที่นี่
            </Link>
          </p>
          <Link href="/" className="inline-block text-xs text-[var(--text3)] hover:text-white transition-colors">
            ← กลับหน้าหลัก
          </Link>
        </div>

      </div>
    </div>
  );
}
