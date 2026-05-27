#!/usr/bin/env python3
# pipeline/desktop_app.py
# NextSync Pipeline Desktop App — Tkinter GUI
# Run: python desktop_app.py
# Build .exe: pyinstaller --onefile --windowed --name "NextSync Pipeline" desktop_app.py

import os
import sys
import json
import queue
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from pathlib import Path

# ─── Config persistence ───────────────────────────────────────
CONFIG_PATH = Path.home() / ".nextsync_pipeline.json"

DEFAULT_CONFIG = {
    "service_account_path": "",
    "folder_id": "",
    "event_id": "",
    "workers": 4,
    "database_url": "",
    "r2_account_id": "",
    "r2_access_key_id": "",
    "r2_secret_access_key": "",
    "r2_bucket_name": "",
    "r2_public_url": "",
    "face_api_url": "http://127.0.0.1:8000",
    "face_api_secret": "dev-secret-key-change-this-in-prod",
}

def load_env_local():
    env_data = {}
    app_dir = Path(__file__).resolve().parent
    paths = [
        app_dir.parent / ".env.local",
        Path.cwd() / ".env.local",
    ]
    for p in paths:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            parts = line.split("=", 1)
                            key = parts[0].strip()
                            val = parts[1].strip()
                            # Strip quotes if present
                            if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                                val = val[1:-1]
                            env_data[key] = val
                break
            except Exception as e:
                print(f"Error loading .env.local: {e}")
    return env_data

def find_service_account_json():
    app_dir = Path(__file__).resolve().parent
    search_dirs = [
        app_dir.parent,  # project root
        Path.cwd(),
    ]
    for d in search_dirs:
        if not d.exists():
            continue
        for p in d.glob("*.json"):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and data.get("type") == "service_account":
                        return str(p.resolve())
            except:
                pass
    return ""

def load_config():
    cfg = dict(DEFAULT_CONFIG)
    
    # Try loading from .env.local first
    env = load_env_local()
    if env:
        if "DATABASE_URL" in env:
            cfg["database_url"] = env["DATABASE_URL"]
        if "R2_ACCOUNT_ID" in env:
            cfg["r2_account_id"] = env["R2_ACCOUNT_ID"]
        if "R2_ACCESS_KEY_ID" in env:
            cfg["r2_access_key_id"] = env["R2_ACCESS_KEY_ID"]
        if "R2_SECRET_ACCESS_KEY" in env:
            cfg["r2_secret_access_key"] = env["R2_SECRET_ACCESS_KEY"]
        if "R2_BUCKET_NAME" in env:
            cfg["r2_bucket_name"] = env["R2_BUCKET_NAME"]
        if "R2_PUBLIC_URL" in env:
            cfg["r2_public_url"] = env["R2_PUBLIC_URL"]
        if "GOOGLE_DRIVE_FOLDER_ID" in env:
            cfg["folder_id"] = env["GOOGLE_DRIVE_FOLDER_ID"]
        if "FACE_API_URL" in env:
            cfg["face_api_url"] = env["FACE_API_URL"]
        if "FACE_API_SECRET" in env:
            cfg["face_api_secret"] = env["FACE_API_SECRET"]

    # Try to find Service Account JSON file in directory
    sa_path = find_service_account_json()
    if sa_path:
        cfg["service_account_path"] = sa_path

    # Load saved user config (overrides defaults and .env.local values if saved)
    try:
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
            for k in saved:
                if saved[k]:
                    cfg[k] = saved[k]
    except Exception as e:
        print(f"Error loading saved config: {e}")
    return cfg

def save_config(cfg):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Could not save config: {e}")


# ─── Main App Window ───────────────────────────────────────────
class NextSyncApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("NextSync Pipeline Desktop")
        self.geometry("720x700")
        self.resizable(True, True)
        self.configure(bg="#0d0f1e")

        # State
        self.config_data = load_config()
        self.log_queue = queue.Queue()
        self.stop_event = threading.Event()
        self.pipeline_thread = None
        self.is_running = False

        self._build_ui()
        self._poll_log_queue()

    # ── UI Build ──────────────────────────────────────────────
    def _build_ui(self):
        # Style
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background="#0d0f1e")
        style.configure("TLabel", background="#0d0f1e", foreground="#c7d0e8", font=("Segoe UI", 9))
        style.configure("Bold.TLabel", background="#0d0f1e", foreground="#e8ecf8", font=("Segoe UI", 9, "bold"))
        style.configure("TEntry", fieldbackground="#1a1d2e", foreground="#e8ecf8",
                        insertcolor="#e8ecf8", bordercolor="#2a2d3e")
        style.configure("TButton", font=("Segoe UI", 9, "bold"))
        style.configure("Start.TButton", background="#4f46e5", foreground="white",
                        font=("Segoe UI", 10, "bold"))
        style.configure("Stop.TButton", background="#dc2626", foreground="white",
                        font=("Segoe UI", 10, "bold"))
        style.configure("Accent.Horizontal.TProgressbar", troughcolor="#1a1d2e", background="#6d28d9")

        # Title bar
        title_frame = tk.Frame(self, bg="#080b18", pady=12)
        title_frame.pack(fill=tk.X)
        tk.Label(
            title_frame, text="⬡ NextSync Pipeline Desktop",
            bg="#080b18", fg="#a78bfa",
            font=("Segoe UI", 13, "bold")
        ).pack(side=tk.LEFT, padx=16)
        tk.Label(
            title_frame, text="ระบบประมวลผลรูปภาพอัตโนมัติ (ไม่มีระบบคัดกรอง)",
            bg="#080b18", fg="#4a5273",
            font=("Segoe UI", 8)
        ).pack(side=tk.LEFT, padx=4)

        # Main content
        content = tk.Frame(self, bg="#0d0f1e", padx=16, pady=12)
        content.pack(fill=tk.BOTH, expand=True)

        # ── Section: Credentials ──
        self._section(content, "⚙️  การเชื่อมต่อ & ตั้งค่า")

        cred_frame = tk.Frame(content, bg="#131627", bd=0, relief=tk.FLAT, pady=10, padx=12)
        cred_frame.pack(fill=tk.X, pady=(2, 8))

        # Service Account
        self._field_row(cred_frame, "Service Account JSON:", "service_account_path",
                        browse=True, browse_type="file", row=0)
        # Folder ID
        self._field_row(cred_frame, "Google Drive Folder ID:", "folder_id", row=1)
        # Event ID
        self._field_row(cred_frame, "Event ID (เช่น day1_indoor):", "event_id", row=2)
        # Workers
        self._spinbox_row(cred_frame, "จำนวน Workers:", "workers", 1, 16, row=3)

        # ── Section: Env Vars ──
        self._section(content, "🔑  Environment Variables (DATABASE_URL, R2)")
        env_frame = tk.Frame(content, bg="#131627", pady=10, padx=12)
        env_frame.pack(fill=tk.X, pady=(2, 8))

        self._field_row(env_frame, "DATABASE_URL:", "database_url", row=0, show_char="")
        self._field_row(env_frame, "R2_ACCOUNT_ID:", "r2_account_id", row=1)
        self._field_row(env_frame, "R2_ACCESS_KEY_ID:", "r2_access_key_id", row=2)
        self._field_row(env_frame, "R2_SECRET_ACCESS_KEY:", "r2_secret_access_key", row=3, show_char="*")
        self._field_row(env_frame, "R2_BUCKET_NAME:", "r2_bucket_name", row=4)
        self._field_row(env_frame, "R2_PUBLIC_URL:", "r2_public_url", row=5)
        self._field_row(env_frame, "FACE_API_URL:", "face_api_url", row=6)
        self._field_row(env_frame, "FACE_API_SECRET:", "face_api_secret", row=7, show_char="*")

        # ── Controls ──
        ctrl_frame = tk.Frame(content, bg="#0d0f1e")
        ctrl_frame.pack(fill=tk.X, pady=8)

        self.start_btn = tk.Button(
            ctrl_frame, text="▶  เริ่ม Pipeline",
            bg="#4f46e5", fg="white",
            activebackground="#6d28d9", activeforeground="white",
            font=("Segoe UI", 11, "bold"), relief=tk.FLAT,
            padx=20, pady=8, cursor="hand2",
            command=self._start_pipeline
        )
        self.start_btn.pack(side=tk.LEFT, padx=(0, 8))

        self.stop_btn = tk.Button(
            ctrl_frame, text="⏹  หยุด",
            bg="#7f1d1d", fg="#fca5a5",
            activebackground="#dc2626", activeforeground="white",
            font=("Segoe UI", 11, "bold"), relief=tk.FLAT,
            padx=20, pady=8, cursor="hand2", state=tk.DISABLED,
            command=self._stop_pipeline
        )
        self.stop_btn.pack(side=tk.LEFT, padx=(0, 8))

        self.save_btn = tk.Button(
            ctrl_frame, text="💾  บันทึกการตั้งค่า",
            bg="#1e293b", fg="#94a3b8",
            activebackground="#1e3a5f", activeforeground="white",
            font=("Segoe UI", 9), relief=tk.FLAT,
            padx=12, pady=8, cursor="hand2",
            command=self._save_config
        )
        self.save_btn.pack(side=tk.RIGHT)

        # ── Progress ──
        self.progress_var = tk.DoubleVar()
        self.progress_label = tk.Label(
            content, text="ความคืบหน้า: รอเริ่มต้น",
            bg="#0d0f1e", fg="#64748b", font=("Segoe UI", 8)
        )
        self.progress_label.pack(anchor=tk.W)

        self.progress_bar = ttk.Progressbar(
            content, variable=self.progress_var,
            style="Accent.Horizontal.TProgressbar",
            mode="determinate", maximum=100
        )
        self.progress_bar.pack(fill=tk.X, pady=(2, 8))

        # ── Log ──
        log_header = tk.Frame(content, bg="#0d0f1e")
        log_header.pack(fill=tk.X)
        tk.Label(log_header, text="📋  Log การทำงาน",
                 bg="#0d0f1e", fg="#a78bfa",
                 font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT)
        tk.Button(
            log_header, text="ล้าง Log",
            bg="#0d0f1e", fg="#475569",
            activebackground="#1e293b", activeforeground="#94a3b8",
            font=("Segoe UI", 8), relief=tk.FLAT, cursor="hand2",
            command=lambda: self.log_box.delete("1.0", tk.END)
        ).pack(side=tk.RIGHT)

        self.log_box = scrolledtext.ScrolledText(
            content, height=10,
            bg="#080b18", fg="#94a3b8",
            font=("Consolas", 8),
            relief=tk.FLAT, borderwidth=0,
            insertbackground="#94a3b8",
            state=tk.DISABLED
        )
        self.log_box.pack(fill=tk.BOTH, expand=True, pady=(4, 0))

        # Color tags for log
        self.log_box.tag_config("success", foreground="#4ade80")
        self.log_box.tag_config("error", foreground="#f87171")
        self.log_box.tag_config("warning", foreground="#fbbf24")
        self.log_box.tag_config("info", foreground="#60a5fa")

    def _section(self, parent, text):
        tk.Label(
            parent, text=text,
            bg="#0d0f1e", fg="#6d7db8",
            font=("Segoe UI", 8, "bold")
        ).pack(anchor=tk.W, pady=(8, 2))

    def _field_row(self, parent, label, key, browse=False, browse_type="file", show_char="", row=0):
        tk.Label(parent, text=label, bg="#131627", fg="#6d7db8",
                 font=("Segoe UI", 8)).grid(row=row, column=0, sticky=tk.W, pady=2, padx=(0, 8))

        var = tk.StringVar(value=self.config_data.get(key, ""))
        entry = tk.Entry(
            parent, textvariable=var,
            bg="#0d0f1e", fg="#c7d0e8",
            insertbackground="#c7d0e8",
            relief=tk.FLAT, font=("Segoe UI", 8),
            show=show_char
        )
        entry.grid(row=row, column=1, sticky=tk.EW, pady=2)
        parent.columnconfigure(1, weight=1)

        setattr(self, f"var_{key}", var)

        if browse:
            tk.Button(
                parent, text="...",
                bg="#1e293b", fg="#94a3b8",
                activebackground="#334155", activeforeground="white",
                font=("Segoe UI", 8), relief=tk.FLAT, padx=4,
                cursor="hand2",
                command=lambda k=key, v=var, t=browse_type: self._browse(k, v, t)
            ).grid(row=row, column=2, padx=(4, 0), pady=2)

    def _spinbox_row(self, parent, label, key, from_, to, row=0):
        tk.Label(parent, text=label, bg="#131627", fg="#6d7db8",
                 font=("Segoe UI", 8)).grid(row=row, column=0, sticky=tk.W, pady=2, padx=(0, 8))
        var = tk.IntVar(value=self.config_data.get(key, 4))
        spinbox = tk.Spinbox(
            parent, textvariable=var, from_=from_, to=to,
            bg="#0d0f1e", fg="#c7d0e8",
            buttonbackground="#1e293b",
            relief=tk.FLAT, font=("Segoe UI", 8), width=6
        )
        spinbox.grid(row=row, column=1, sticky=tk.W, pady=2)
        setattr(self, f"var_{key}", var)

    def _browse(self, key, var, browse_type):
        if browse_type == "file":
            path = filedialog.askopenfilename(
                title="เลือก Service Account JSON",
                filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
            )
        else:
            path = filedialog.askdirectory(title="เลือกโฟลเดอร์")
        if path:
            var.set(path)

    # ── Config Save ──────────────────────────────────────────
    def _collect_config(self):
        cfg = {}
        for key in DEFAULT_CONFIG:
            var = getattr(self, f"var_{key}", None)
            if var:
                cfg[key] = var.get()
        return cfg

    def _save_config(self):
        cfg = self._collect_config()
        save_config(cfg)
        self.log("💾 บันทึกการตั้งค่าแล้ว", "info")

    # ── Log ──────────────────────────────────────────────────
    def log(self, message: str, tag: str = None):
        """Thread-safe log message."""
        self.log_queue.put((message, tag))

    def _poll_log_queue(self):
        try:
            while True:
                msg, tag = self.log_queue.get_nowait()
                self.log_box.config(state=tk.NORMAL)
                # Auto-detect tag from emoji
                if tag is None:
                    if msg.startswith("✅"):
                        tag = "success"
                    elif msg.startswith("❌"):
                        tag = "error"
                    elif msg.startswith("⚠️"):
                        tag = "warning"
                    elif msg.startswith(("🔗", "📁", "📷", "📋", "⚙️", "ℹ️")):
                        tag = "info"
                self.log_box.insert(tk.END, msg + "\n", tag or "")
                self.log_box.see(tk.END)
                self.log_box.config(state=tk.DISABLED)
        except queue.Empty:
            pass
        self.after(100, self._poll_log_queue)

    # ── Pipeline Control ─────────────────────────────────────
    def _start_pipeline(self):
        cfg = self._collect_config()
        self.config_data = cfg
        save_config(cfg)

        # Set env vars
        if cfg.get("database_url"):
            os.environ["DATABASE_URL"] = cfg["database_url"]
        for k in ["r2_account_id", "r2_access_key_id", "r2_secret_access_key",
                  "r2_bucket_name", "r2_public_url"]:
            env_key = k.upper()
            if cfg.get(k):
                os.environ[env_key] = cfg[k]
        if cfg.get("face_api_url"):
            os.environ["FACE_API_URL"] = cfg["face_api_url"]
        if cfg.get("face_api_secret"):
            os.environ["FACE_API_SECRET"] = cfg["face_api_secret"]

        sa_path = cfg.get("service_account_path", "").strip()
        folder_id = cfg.get("folder_id", "").strip()

        if not sa_path or not os.path.exists(sa_path):
            messagebox.showerror("Error", "กรุณาเลือกไฟล์ Service Account JSON ที่ถูกต้อง")
            return
        if not folder_id:
            messagebox.showerror("Error", "กรุณาระบุ Google Drive Folder ID")
            return
        if not os.environ.get("DATABASE_URL"):
            messagebox.showerror("Error", "กรุณาระบุ DATABASE_URL")
            return

        workers = int(cfg.get("workers", 4))

        self.stop_event.clear()
        self.is_running = True
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.progress_var.set(0)
        self.progress_label.config(text="กำลังประมวลผล...")

        self.log("─" * 60)
        self.log(f"🚀 เริ่ม Pipeline | Workers={workers} | Folder={folder_id}", "info")

        self.pipeline_thread = threading.Thread(
            target=self._run_pipeline_thread,
            args=(sa_path, folder_id, workers),
            daemon=True
        )
        self.pipeline_thread.start()

    def _run_pipeline_thread(self, sa_path, folder_id, workers):
        try:
            # Add pipeline directory to path
            pipeline_dir = os.path.dirname(os.path.abspath(__file__))
            if pipeline_dir not in sys.path:
                sys.path.insert(0, pipeline_dir)

            import importlib
            rp = importlib.import_module("run_pipeline")
            importlib.reload(rp)

            result = rp.run_pipeline(
                service_account_path=sa_path,
                folder_id=folder_id,
                workers=workers,
                log_callback=lambda msg: self.log(msg),
                stop_event=self.stop_event
            )

            processed = result.get("processed", 0)
            errors = result.get("errors", 0)
            self.log(f"\n🎉 เสร็จสิ้น! อนุมัติ {processed} รูป | ข้อผิดพลาด {errors} รูป", "success")
            self.after(0, lambda: self.progress_var.set(100))
            self.after(0, lambda: self.progress_label.config(
                text=f"✅ เสร็จสิ้น: {processed} รูปอนุมัติ, {errors} ข้อผิดพลาด"
            ))

        except Exception as e:
            err_msg = str(e)
            self.log(f"❌ เกิดข้อผิดพลาด: {err_msg}", "error")
            self.after(0, lambda msg=err_msg: self.progress_label.config(text=f"❌ Error: {msg}"))
        finally:
            self.is_running = False
            self.after(0, lambda: self.start_btn.config(state=tk.NORMAL))
            self.after(0, lambda: self.stop_btn.config(state=tk.DISABLED))

    def _stop_pipeline(self):
        self.stop_event.set()
        self.log("⏹ ส่งสัญญาณหยุด Pipeline...", "warning")
        self.stop_btn.config(state=tk.DISABLED)


if __name__ == "__main__":
    app = NextSyncApp()
    app.mainloop()
