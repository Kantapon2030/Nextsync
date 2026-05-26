// components/shared/Navbar.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  Image as ImageIcon,
  User,
  Upload,
  List,
  LayoutDashboard,
  Users,
  Trash2,
  Sliders,
  LogOut,
  ChevronDown,
  Calendar,
} from "lucide-react";

import { NextsyncLogo } from "./NextsyncLogo";
import { NextsyncWordmark } from "./NextsyncWordmark";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const role = session?.user?.role;

  // Nav links based on roles for rendering
  const studentLinks = [
    { href: "/gallery", label: "แกลเลอรี", icon: ImageIcon },
    { href: "/my-photos", label: "รูปของฉัน", icon: User },
  ];

  const photographerLinks = [
    { href: "/gallery", label: "แกลเลอรี", icon: ImageIcon },
    { href: "/upload", label: "อัปโหลดรูป", icon: Upload },
    { href: "/my-uploads", label: "รูปที่อัปโหลด", icon: List },
  ];

  const adminLinks = [
    { href: "/admin/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    { href: "/admin/events", label: "จัดการ Events", icon: Calendar },
    { href: "/admin/photos", label: "จัดการรูปภาพ", icon: ImageIcon },
    { href: "/admin/users", label: "จัดการสมาชิก", icon: Users },
    { href: "/admin/reject-queue", label: "รูปคัดออก", icon: Trash2 },
    { href: "/admin/config", label: "ฟิลเตอร์", icon: Sliders },
  ];

  const getLinks = () => {
    if (!session) return [{ href: "/gallery", label: "แกลเลอรี", icon: ImageIcon }];
    switch (role) {
      case "admin": return adminLinks;
      case "photographer": return photographerLinks;
      default: return studentLinks;
    }
  };

  const links = getLinks();

  return (
    <>
      <header 
        style={{
          background: "rgba(8, 10, 18, 0.5)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
          position: "sticky",
          top: 0,
          zIndex: 50
        }}
        className="w-full"
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 select-none">
              <div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <NextsyncLogo size={40} variant="nav" />
              </div>
              <NextsyncWordmark variant="nav" />
            </Link>

            {/* Desktop Center Links */}
            <nav className="hidden md:flex items-center gap-6 ml-4">
              {links.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-all duration-200 hover:text-[var(--text)] ${
                      isActive ? "text-[var(--text)] border-b-2 border-[var(--accent-blue)] py-1" : "text-[var(--text2)]"
                    }`}
                  >
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center gap-4">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all"
                >
                  <div className="h-7 w-7 rounded-full bg-[var(--accent-purple)] flex items-center justify-center text-xs font-semibold text-white overflow-hidden">
                    {session.user.image ? (
                      <img src={session.user.image} alt={session.user.name || ""} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      (session.user.name || "U")[0].toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-medium text-[var(--text)] max-w-[120px] truncate">{session.user.name}</span>
                  <ChevronDown className="h-4 w-4 text-[var(--text2)]" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--bg2)] shadow-2xl p-1 z-50">
                    <div className="px-3 py-2 border-b border-[var(--border)] text-left">
                      <p className="text-xs font-semibold text-[var(--text2)] capitalize">
                        {role === "admin" ? "ผู้ดูแลระบบ" : role === "photographer" ? "ช่างภาพ" : "นักเรียน"}
                      </p>
                      <p className="text-[10px] text-[var(--text3)] mt-0.5">{session.user.studentId}</p>
                    </div>
                    {role === "student" && (
                      <Link
                        href="/my-photos"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors text-left"
                      >
                        <User className="h-4 w-4" />
                        <span>รูปของฉัน</span>
                      </Link>
                    )}
                    {(role === "photographer" || role === "admin") && (
                      <Link
                        href="/upload"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors text-left"
                      >
                        <Upload className="h-4 w-4" />
                        <span>อัปโหลด</span>
                      </Link>
                    )}
                    {role === "admin" && (
                      <Link
                        href="/admin/dashboard"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors text-left"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>แผงควบคุม</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--accent-red)] hover:bg-red-950/20 rounded-lg transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/photographer"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    padding: "7px 16px",
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.55)"
                  }}
                  className="transition-colors hover:border-[rgba(255,255,255,0.3)] hover:text-white"
                >
                  เข้าสู่ระบบช่างภาพ
                </Link>
                <Link
                  href="/auth/login"
                  className="glass px-4 py-1.5 text-xs font-semibold text-[var(--text)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] transition-all"
                >
                  เข้าสู่ระบบ
                </Link>
              </div>
            )}
          </div>

          {/* Hamburger Menu Toggle (Mobile) */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-2 text-[var(--text2)] hover:bg-[var(--surface)] focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setIsOpen(false)}>
          <div 
            className="fixed top-16 right-0 bottom-0 w-64 bg-[var(--bg2)] border-l border-[var(--border)] p-6 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {session ? (
                <div className="pb-4 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[var(--accent-purple)] flex items-center justify-center text-sm font-semibold text-white overflow-hidden">
                      {session.user.image ? (
                        <img src={session.user.image} alt={session.user.name || ""} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        (session.user.name || "U")[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[var(--text)]">{session.user.name}</p>
                      <p className="text-xs text-[var(--text2)] capitalize">
                        {role === "admin" ? "ผู้ดูแลระบบ" : role === "photographer" ? "ช่างภาพ" : "นักเรียน"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pb-4 border-b border-[var(--border)]">
                  <p className="text-sm font-semibold text-[var(--text)]">ยังไม่ได้เข้าสู่ระบบ</p>
                </div>
              )}
              <nav className="flex flex-col gap-3">
                {links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive 
                          ? "text-[var(--text)] bg-[var(--surface-hover)] font-semibold border-l-4 border-[var(--accent-blue)]" 
                          : "text-[var(--text2)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            {session ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleSignOut();
                }}
                className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--accent-red)] border border-red-950/20 rounded-xl py-2.5 bg-red-950/10 hover:bg-red-950/30 transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span>ออกจากระบบ</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/auth/photographer"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)] border border-[var(--border)] rounded-xl py-2.5 bg-[var(--surface)]"
                >
                  เข้าสู่ระบบช่างภาพ
                </Link>
                <Link
                  href="/auth/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center text-sm font-semibold text-white rounded-xl py-2.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)]"
                >
                  เข้าสู่ระบบ
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
