#!/usr/bin/env python3
"""
SAS_reader_v2.py

Program z GUI do pobierania danych bieżącego zawodnika z URL i zapisywania ich do JSON co 0.5 s.
Czyta tylko currentRun i currentRunResult. W oknie pokazuje krótkie podsumowanie
oraz pełen podgląd JSON. W logu wypisuje zmiany na bieżąco.

Jak uruchomić:
  python3 SAS_reader_v2.py

Wymagania:
  pip3 install requests
"""

import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Callable

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

try:
    import requests
except Exception:
    requests = None

POLL_INTERVAL_SEC = 0.5

# --------- konwersje ---------

def _to_int(val: Any) -> Optional[int]:
    try:
        if val is None:
            return None
        return int(float(val))
    except Exception:
        return None

def _to_bool(val: Any) -> Optional[bool]:
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    if s in {"1","true","yes","tak"}:
        return True
    if s in {"0","false","no","nie"}:
        return False
    return None

# --------- wydobywanie danych ---------

def extract_payload(raw_json: Any) -> Dict[str, Any]:
    """Czytaj tylko bieżącego zawodnika.
    Jeśli currentRunResult.running == 1 to bierzemy z currentRunResult, inaczej z currentRun.
    """
    payload = {
        "handler": None,
        "dog_name": None,
        "breed": None,
        "dorsal": None,
        "errors": None,
        "refusals": None,
        "disqualified": None,
        "country": None,
        "source_checked_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        current_run = raw_json.get("currentRun", {}) or {}
        current_res = raw_json.get("currentRunResult", {}) or {}

        running_flag = str(current_res.get("running", "0")).strip() in {"1", "true", "True"}

        if running_flag:
            payload["handler"] = current_res.get("handler")
            payload["dog_name"] = current_res.get("dog_call_name") or current_res.get("dog")
            payload["breed"] = current_res.get("dog_breed")
            payload["dorsal"] = current_res.get("dorsal")
            payload["country"] = current_res.get("country")
            payload["errors"] = _to_int(current_res.get("faults") or current_res.get("course_faults"))
            payload["refusals"] = _to_int(current_res.get("refusals"))
            payload["disqualified"] = _to_bool(current_res.get("is_eliminated"))
        else:
            payload["handler"] = current_run.get("handler")
            payload["dog_name"] = current_run.get("dog")
            payload["breed"] = current_run.get("breed")
            payload["dorsal"] = current_run.get("dorsal")
            payload["country"] = current_run.get("country_name")
            payload["errors"] = None
            payload["refusals"] = None
            payload["disqualified"] = None
    except Exception as e:
        payload["error"] = f"Parsing error: {e}"

    return payload

# --------- pętla pobierająca ---------

class Poller(threading.Thread):
    def __init__(self,
                 url_getter: Callable[[], str],
                 path_getter: Callable[[], str],
                 status_cb: Callable[[str], None],
                 log_cb: Callable[[str], None],
                 data_cb: Callable[[Dict[str, Any]], None]):
        super().__init__(daemon=True)
        self.url_getter = url_getter
        self.path_getter = path_getter
        self.status_cb = status_cb
        self.log_cb = log_cb
        self.data_cb = data_cb
        self._stop = threading.Event()
        self._last_written: Optional[str] = None

    def stop(self):
        self._stop.set()

    def run(self):
        if requests is None:
            self.status_cb("Brak biblioteki requests. Zainstaluj: pip3 install requests")
            return
        self.status_cb("Startuję pętlę...")
        while not self._stop.is_set():
            url = self.url_getter().strip()
            path = Path(self.path_getter().strip())
            if not url:
                self.status_cb("Podaj URL i kliknij Start")
                time.sleep(POLL_INTERVAL_SEC)
                continue
            try:
                resp = requests.get(
                    url,
                    timeout=5,
                    headers={
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache",
                        "Accept": "application/json",
                        "User-Agent": "SAS_reader/1.0"
                    }
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                self.status_cb(f"Błąd pobierania: {e}")
                time.sleep(POLL_INTERVAL_SEC)
                continue

            payload = extract_payload(data)

            # aktualizuj GUI
            try:
                self.data_cb(payload)
            except Exception:
                pass

            # krótki wpis do logu
            try:
                h = payload.get("handler") or ""
                d = payload.get("dog_name") or ""
                dr = payload.get("dorsal") or ""
                er = payload.get("errors")
                rf = payload.get("refusals")
                dq = payload.get("disqualified")
                self.log_cb(f"{h} | {d} | dorsal {dr} | błędy {er if er is not None else '-'} | odmowy {rf if rf is not None else '-'} | elim {dq if dq is not None else '-'}")
            except Exception:
                pass

            # zapis JSON
            text = json.dumps(payload, ensure_ascii=False, indent=2)
            try:
                if path.is_dir():
                    self.status_cb("Wybrana ścieżka jest katalogiem. Wskaż plik JSON.")
                else:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    with path.open("w", encoding="utf-8") as f:
                        f.write(text)
                    self._last_written = text
                    self.status_cb(f"Zapisano {path} o {datetime.now().strftime('%H:%M:%S')}")
            except Exception as e:
                self.status_cb(f"Błąd zapisu: {e}")

            time.sleep(POLL_INTERVAL_SEC)
        self.status_cb("Zatrzymano.")

# --------- GUI ---------

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("SAS Reader JSON")
        self.geometry("900x520")

        pad = {"padx": 8, "pady": 6}

        self.url_var = tk.StringVar()
        self.path_var = tk.StringVar()
        self.status_var = tk.StringVar(value="Gotowe")

        # pola do podsumowania
        self.fields: Dict[str, tk.StringVar] = {
            "handler": tk.StringVar(value=""),
            "dog_name": tk.StringVar(value=""),
            "breed": tk.StringVar(value=""),
            "dorsal": tk.StringVar(value=""),
            "country": tk.StringVar(value=""),
            "errors": tk.StringVar(value=""),
            "refusals": tk.StringVar(value=""),
            "disqualified": tk.StringVar(value=""),
        }

        frm = ttk.Frame(self)
        frm.pack(fill=tk.BOTH, expand=True)

        # URL
        ttk.Label(frm, text="URL do API").grid(row=0, column=0, sticky="w", **pad)
        url_entry = ttk.Entry(frm, textvariable=self.url_var)
        url_entry.grid(row=0, column=1, columnspan=3, sticky="ew", **pad)

        # Plik wyjściowy
        ttk.Label(frm, text="Plik JSON").grid(row=1, column=0, sticky="w", **pad)
        path_entry = ttk.Entry(frm, textvariable=self.path_var)
        path_entry.grid(row=1, column=1, columnspan=2, sticky="ew", **pad)
        ttk.Button(frm, text="Wybierz", command=self.choose_file).grid(row=1, column=3, sticky="ew", **pad)

        # Podsumowanie bieżącego zawodnika
        box = ttk.LabelFrame(frm, text="Bieżący zawodnik")
        box.grid(row=2, column=0, columnspan=4, sticky="nsew", **pad)
        labels = [
            ("Handler", "handler"), ("Pies", "dog_name"), ("Rasa", "breed"), ("Dorsal", "dorsal"),
            ("Kraj", "country"), ("Błędy", "errors"), ("Odmowy", "refusals"), ("Elim", "disqualified"),
        ]
        for i, (title, key) in enumerate(labels):
            ttk.Label(box, text=title).grid(row=i//4*2, column=(i%4)*2, sticky="w", padx=6, pady=4)
            ttk.Label(box, textvariable=self.fields[key]).grid(row=i//4*2, column=(i%4)*2+1, sticky="w", padx=6, pady=4)

        # przyciski
        self.start_btn = ttk.Button(frm, text="Start", command=self.start)
        self.start_btn.grid(row=3, column=1, sticky="ew", **pad)
        self.stop_btn = ttk.Button(frm, text="Stop", command=self.stop, state=tk.DISABLED)
        self.stop_btn.grid(row=3, column=2, sticky="ew", **pad)

        # status
        ttk.Label(frm, text="Status").grid(row=4, column=0, sticky="nw", **pad)
        self.status_lbl = ttk.Label(frm, textvariable=self.status_var)
        self.status_lbl.grid(row=4, column=1, columnspan=3, sticky="w", **pad)

        # log
        ttk.Label(frm, text="Log").grid(row=5, column=0, sticky="nw", **pad)
        self.log_txt = tk.Text(frm, height=8)
        self.log_txt.grid(row=5, column=1, columnspan=3, sticky="nsew", **pad)

        # podgląd JSON
        ttk.Label(frm, text="Podgląd JSON").grid(row=6, column=0, sticky="nw", **pad)
        self.json_txt = tk.Text(frm, height=10)
        self.json_txt.grid(row=6, column=1, columnspan=3, sticky="nsew", **pad)

        # layout
        frm.columnconfigure(1, weight=1)
        frm.columnconfigure(2, weight=0)
        frm.columnconfigure(3, weight=0)
        frm.rowconfigure(5, weight=1)
        frm.rowconfigure(6, weight=2)

        # podpowiedź
        self.url_var.set("https://www.smarteragilitysecretary.com/api/ring-jumbotron?key=38-1&token=b9d6ea8054ab28ebf82d6b38dfaae74479764c91852dac2250b63b08bb659d54")
        self.path_var.set(str(Path.home() / "jumbotron_current.json"))

        self._poller: Optional[Poller] = None

    def choose_file(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("Wszystkie pliki", "*.*")],
            initialfile="jumbotron_current.json",
            title="Wybierz plik do zapisu"
        )
        if path:
            self.path_var.set(path)

    def set_status(self, text: str):
        self.status_var.set(text)
        self.update_idletasks()

    def log(self, text: str):
        if not text:
            return
        self.log_txt.insert(tk.END, f"{datetime.now().strftime('%H:%M:%S')} | {text}\n")
        self.log_txt.see(tk.END)

    def update_view(self, payload: Dict[str, Any]):
        # uzupełnij pola podsumowania
        for k in self.fields:
            val = payload.get(k)
            self.fields[k].set("" if val is None else str(val))
        # uzupełnij podgląd JSON
        try:
            text = json.dumps(payload, ensure_ascii=False, indent=2)
        except Exception:
            text = str(payload)
        self.json_txt.delete("1.0", tk.END)
        self.json_txt.insert("1.0", text)

    def start(self):
        if self._poller and self._poller.is_alive():
            return
        if not self.url_var.get().strip():
            messagebox.showinfo("Uwaga", "Podaj URL")
            return
        if not self.path_var.get().strip():
            messagebox.showinfo("Uwaga", "Wskaż plik do zapisu")
            return
        self._poller = Poller(
            url_getter=lambda: self.url_var.get(),
            path_getter=lambda: self.path_var.get(),
            status_cb=self.set_status,
            log_cb=self.log,
            data_cb=self.update_view,
        )
        self._poller.start()
        self.start_btn.configure(state=tk.DISABLED)
        self.stop_btn.configure(state=tk.NORMAL)

    def stop(self):
        if self._poller:
            self._poller.stop()
            self._poller = None
        self.start_btn.configure(state=tk.NORMAL)
        self.stop_btn.configure(state=tk.DISABLED)


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()

