"""
ThingSpeak Water Quality IoT Data Generator & Desktop Application
==================================================================
Simulates water quality telemetry for 4 channels with tiered alert profiles:
  - Channel 1: Branch 1 - Unit 1  --> NORMAL (Safe / Acceptable Target)
  - Channel 2: Branch 1 - Unit 2  --> NORMAL (Safe / Acceptable Target)
  - Channel 3: Branch 2 - Unit 1  --> WARNING (Tier 2 Alert)
  - Channel 4: Branch 2 - Unit 2  --> DANGER  (Critical Tier 3 Alert)

Features:
  - Bulk Update API (fast: uploads 1000 records in 2 batches of 500 in seconds)
  - Live Continuous Simulation Mode (sends live packets every 15s to keep dashboard 'Online')
  - Tkinter Desktop GUI with visual status cards, progress bar, and real-time logs
  - Headless CLI mode for scripts and automation
  - Persistent channel configuration saved to 'thingspeak_config.json'
"""

import sys
import os
import json
import time
import random
import datetime
import threading
import argparse
import urllib.request
import urllib.error
import urllib.parse

# Default Configuration File
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "thingspeak_config.json")

# Default Channel Profiles according to WHO / Platform Alert Matrix
DEFAULT_CHANNELS = [
    {
        "id": "1",
        "name": "Sensor Unit 1 (Normal)",
        "branch": "Branch_1",
        "unit": "B1_Unit_1",
        "status_tier": "NORMAL",
        "channel_id": "",
        "write_key": "",
        "color": "#16a34a",  # Emerald Green
        "description": "Safe / Acceptable Target (pH: 7.1-7.7, Turbidity: 0.3-0.8 NTU, TDS: 250-450 ppm)",
    },
    {
        "id": "2",
        "name": "Sensor Unit 2 (Normal)",
        "branch": "Branch_1",
        "unit": "B1_Unit_2",
        "status_tier": "NORMAL",
        "channel_id": "",
        "write_key": "",
        "color": "#16a34a",  # Emerald Green
        "description": "Safe / Acceptable Target (pH: 6.9-7.5, Turbidity: 0.4-0.9 NTU, TDS: 280-480 ppm)",
    },
    {
        "id": "3",
        "name": "Sensor Unit 3 (Warning)",
        "branch": "Branch_2",
        "unit": "B2_Unit_1",
        "status_tier": "WARNING",
        "channel_id": "",
        "write_key": "",
        "color": "#d97706",  # Amber / Orange
        "description": "Warning Tier (pH: 5.7-5.9 or 9.1-9.3, Turbidity: 5.5-8.5 NTU, TDS: 1100-1350 ppm)",
    },
    {
        "id": "4",
        "name": "Sensor Unit 4 (Danger)",
        "branch": "Branch_2",
        "unit": "B2_Unit_2",
        "status_tier": "DANGER",
        "channel_id": "",
        "write_key": "",
        "color": "#dc2626",  # Crimson Red
        "description": "Critical Danger Tier (pH: 4.8-5.3 or 9.8-10.4, Turbidity: 12-18 NTU, TDS: 1600-2200 ppm)",
    },
]


def load_config():
    """Load configuration from JSON file or return defaults."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) == 4:
                    return data
        except Exception:
            pass
    return DEFAULT_CHANNELS


def save_config(channels):
    """Save configuration to JSON file."""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(channels, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to save config: {e}")


# ==============================================================================
# DATA GENERATOR ENGINE
# ==============================================================================

def generate_reading(status_tier):
    """
    Generate realistic water quality readings matching WHO / System Thresholds:
      Field 1: pH
      Field 2: Turbidity (NTU)
      Field 3: TDS (ppm)
      Field 4: Temperature (°C) / Hardware Status
    """
    tier = status_tier.upper()

    if tier == "NORMAL":
        # WHO Target: pH 6.5–8.5 | Turbidity < 1.0 NTU | TDS < 600 ppm
        ph = round(random.uniform(7.15, 7.75), 2)
        turbidity = round(random.uniform(0.25, 0.85), 2)
        tds = round(random.uniform(280.0, 480.0), 1)
        temp = round(random.uniform(23.5, 26.5), 1)

    elif tier == "WARNING":
        # WHO Warning Tier: pH < 6.0 or > 9.0 | Turbidity 5–10 NTU | TDS 1000–1500 ppm
        mode = random.choice(["high_tds", "high_turbidity", "acidic_ph", "alkaline_ph"])
        if mode == "high_tds":
            ph = round(random.uniform(7.2, 8.2), 2)
            turbidity = round(random.uniform(2.5, 4.5), 2)
            tds = round(random.uniform(1120.0, 1380.0), 1)
        elif mode == "high_turbidity":
            ph = round(random.uniform(7.0, 7.8), 2)
            turbidity = round(random.uniform(6.0, 8.8), 2)
            tds = round(random.uniform(450.0, 750.0), 1)
        elif mode == "acidic_ph":
            ph = round(random.uniform(5.65, 5.92), 2)
            turbidity = round(random.uniform(1.5, 4.0), 2)
            tds = round(random.uniform(550.0, 950.0), 1)
        else:
            ph = round(random.uniform(9.05, 9.35), 2)
            turbidity = round(random.uniform(1.8, 3.8), 2)
            tds = round(random.uniform(580.0, 890.0), 1)
        temp = round(random.uniform(24.0, 28.5), 1)

    elif tier == "DANGER":
        # WHO Danger Tier: pH < 5.5 or > 9.5 | Turbidity > 10 NTU | TDS > 1500 ppm
        mode = random.choice(["critical_tds", "critical_turbidity", "severe_acid", "severe_alkali"])
        if mode == "critical_tds":
            ph = round(random.uniform(6.2, 8.8), 2)
            turbidity = round(random.uniform(7.5, 12.0), 2)
            tds = round(random.uniform(1650.0, 2250.0), 1)
        elif mode == "critical_turbidity":
            ph = round(random.uniform(6.8, 8.4), 2)
            turbidity = round(random.uniform(12.5, 19.8), 2)
            tds = round(random.uniform(850.0, 1450.0), 1)
        elif mode == "severe_acid":
            ph = round(random.uniform(4.50, 5.35), 2)
            turbidity = round(random.uniform(4.5, 11.5), 2)
            tds = round(random.uniform(900.0, 1600.0), 1)
        else:
            ph = round(random.uniform(9.65, 10.45), 2)
            turbidity = round(random.uniform(5.5, 13.0), 2)
            tds = round(random.uniform(950.0, 1750.0), 1)
        temp = round(random.uniform(25.0, 31.0), 1)

    else:
        ph, turbidity, tds, temp = 7.0, 0.5, 300.0, 25.0

    return {
        "field1": str(ph),
        "field2": str(turbidity),
        "field3": str(tds),
        "field4": str(temp),
    }


def generate_bulk_dataset(status_tier, count=1000, time_span_hours=72):
    """
    Generates `count` historical data points evenly spaced over the last `time_span_hours`.
    Returns a list of dicts suitable for ThingSpeak Bulk Update.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    interval_seconds = max(15, int((time_span_hours * 3600) / count))
    start_time = now - datetime.timedelta(seconds=interval_seconds * count)

    dataset = []
    for i in range(count):
        entry_time = start_time + datetime.timedelta(seconds=interval_seconds * i)
        created_at_str = entry_time.strftime("%Y-%m-%d %H:%M:%S +0000")
        reading = generate_reading(status_tier)
        dataset.append({
            "created_at": created_at_str,
            "field1": reading["field1"],
            "field2": reading["field2"],
            "field3": reading["field3"],
            "field4": reading["field4"],
        })
    return dataset


# ==============================================================================
# THINGSPEAK API CLIENT
# ==============================================================================

def upload_single_feed(write_key, fields):
    """Post a single reading to ThingSpeak."""
    url = "https://api.thingspeak.com/update.json"
    payload = {"api_key": write_key, **fields}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "AquaFlow-Feeder/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode("utf-8")


def upload_bulk_batch(channel_id, write_key, updates):
    """
    Post a batch of updates (max 960 per call) to ThingSpeak Bulk Update API.
    Endpoint: POST https://api.thingspeak.com/channels/{channel_id}/bulk_update.json
    """
    url = f"https://api.thingspeak.com/channels/{channel_id}/bulk_update.json"
    payload = {
        "write_api_key": write_key,
        "updates": updates,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "AquaFlow-Feeder/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.status, res.read().decode("utf-8")


def push_1000_records_to_channel(channel_info, count=1000, log_fn=print, progress_fn=None):
    """
    Upload `count` records to a single channel in 500-record chunks using Bulk Update.
    """
    ch_id = str(channel_info.get("channel_id", "")).strip()
    key = str(channel_info.get("write_key", "")).strip()
    name = channel_info.get("name", "Channel")
    tier = channel_info.get("status_tier", "NORMAL")

    if not ch_id or not key:
        log_fn(f"❌ [SKIP] {name}: Channel ID or Write API Key missing! Enter credentials above.")
        return False

    log_fn("-------------------------------------------------------")
    log_fn(f"🚀 Generating {count} records for {name} [{tier}]...")
    log_fn(f"   Channel #{ch_id} | {channel_info.get('branch')} / {channel_info.get('unit')}")

    all_data = generate_bulk_dataset(tier, count=count, time_span_hours=72)
    chunk_size = 500
    chunks = [all_data[i:i + chunk_size] for i in range(0, len(all_data), chunk_size)]

    total_uploaded = 0
    for idx, chunk in enumerate(chunks, start=1):
        log_fn(f"   📦 Uploading Batch {idx}/{len(chunks)} ({len(chunk)} records) to #{ch_id}...")
        try:
            status, res_body = upload_bulk_batch(ch_id, key, chunk)
            total_uploaded += len(chunk)
            log_fn(f"   ✅ Batch {idx} accepted (HTTP {status})! Uploaded: {total_uploaded}/{count}")
            if progress_fn:
                progress_fn(total_uploaded, count)
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            log_fn(f"   ❌ Batch {idx} Failed (HTTP {e.code}): {err_msg}")
            if e.code == 429:
                log_fn("   ⚠️ Rate limited. Waiting 15s before next attempt...")
                time.sleep(15)
            return False
        except Exception as e:
            log_fn(f"   ❌ Error sending batch: {e}")
            return False

        if idx < len(chunks):
            time.sleep(3)

    log_fn(f"🎉 Successfully populated {total_uploaded} records for {name} (#{ch_id})!")
    return True


# ==============================================================================
# DESKTOP GRAPHICAL USER INTERFACE (TKINTER)
# ==============================================================================

class DesktopApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ThingSpeak Water Quality IoT Data Feeder")
        self.root.geometry("980x760")
        self.root.minsize(860, 640)

        self.bg_color = "#0f172a"
        self.card_bg = "#1e293b"
        self.text_main = "#f8fafc"
        self.text_muted = "#94a3b8"

        self.root.configure(bg=self.bg_color)
        self.channels = load_config()
        self.is_running = False
        self.stop_sim_event = threading.Event()

        self._build_ui()

    def _build_ui(self):
        import tkinter as tk
        from tkinter import ttk, scrolledtext

        header_frame = tk.Frame(self.root, bg=self.bg_color)
        header_frame.pack(fill="x", padx=20, pady=(15, 10))

        tk.Label(
            header_frame,
            text="💧 ThingSpeak IoT Demo Data Generator",
            font=("Segoe UI", 18, "bold"),
            fg=self.text_main,
            bg=self.bg_color,
        ).pack(anchor="w")

        tk.Label(
            header_frame,
            text="Add 1,000 historical records across 4 channels to test Normal, Warning, and Danger alert dashboards.",
            font=("Segoe UI", 10),
            fg=self.text_muted,
            bg=self.bg_color,
        ).pack(anchor="w", pady=(2, 0))

        channels_container = tk.Frame(self.root, bg=self.bg_color)
        channels_container.pack(fill="x", padx=20, pady=5)
        self.channel_entries = []

        for i, ch in enumerate(self.channels):
            card = tk.LabelFrame(
                channels_container,
                text=f"  {ch['name']}  ",
                font=("Segoe UI", 10, "bold"),
                fg=ch["color"],
                bg=self.card_bg,
                bd=1,
                relief="solid",
            )
            card.grid(row=i // 2, column=i % 2, padx=8, pady=6, sticky="nsew")
            channels_container.columnconfigure(i % 2, weight=1)

            tk.Label(
                card,
                text=ch["description"],
                font=("Segoe UI", 8),
                fg=self.text_muted,
                bg=self.card_bg,
                wraplength=420,
                justify="left",
            ).pack(anchor="w", padx=10, pady=(4, 6))

            row1 = tk.Frame(card, bg=self.card_bg)
            row1.pack(fill="x", padx=10, pady=2)
            tk.Label(row1, text="Channel ID:", width=14, anchor="w", fg=self.text_main, bg=self.card_bg, font=("Segoe UI", 9)).pack(side="left")
            id_entry = tk.Entry(row1, font=("Segoe UI", 9), bg="#0f172a", fg="#ffffff", insertbackground="white", bd=1, relief="solid")
            id_entry.insert(0, ch.get("channel_id", ""))
            id_entry.pack(side="left", fill="x", expand=True)

            row2 = tk.Frame(card, bg=self.card_bg)
            row2.pack(fill="x", padx=10, pady=4)
            tk.Label(row2, text="Write API Key:", width=14, anchor="w", fg=self.text_main, bg=self.card_bg, font=("Segoe UI", 9)).pack(side="left")
            key_entry = tk.Entry(row2, font=("Segoe UI", 9), bg="#0f172a", fg="#ffffff", insertbackground="white", bd=1, relief="solid")
            key_entry.insert(0, ch.get("write_key", ""))
            key_entry.pack(side="left", fill="x", expand=True)

            btn_frame = tk.Frame(card, bg=self.card_bg)
            btn_frame.pack(fill="x", padx=10, pady=(2, 8))
            single_btn = tk.Button(
                btn_frame,
                text="Upload 1,000 to this Channel",
                font=("Segoe UI", 8, "bold"),
                bg=ch["color"],
                fg="#ffffff",
                relief="flat",
                cursor="hand2",
                command=lambda idx=i: self.start_single_upload(idx),
            )
            single_btn.pack(side="right")

            self.channel_entries.append({"id": id_entry, "key": key_entry, "btn": single_btn})

        ctrl_frame = tk.Frame(self.root, bg=self.bg_color)
        ctrl_frame.pack(fill="x", padx=20, pady=10)

        tk.Label(ctrl_frame, text="Records / Channel:", font=("Segoe UI", 9, "bold"), fg=self.text_main, bg=self.bg_color).pack(side="left", padx=(0, 6))
        self.record_count_var = tk.StringVar(value="1000")
        count_combo = ttk.Combobox(ctrl_frame, textvariable=self.record_count_var, values=["100", "500", "1000", "2000"], width=6, state="readonly")
        count_combo.pack(side="left", padx=(0, 15))

        self.btn_upload_all = tk.Button(
            ctrl_frame,
            text="⚡ Upload 1,000 Records to ALL 4 Channels",
            font=("Segoe UI", 10, "bold"),
            bg="#2563eb",
            fg="#ffffff",
            padx=16,
            pady=6,
            relief="flat",
            cursor="hand2",
            command=self.start_upload_all,
        )
        self.btn_upload_all.pack(side="left", padx=5)

        self.btn_live_sim = tk.Button(
            ctrl_frame,
            text="🟢 Start Live Simulation (Every 15s)",
            font=("Segoe UI", 9, "bold"),
            bg="#059669",
            fg="#ffffff",
            padx=12,
            pady=6,
            relief="flat",
            cursor="hand2",
            command=self.toggle_live_simulation,
        )
        self.btn_live_sim.pack(side="left", padx=5)

        tk.Button(
            ctrl_frame,
            text="💾 Save Keys",
            font=("Segoe UI", 9),
            bg="#334155",
            fg="#ffffff",
            padx=10,
            pady=6,
            relief="flat",
            cursor="hand2",
            command=self.save_current_entries,
        ) .pack(side="right")

        self.progress_bar = ttk.Progressbar(self.root, mode="determinate")
        self.progress_bar.pack(fill="x", padx=20, pady=(0, 8))

        log_header = tk.Frame(self.root, bg=self.bg_color)
        log_header.pack(fill="x", padx=20)
        tk.Label(log_header, text="Console Output & Progress Logs:", font=("Segoe UI", 9, "bold"), fg=self.text_muted, bg=self.bg_color).pack(side="left")
        tk.Button(
            log_header,
            text="Clear Logs",
            font=("Segoe UI", 8),
            bg=self.bg_color,
            fg=self.text_muted,
            bd=0,
            cursor="hand2",
            command=lambda: self.log_text.delete("1.0", tk.END),
        ).pack(side="right")

        self.log_text = scrolledtext.ScrolledText(
            self.root,
            height=10,
            font=("Consolas", 9),
            bg="#020617",
            fg="#38bdf8",
            insertbackground="white",
            bd=1,
            relief="solid",
        )
        self.log_text.pack(fill="both", expand=True, padx=20, pady=(4, 15))

        self.log("Ready. Enter your 4 ThingSpeak Channel IDs and Write API Keys above.")
        self.log("Click 'Upload 1,000 Records to ALL 4 Channels' to generate full telemetry in seconds!")

    def log(self, message):
        def _append():
            self.log_text.insert(tk.END, message + "\n")
            self.log_text.see(tk.END)
        self.root.after(0, _append)

    def save_current_entries(self):
        for i, ch in enumerate(self.channels):
            ch["channel_id"] = self.channel_entries[i]["id"].get().strip()
            ch["write_key"] = self.channel_entries[i]["key"].get().strip()
        save_config(self.channels)
        self.log("💾 Credentials saved to thingspeak_config.json!")

    def set_controls_state(self, enabled=True):
        state = "normal" if enabled else "disabled"
        self.btn_upload_all.config(state=state)
        for e in self.channel_entries:
            e["btn"].config(state=state)

    def start_upload_all(self):
        self.save_current_entries()
        try:
            count = int(self.record_count_var.get())
        except ValueError:
            count = 1000

        self.set_controls_state(False)
        self.progress_bar["value"] = 0

        def _worker():
            total_channels = len(self.channels)
            for idx, ch in enumerate(self.channels, start=1):
                def _prog(curr, tot):
                    overall = int(((idx - 1) / total_channels * 100) + (curr / tot * (100 / total_channels)))
                    self.root.after(0, lambda v=overall: self.progress_bar.configure(value=v))
                push_1000_records_to_channel(ch, count=count, log_fn=self.log, progress_fn=_prog)

            self.root.after(0, lambda: self.progress_bar.configure(value=100))
            self.log("\n=======================================================")
            self.log("🎉 ALL 4 CHANNELS PROVISIONED SUCCESSFULLY!")
            self.log("Open your AquaFlow Dashboard to verify Normal, Warning, and Danger statuses.")
            self.root.after(0, lambda: self.set_controls_state(True))

        threading.Thread(target=_worker, daemon=True).start()

    def start_single_upload(self, ch_idx):
        self.save_current_entries()
        ch = self.channels[ch_idx]
        try:
            count = int(self.record_count_var.get())
        except ValueError:
            count = 1000

        self.set_controls_state(False)
        self.progress_bar["value"] = 0

        def _worker():
            def _prog(curr, tot):
                percent = int((curr / tot) * 100)
                self.root.after(0, lambda v=percent: self.progress_bar.configure(value=v))
            push_1000_records_to_channel(ch, count=count, log_fn=self.log, progress_fn=_prog)
            self.root.after(0, lambda: self.set_controls_state(True))

        threading.Thread(target=_worker, daemon=True).start()

    def toggle_live_simulation(self):
        if not self.is_running:
            self.save_current_entries()
            if not any(c.get("write_key") for c in self.channels):
                self.log("❌ Enter at least one Write API Key before starting live simulation.")
                return
            self.is_running = True
            self.stop_sim_event.clear()
            self.btn_live_sim.config(text="🔴 Stop Live Simulation", bg="#dc2626")
            self.log("\n🟢 Live continuous simulation started (posting updates every 15s)...")

            def _sim_loop():
                while not self.stop_sim_event.is_set():
                    for ch in self.channels:
                        key = ch.get("write_key")
                        if not key:
                            continue
                        reading = generate_reading(ch["status_tier"])
                        try:
                            upload_single_feed(key, reading)
                            self.log(f"📡 Live sent to {ch['name']}: pH={reading['field1']}, Turb={reading['field2']} NTU, TDS={reading['field3']} ppm")
                        except Exception as e:
                            self.log(f"⚠️ Live post error for {ch['name']}: {e}")
                    self.stop_sim_event.wait(16)

            threading.Thread(target=_sim_loop, daemon=True).start()
        else:
            self.is_running = False
            self.stop_sim_event.set()
            self.btn_live_sim.config(text="🟢 Start Live Simulation (Every 15s)", bg="#059669")
            self.log("🛑 Live continuous simulation stopped.")


def run_cli(args):
    channels = load_config()
    count = args.records
    print(f"ThingSpeak Telemetry Generator (CLI Mode): {count} records/channel")
    for ch in channels:
        if ch.get("channel_id") and ch.get("write_key"):
            push_1000_records_to_channel(ch, count=count)


def main():
    parser = argparse.ArgumentParser(description="ThingSpeak Water Quality IoT Data Generator")
    parser.add_argument("--cli", action="store_true", help="Run in headless CLI mode")
    parser.add_argument("--records", type=int, default=1000, help="Number of records")
    args = parser.parse_args()

    if args.cli:
        run_cli(args)
    else:
        import tkinter as tk
        root = tk.Tk()
        app = DesktopApp(root)
        root.mainloop()


if __name__ == "__main__":
    main()
