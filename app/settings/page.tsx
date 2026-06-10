// app/settings/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Key, Lock, AlertCircle, CheckCircle2, Loader2, Sliders } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Protect route client-side (if not loaded yet or unauthenticated)
  if (status === "unauthenticated") {
    router.push("/auth/login?next=/settings");
    return null;
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <Loader2 className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--text2)] animate-pulse">กำลังโหลดการตั้งค่า...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side checks
    if (!currentPassword) {
      setError("กรุณากรอกรหัสผ่านปัจจุบัน");
      return;
    }
    if (newPassword.length < 6) {
      setError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
      }

      setSuccess("เปลี่ยนรหัสผ่านเสร็จสมบูรณ์เรียบร้อยแล้ว!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Automatically clear success message or redirect after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background aurora glow */}
      <div className="gemini-bg opacity-30" />

      {/* Card container */}
      <div className="relative z-10 max-w-md w-full glass p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/20 text-[var(--accent-purple)]">
            <Sliders className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">ตั้งค่าบัญชีผู้ใช้</h2>
            <p className="text-xs text-[var(--text2)]">ความปลอดภัยและการตั้งค่ารหัสผ่านใหม่</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-[var(--accent-red)] text-xs font-semibold">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-950/20 border border-green-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-[var(--accent-green)] text-xs font-semibold">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 animate-bounce" />
            <span>{success}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสผ่านปัจจุบัน</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านเดิมที่ใช้งานอยู่"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[var(--accent-purple)] transition-all"
                required
              />
            </div>
          </div>

          <hr className="border-[var(--border)] my-4" />

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text2)] uppercase tracking-wider">รหัสผ่านใหม่</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่ (ไม่ต่ำกว่า 6 ตัวอักษร)"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[var(--accent-purple)] transition-all"
                required
              />
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text2)] uppercase tracking-wider">ยืนยันรหัสผ่านใหม่</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="พิมพ์รหัสผ่านใหม่อีกครั้งเพื่อยืนยัน"
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[var(--accent-purple)] transition-all"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 disabled:from-gray-800 disabled:to-gray-800 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังบันทึกรหัสผ่านใหม่...</span>
              </>
            ) : (
              <span>เปลี่ยนรหัสผ่าน</span>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => router.back()}
            className="text-xs text-[var(--text3)] hover:text-white transition-colors"
          >
            ย้อนกลับ
          </button>
        </div>

      </div>
    </div>
  );
}
