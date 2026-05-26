// app/admin/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Users, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  RefreshCcw, 
  UserX, 
  ShieldCheck, 
  ShieldAlert, 
  Camera, 
  User, 
  Check, 
  X,
  Loader2
} from "lucide-react";

interface UserItem {
  id: string;
  studentId: string;
  displayName: string | null;
  role: "student" | "photographer" | "admin";
  faceEnrolled: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  
  // Modals state
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState<"student" | "photographer" | "admin">("student");
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetFaceId, setConfirmResetFaceId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (roleFilter) queryParams.append("role", roleFilter);

      const res = await fetch(`/api/admin/users?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchUsers();
    }
  }, [session, status, search, roleFilter]);

  const handleEditClick = (user: UserItem) => {
    setEditingUser(user);
    setEditRole(user.role);
    setErrorMsg("");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setActionLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          role: editRole,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === editingUser.id ? data.user : u));
        setEditingUser(null);
      } else {
        setErrorMsg(data.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetFace = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resetFace: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === id ? data.user : u));
        setConfirmResetFaceId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== id));
        setConfirmDeleteId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950/20 text-[var(--accent-purple)] border border-purple-900/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ผู้ดูแลระบบ</span>
          </span>
        );
      case "photographer":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950/20 text-[var(--accent-blue)] border border-blue-900/30">
            <Camera className="h-3.5 w-3.5" />
            <span>ช่างภาพ</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--surface)] text-[var(--text2)] border border-[var(--border)]">
            <User className="h-3.5 w-3.5" />
            <span>นักเรียน</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Title Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass border border-[var(--border)] select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-[var(--accent-purple)]" />
            <span>จัดการสมาชิกและผู้ใช้งาน (User Management)</span>
          </h2>
          <p className="text-xs text-[var(--text2)]">แก้ไขบทบาท หน้าที่ สมาชิก และควบคุมข้อมูลสแกนใบหน้าของนักเรียน</p>
        </div>
        <button
          onClick={fetchUsers}
          className="self-start sm:self-center p-2.5 text-[var(--text2)] hover:text-white bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-colors"
          title="รีเฟรชข้อมูล"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Filters Area */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัสนักเรียน หรือ ชื่อ-นามสกุล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-[var(--accent-purple)] text-[var(--text)] placeholder-[var(--text3)]"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-[var(--accent-purple)] text-[var(--text2)] appearance-none cursor-pointer"
          >
            <option value="" className="bg-[#080A12]">ทุกบทบาทหน้าที่</option>
            <option value="student" className="bg-[#080A12]">นักเรียน (Student)</option>
            <option value="photographer" className="bg-[#080A12]">ช่างภาพ (Photographer)</option>
            <option value="admin" className="bg-[#080A12]">ผู้ดูแลระบบ (Admin)</option>
          </select>
        </div>

        <div className="flex items-center justify-end">
          <span className="text-xs font-bold text-[var(--text2)] bg-[var(--surface)] border border-[var(--border)] px-4 py-2 rounded-xl">
            ผู้ใช้ในระบบทั้งหมด {users.length} คน
          </span>
        </div>
      </div>

      {/* User Table Grid */}
      <div className="relative z-10 w-full glass border border-[var(--border)] overflow-hidden select-none">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-[var(--accent-purple)] animate-spin" />
            <p className="text-xs font-semibold text-[var(--text2)]">กำลังดึงข้อมูลสมาชิก...</p>
          </div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 border-b border-[var(--border)] text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">
                  <th className="py-4 px-6">รหัสประจำตัว/นักเรียน</th>
                  <th className="py-4 px-6">ชื่อ-นามสกุล</th>
                  <th className="py-4 px-6">บทบาท</th>
                  <th className="py-4 px-6">สแกนใบหน้า</th>
                  <th className="py-4 px-6">เข้าสู่ระบบล่าสุด</th>
                  <th className="py-4 px-6 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text2)] text-xs font-semibold">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--surface)] transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-[var(--text)]">{user.studentId}</td>
                    <td className="py-4 px-6 text-sm font-bold text-[var(--text)]">{user.displayName || "-"}</td>
                    <td className="py-4 px-6">{getRoleBadge(user.role)}</td>
                    <td className="py-4 px-6">
                      {user.faceEnrolled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-green)] bg-green-950/20 border border-green-900/30 rounded-full px-2 py-0.5 font-bold">
                          <Check className="h-3 w-3 stroke-[3]" />
                          <span>สแกนแล้ว</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text3)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-2 py-0.5 font-medium">
                          <X className="h-3 w-3 stroke-[3]" />
                          <span>ยังไม่มี</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-[var(--text3)] font-mono">
                      {user.lastLogin 
                        ? new Date(user.lastLogin).toLocaleString("th-TH", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "-"
                      }
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(user)}
                          className="p-2 text-[var(--text2)] hover:text-white hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all"
                          title="แก้ไขบทบาทหน้าที่"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.faceEnrolled && (
                          <button
                            onClick={() => setConfirmResetFaceId(user.id)}
                            className="p-2 text-[var(--text2)] hover:text-[var(--accent-yellow)] hover:bg-amber-950/20 border border-[var(--border)] rounded-xl transition-all"
                            title="ล้างข้อมูลสแกนใบหน้า"
                          >
                            <RefreshCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDeleteId(user.id)}
                          className="p-2 text-[var(--text3)] hover:text-[var(--accent-red)] hover:bg-red-950/20 border border-[var(--border)] rounded-xl transition-all"
                          title="ลบผู้ใช้ออกจากระบบ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 select-none">
            <div className="h-12 w-12 bg-[var(--surface)] text-[var(--text2)] rounded-full flex items-center justify-center mb-4 border border-[var(--border)]">
              <ShieldAlert className="h-6 w-6 text-[var(--accent-yellow)]" />
            </div>
            <h4 className="font-bold text-[var(--text)] text-sm">ไม่พบผู้ใช้งานตามตัวเลือก</h4>
            <p className="text-xs text-[var(--text2)] mt-1 max-w-xs leading-relaxed">
              ลองแก้ไขการสะกดคำในช่องค้นหาหรือเปลี่ยนฟิลเตอร์กรองบทบาท
            </p>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0D0F1C] border border-[var(--border)] rounded-3xl w-full max-w-md overflow-hidden p-6 space-y-6 shadow-2xl">
            <div>
              <h3 className="text-base font-extrabold text-[var(--text)]">แก้ไขข้อมูลผู้ใช้งาน</h3>
              <p className="text-xs text-[var(--text2)] mt-0.5">
                รหัสนักเรียน/ผู้ใช้: {editingUser.studentId} ({editingUser.displayName || "ไม่มีชื่อ"})
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-red-950/20 border border-red-900/30 text-[var(--accent-red)] rounded-2xl text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text2)]">บทบาทหน้าที่ (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-2xl focus:outline-none focus:border-[var(--accent-purple)] text-[var(--text)]"
                >
                  <option value="student" className="bg-[#080A12]">นักเรียน (Student)</option>
                  <option value="photographer" className="bg-[#080A12]">ช่างภาพ (Photographer)</option>
                  <option value="admin" className="bg-[#080A12]">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-[var(--text2)] hover:text-white bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-2xl transition-colors border border-[var(--border)]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] rounded-2xl transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>บันทึก</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Face Embeddings Confirmation */}
      {confirmResetFaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0D0F1C] border border-[var(--border)] rounded-3xl w-full max-w-sm overflow-hidden p-6 space-y-6 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 bg-amber-950/20 text-[var(--accent-yellow)] rounded-full flex items-center justify-center border border-amber-900/30">
                <RefreshCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--text)]">ล้างข้อมูลสแกนใบหน้า?</h3>
                <p className="text-xs text-[var(--text2)] mt-1 max-w-[280px] leading-relaxed">
                  การกระทำนี้จะลบข้อมูลชุดรหัสใบหน้า (Face Embedding Vector) ทั้งหมดของผู้ใช้นี้ออกจากฐานข้อมูล ระบบจะแสดงสถานะว่ายังไม่ได้ลงทะเบียนสแกนใบหน้า
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmResetFaceId(null)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-[var(--text2)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-2xl transition-colors border border-[var(--border)]"
              >
                ยกเลิก
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleResetFace(confirmResetFaceId)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-[var(--accent-yellow)] rounded-2xl transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>ล้างสแกนใบหน้า</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0D0F1C] border border-[var(--border)] rounded-3xl w-full max-w-sm overflow-hidden p-6 space-y-6 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 bg-red-950/20 text-[var(--accent-red)] rounded-full flex items-center justify-center border border-red-900/30">
                <UserX className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--text)]">ลบผู้ใช้นี้ออกจากระบบ?</h3>
                <p className="text-xs text-[var(--text2)] mt-1 max-w-[280px] leading-relaxed">
                  ยืนยันการลบบัญชีและข้อมูลที่เชื่อมโยงทั้งหมด (รวมถึงภาพถ่าย/สแกนใบหน้า) ออกจากระบบอย่างถาวร การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-[var(--text2)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-2xl transition-colors border border-[var(--border)]"
              >
                ยกเลิก
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleDeleteUser(confirmDeleteId)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-[var(--accent-red)] rounded-2xl transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>ยืนยันลบผู้ใช้</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
