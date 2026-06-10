// app/auth/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Key, User, AlertCircle, Loader2 } from "lucide-react";
import { NextsyncLogo } from "@/components/shared/NextsyncLogo";
import { NextsyncWordmark } from "@/components/shared/NextsyncWordmark";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!studentId.trim()) {
      setError("กรุณากรอกรหัสผู้ใช้งาน");
      return;
    }
    if (!password) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        studentId,
        password,
      });

      if (res?.error) {
        setError("รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background aurora glow */}
      <div className="gemini-bg opacity-50" />

      {/* Card container */}
      <div className="relative z-10 max-w-md w-full glass p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex flex-col items-center gap-3">
            <NextsyncLogo size={56} variant="nav" />
            <NextsyncWordmark variant="nav" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">เข้าสู่ระบบ</h2>
            <p className="text-xs text-[var(--text2)]">สำหรับผู้ใช้งานทั่วไป, นักเรียน และช่างภาพ</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-[var(--accent-red)] text-xs font-semibold">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสผู้ใช้งาน (Username / รหัสนักเรียน)</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="กรอกรหัสนักเรียน 5 หลัก หรือ รหัสช่างภาพ"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[var(--accent-purple)] transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสผ่าน</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านของคุณ"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[var(--accent-purple)] transition-all"
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
              <span>เข้าสู่ระบบ</span>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-[var(--border)] text-center space-y-2">
          <p className="text-xs text-[var(--text2)]">
            ยังไม่มีบัญชีนักเรียน?{" "}
            <Link href="/auth/register" className="text-[var(--accent-blue)] hover:underline font-semibold">
              สมัครสมาชิกที่นี่
            </Link>
          </p>
          <p className="text-xs text-[var(--text3)]">
            ช่างภาพยังไม่มีบัญชี?{" "}
            <Link href="/auth/photographer" className="text-[var(--accent-purple)] hover:underline font-semibold">
              ลงทะเบียนช่างภาพที่นี่
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
