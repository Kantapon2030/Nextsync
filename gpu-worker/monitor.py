import tkinter as tk
from tkinter import ttk

from config import Config
from db import QueueDB


class Monitor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ShotSync GPU Worker Monitor")
        self.geometry("560x240")
        config = Config()
        self.worker_id = config.worker_id
        self.db = QueueDB(config.database_url, config.worker_id, config.lease_seconds)
        self.status = ttk.Label(self, text="Loading...", font=("Segoe UI", 13))
        self.status.pack(pady=24)
        for label, value in (("Pause", "paused"), ("Resume", "online"), ("Drain", "draining")):
            ttk.Button(self, text=label, command=lambda state=value: self.set_state(state)).pack(side=tk.LEFT, padx=16)
        self.after(1000, self.refresh)

    def set_state(self, state):
        with self.db.connect() as conn:
            conn.execute("UPDATE worker_heartbeats SET status=%s WHERE worker_id=%s", (state, self.worker_id))

    def refresh(self):
        with self.db.connect() as conn:
            row = conn.execute("SELECT status, processed_total, failed_total, last_seen_at FROM worker_heartbeats WHERE worker_id=%s", (self.worker_id,)).fetchone()
        self.status.configure(text=str(row) if row else "Worker has not started")
        self.after(3000, self.refresh)


if __name__ == "__main__":
    Monitor().mainloop()
