// app/auth/photographer/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Key, User, ShieldCheck, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { NextsyncLogo } from "@/components/shared/NextsyncLogo";
import { NextsyncWordmark } from "@/components/shared/NextsyncWordmark";

export default function PhotographerAuthPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [registerId, setRegisterId] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!loginId || !loginPassword) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        studentId: loginId,
        password: loginPassword,
      });

      if (res?.error) {
        setError("รหัสผู้ใช้งานหรือรหัสผ่านช่างภาพไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      setLoading(false);
    }
  };

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

      setSuccess("สมัครสมาชิกช่างภาพสำเร็จ! ระบบกำลังสลับไปยังหน้าเข้าสู่ระบบ...");
      
      // Clear registration state
      setRegisterId("");
      setRegisterName("");
      setRegisterPassword("");
      setInviteCode("");
      
      setTimeout(() => {
        setActiveTab("login");
        setSuccess(null);
        setLoading(false);
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
            <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">ระบบบริการช่างภาพ</h2>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-[var(--accent-purple)] border border-purple-500/20 uppercase tracking-wider">
              สำหรับช่างภาพ
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-black/40 rounded-xl p-1 border border-[var(--border)]">
          <button
            onClick={() => { setActiveTab("login"); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "login" ? "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]" : "text-[var(--text2)] hover:text-white"
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            onClick={() => { setActiveTab("register"); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "register" ? "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]" : "text-[var(--text2)] hover:text-white"
            }`}
          >
            สมัครสมาชิก
          </button>
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

        {/* Login Tab */}
        {activeTab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสประจำตัว (Username/ID)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="กรอกรหัสประจำตัวช่างภาพ"
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
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านเข้าใช้งาน"
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
                  <span>กำลังยืนยันตัวตน...</span>
                </>
              ) : (
                <span>เข้าสู่ระบบช่างภาพ</span>
              )}
            </button>
          </form>
        )}

        {/* Register Tab */}
        {activeTab === "register" && (
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
        )}

        <div className="pt-4 border-t border-[var(--border)] text-center">
          <Link href="/" className="text-xs text-[var(--text2)] hover:text-white transition-colors">
            ← กลับหน้าหลัก
          </Link>
        </div>

      </div>
    </div>
  );
}
