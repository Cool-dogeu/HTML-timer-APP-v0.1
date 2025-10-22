#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CWgaz — GUI to drive GAZ for CW countdowns
"""

import tkinter as tk
from tkinter import ttk, messagebox

try:
    import serial
    import serial.tools.list_ports
except Exception:
    serial = None

HEADER = "  0   .     "
CLEAR_ASCII = "  0   .         .   00"

def build_content_running(n_idx: int, total_seconds: int) -> str:
    m = total_seconds // 60
    s = total_seconds % 60
    return f"{n_idx}  {m}.{s:02d} 00"

def build_content_break(n_idx: int) -> str:
    return f"{n_idx}  - - - 00"

class Sender:
    def __init__(self, port: str, baud: int = 2400):
        self.port = port
        self.baud = baud
        self.ser = None
        if serial is not None and port and port != "no ports":
            try:
                self.ser = serial.Serial(port, baud, timeout=1)
            except Exception as e:
                print(f"[WARN] cannot open port {port}: {e}")
        else:
            print("[WARN] pyserial unavailable or no port, running in local mode.")

    def send_ascii_cr(self, text: str):
        data = (text + "\r").encode("ascii")
        if self.ser:
            try:
                self.ser.write(data)
            except Exception as e:
                print(f"[ERR] serial write failed: {e}")
        else:
            print(f"[LOCAL SEND] {text!r} + CR")

    def close(self):
        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CWgaz — GAZ CW controller")
        self.geometry("520x440")

        # styles for highlighting
        self.style = ttk.Style(self)
        try:
            self.style.theme_use(self.style.theme_use())
        except Exception:
            pass
        self.style.configure("CW.TButton")
        self.style.configure("CWSelected.TButton", font=("TkDefaultFont", 10, "bold"))
        self.style.map("CWSelected.TButton",
                       relief=[("active", "sunken"), ("!active", "raised")])

        self.var_port = tk.StringVar()
        self.sender = None

        root = ttk.Frame(self, padding=10)
        root.pack(fill="both", expand=True)

        # Connection
        conn = ttk.LabelFrame(root, text="Connection")
        conn.pack(fill="x", pady=6)
        ttk.Label(conn, text="Port").pack(side="left", padx=5)
        self.combo_ports = ttk.Combobox(conn, textvariable=self.var_port, width=26, state="readonly")
        self.combo_ports.pack(side="left", padx=5)
        ttk.Button(conn, text="Refresh", command=self.refresh_ports).pack(side="left", padx=5)
        ttk.Button(conn, text="Connect (2400 8N1)", command=self.connect).pack(side="left", padx=5)

        # Settings
        settings = ttk.LabelFrame(root, text="Settings")
        settings.pack(fill="x", pady=6)

        # Break settings
        brf = ttk.Frame(settings)
        brf.pack(side="left", padx=10, pady=6)
        ttk.Label(brf, text="Break length").pack(anchor="w")

        self.var_break_mode = tk.StringVar(value="preset20")
        br_custom = ttk.Frame(brf)
        br_custom.pack(anchor="w", pady=4)
        ttk.Radiobutton(br_custom, text="Custom", variable=self.var_break_mode, value="custom",
                        command=self._on_break_mode).pack(side="left")
        self.var_break_custom = tk.StringVar()
        self.ent_break_custom = ttk.Entry(br_custom, textvariable=self.var_break_custom,
                                          width=4, justify="center", state="disabled")
        self.ent_break_custom.pack(side="left", padx=4)
        ttk.Label(br_custom, text="s (10–60)").pack(side="left")

        for sec in (10, 20, 30):
            ttk.Radiobutton(brf, text=f"{sec} s", variable=self.var_break_mode,
                            value=f"preset{sec}", command=self._on_break_mode).pack(anchor="w")

        # CW settings
        cwf = ttk.Frame(settings)
        cwf.pack(side="left", padx=20, pady=6)
        ttk.Label(cwf, text="CW length").pack(anchor="w")

        self.var_cw_mode = tk.StringVar(value="preset8")
        cw_custom_row = ttk.Frame(cwf)
        cw_custom_row.pack(anchor="w")
        ttk.Radiobutton(cw_custom_row, text="Custom", variable=self.var_cw_mode, value="custom",
                        command=self._on_cw_mode).pack(side="left")
        self.var_custom = tk.StringVar()
        self.ent_custom = ttk.Entry(cw_custom_row, textvariable=self.var_custom,
                                    width=3, justify="center", state="disabled")
        self.ent_custom.pack(side="left", padx=4)
        ttk.Label(cw_custom_row, text="min (1–6)").pack(side="left")

        for m in (7, 8, 9):
            ttk.Radiobutton(cwf, text=f"{m} min", variable=self.var_cw_mode,
                            value=f"preset{m}", command=self._on_cw_mode).pack(anchor="w")

        # Controls
        ctr = ttk.LabelFrame(root, text="Control")
        ctr.pack(fill="x", pady=6)
        self.btn_cw1 = ttk.Button(ctr, text="CW1", style="CW.TButton", command=lambda: self.start_sequence(1))
        self.btn_cw1.pack(side="left", padx=6, pady=6)
        self.btn_cw2 = ttk.Button(ctr, text="CW2", style="CW.TButton", command=lambda: self.start_sequence(2))
        self.btn_cw2.pack(side="left", padx=6, pady=6)
        self.btn_cw3 = ttk.Button(ctr, text="CW3", style="CW.TButton", command=lambda: self.start_sequence(3))
        self.btn_cw3.pack(side="left", padx=6, pady=6)
        self.btn_cw4 = ttk.Button(ctr, text="CW4", style="CW.TButton", command=lambda: self.start_sequence(4))
        self.btn_cw4.pack(side="left", padx=6, pady=6)
        self.btn_stop = ttk.Button(ctr, text="Stop", command=self.stop_sequence)
        self.btn_stop.pack(side="left", padx=12, pady=6)

        # Preview
        prev = ttk.LabelFrame(root, text="Preview")
        prev.pack(fill="x", pady=6)
        self.lbl_ascii = ttk.Label(prev, text="ASCII:")
        self.lbl_ascii.pack(anchor="w", padx=6, pady=2)
        self.lbl_hex = ttk.Label(prev, text="HEX:")
        self.lbl_hex.pack(anchor="w", padx=6, pady=2)

        self.lbl_status = ttk.Label(root, text="")
        self.lbl_status.pack(pady=6)

        self._job = None
        self._plan = []
        self._active_cw = 0  # which CW is active

        self.refresh_ports()
        self._update_conn_border(False)
        self._set_cw_styles(0)

    def _update_conn_border(self, connected: bool):
        # green border when connected, grey when not
        try:
            color = "green" if connected else "#cccccc"
            self.configure(highlightthickness=4, highlightbackground=color, highlightcolor=color)
        except Exception:
            pass

    def _set_cw_styles(self, active: int):
        # highlight selected/active CW button
        self._active_cw = active
        for i, btn in enumerate([self.btn_cw1, self.btn_cw2, self.btn_cw3, self.btn_cw4], start=1):
            btn.configure(style="CWSelected.TButton" if i == active else "CW.TButton")

    def _on_break_mode(self):
        if self.var_break_mode.get() == "custom":
            self.ent_break_custom.config(state="normal")
        else:
            self.ent_break_custom.config(state="disabled")
            self.var_break_custom.set("")

    def _on_cw_mode(self):
        if self.var_cw_mode.get() == "custom":
            self.ent_custom.config(state="normal")
        else:
            self.ent_custom.config(state="disabled")
            self.var_custom.set("")

    def refresh_ports(self):
        ports = []
        if serial is not None:
            ports = [p.device for p in serial.tools.list_ports.comports()]
        if not ports:
            ports = ["no ports"]
        self.combo_ports["values"] = ports
        self.var_port.set(ports[0])

    def connect(self):
        port = self.var_port.get().strip()
        if port == "no ports":
            messagebox.showwarning("Error", "No serial devices found")
            return
        if self.sender:
            self.sender.close()
        self.sender = Sender(port, 2400)
        if not self.sender.ser:
            self.sender = None
            messagebox.showerror("Error", f"Cannot open port: {port}")
            self._update_conn_border(False)
            return
        self._update_conn_border(True)
        self.lbl_status.config(text=f"Connected to {port}")

    def send_frame(self, content: str):
        frame = HEADER + content
        ascii_vis = frame.replace(" ", "␣") + "\r"
        hex_vis = " ".join(f"{b:02X}" for b in (frame + "\r").encode("ascii"))
        self.lbl_ascii.config(text=f"ASCII: {ascii_vis}")
        self.lbl_hex.config(text=f"HEX:   {hex_vis}")
        if not self.sender or not getattr(self.sender, "ser", None):
            return
        self.sender.send_ascii_cr(frame)

    def clear_display(self):
        self.send_frame(CLEAR_ASCII)

    def start_sequence(self, upto: int):
        if not self.sender or not getattr(self.sender, "ser", None):
            messagebox.showwarning("Error", "Not connected to a device")
            return
        if upto not in (1, 2, 3, 4):
            return
        self.stop_sequence()

        if self.var_cw_mode.get() == "custom":
            try:
                m = int(self.var_custom.get())
            except Exception:
                m = 8
            if m < 1 or m > 6:
                m = 8
        else:
            m = int(self.var_cw_mode.get().replace("preset", ""))

        if self.var_break_mode.get() == "custom":
            try:
                break_len = int(self.var_break_custom.get())
            except Exception:
                break_len = 20
            if break_len < 10 or break_len > 60:
                break_len = 20
        else:
            break_len = int(self.var_break_mode.get().replace("preset", ""))

        self._plan.clear()
        for n in range(1, upto+1):
            self._plan.append(("run", n, m*60))
            if n != upto:
                self._plan.append(("break", n, break_len))

        self._set_cw_styles(upto)
        self.lbl_status.config(text=f"Started CW{upto}: {m} min, breaks {break_len}s")
        self._execute_next_step()

    def stop_sequence(self):
        if self._job:
            self.after_cancel(self._job)
            self._job = None
        self._plan.clear()
        self._set_cw_styles(0)
        self.lbl_status.config(text="Stopped")
        # only 0.00 after 1s
        self._job = self.after(1000, self._send_final_zero)

    def _send_final_zero(self):
        try:
            self.send_frame("   0.00 00")
        except Exception as e:
            print(f"[ERR] final 0.00 send failed: {e}")

    def _execute_next_step(self):
        if not self._plan:
            # only 0.00 after 3s
            self._job = self.after(3000, self._send_final_zero)
            self._set_cw_styles(0)
            return
        step_type, n_idx, seconds = self._plan.pop(0)
        if step_type == "run":
            self._set_cw_styles(n_idx)  # highlight the CW currently running
            self._tick_run(n_idx, seconds)
        else:
            self._tick_break(n_idx, seconds)

    def _tick_run(self, n_idx: int, seconds_left: int):
        content = build_content_running(n_idx, seconds_left)
        self.send_frame(content)
        if seconds_left <= 0:
            self._job = self.after(1000, self._execute_next_step)
            return
        self._job = self.after(1000, lambda: self._tick_run(n_idx, seconds_left-1))

    def _tick_break(self, n_idx: int, seconds_left: int):
        content = build_content_break(n_idx)
        self.send_frame(content)
        if seconds_left <= 0:
            self._job = self.after(1000, self._execute_next_step)
            return
        self._job = self.after(1000, lambda: self._tick_break(n_idx, seconds_left-1))

    def on_close(self):
        self.stop_sequence()
        if self.sender:
            self.sender.close()
        self._update_conn_border(False)
        self.destroy()

def main():
    app = App()
    app.protocol("WM_DELETE_WINDOW", app.on_close)
    app.mainloop()

if __name__ == "__main__":
    main()
