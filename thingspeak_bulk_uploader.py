"""
ThingSpeak 1000 Data Generator & Uploader
Author: Water Quality Monitoring System
Usage: Run this script via Python to populate your ThingSpeak channel with 1000 readings.
"""

import json
import random
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

# ==============================================================================
# CONFIGURATION
# You can fill in your Channel ID and Write API Key here,
# or leave them blank ("") and the script will prompt you in the console.
# ==============================================================================
CHANNEL_ID = ""        # e.g., "2854932"
WRITE_API_KEY = ""     # e.g., "AB12CD34EF56GH78"
TOTAL_RECORDS = 1000   # Number of data points to generate
# ==============================================================================


def get_credentials():
    global CHANNEL_ID, WRITE_API_KEY

    channel_id = CHANNEL_ID.strip()
    write_key = WRITE_API_KEY.strip()

    if not channel_id:
        channel_id = input("\nEnter your ThingSpeak Channel ID: ").strip()
    if not write_key:
        write_key = input("Enter your ThingSpeak Write API Key: ").strip()

    if not channel_id or not write_key:
        print("\n[ERROR] Channel ID and Write API Key are required to continue.")
        exit(1)

    return channel_id, write_key


def generate_data_points(count, interval_minutes=5):
    """
    Generates realistic water quality sensor readings distributed back in time.
    Field 1: pH (normal: 6.8 - 8.2, occasional alert: <6.5 or >8.5)
    Field 2: Turbidity in NTU (normal: 0.5 - 3.5, occasional alert: >5.0)
    Field 3: TDS in ppm (normal: 150 - 380, occasional alert: >500)
    Field 4: Temperature in °C (22 - 28 °C)
    """
    now = datetime.now(timezone.utc)
    updates = []

    print(f"\n[1/3] Generating {count} realistic water quality records...")

    # Start from past and walk forward up to now
    start_time = now - timedelta(minutes=interval_minutes * count)

    for i in range(count):
        timestamp = start_time + timedelta(minutes=interval_minutes * i)
        
        # 95% normal readings, 5% warning anomalies for dashboard demonstration
        is_anomaly = random.random() < 0.05

        if is_anomaly:
            ph = round(random.choice([random.uniform(5.8, 6.4), random.uniform(8.6, 9.3)]), 2)
            turbidity = round(random.uniform(5.2, 7.8), 2)
            tds = round(random.uniform(510, 650), 1)
        else:
            ph = round(random.uniform(6.9, 7.8), 2)
            turbidity = round(random.uniform(0.8, 2.9), 2)
            tds = round(random.uniform(160, 340), 1)

        temp = round(random.uniform(22.0, 27.5), 1)

        # Format ISO timestamp compatible with ThingSpeak: YYYY-MM-DD HH:MM:SS +0000
        formatted_time = timestamp.strftime("%Y-%m-%d %H:%M:%S +0000")

        updates.append({
            "created_at": formatted_time,
            "field1": str(ph),
            "field2": str(turbidity),
            "field3": str(tds),
            "field4": str(temp)
        })

    print(f"[OK] Generated {len(updates)} data points.")
    return updates


def upload_batch(channel_id, write_key, batch_updates, batch_number, total_batches):
    """
    Uploads a batch using ThingSpeak Bulk Update API.
    Endpoint: POST https://api.thingspeak.com/channels/{channel_id}/bulk_update.json
    Max allowed entries per batch by ThingSpeak is 960.
    """
    url = f"https://api.thingspeak.com/channels/{channel_id}/bulk_update.json"
    
    payload = {
        "write_api_key": write_key,
        "updates": batch_updates
    }

    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "WaterQualityPlatform/1.0"
        },
        method="POST"
    )

    print(f"Uploading batch {batch_number}/{total_batches} ({len(batch_updates)} records)...")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status_code = resp.getcode()
            response_body = resp.read().decode("utf-8")
            if status_code in (200, 201, 202):
                print(f" -> Batch {batch_number} uploaded successfully! Response: {response_body}")
                return True
            else:
                print(f" -> Batch {batch_number} received unexpected status: {status_code}")
                return False
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8") if e.fp else str(e)
        print(f" -> HTTP Error {e.code}: {err_msg}")
        return False
    except Exception as e:
        print(f" -> Network error: {e}")
        return False


def main():
    print("==========================================================")
    print("   THINGSPEAK BULK DATA UPLOADER (1000 SENSOR READINGS)   ")
    print("==========================================================")
    
    channel_id, write_key = get_credentials()

    print(f"\nTarget Channel ID: {channel_id}")
    print(f"Target Records:    {TOTAL_RECORDS}")
    print("\nSelect upload method:")
    print(" 1) Fast Bulk Upload (Recommended - Uploads all 1000 in ~20 seconds)")
    print(" 2) Live Stream Mode (Uploads 1 reading every 15 seconds continuously)")
    
    choice = input("\nEnter choice [1 or 2] (Default 1): ").strip()
    if choice not in ("1", "2"):
        choice = "1"

    if choice == "1":
        # Generate 1000 records
        all_records = generate_data_points(TOTAL_RECORDS, interval_minutes=10)

        # ThingSpeak allows maximum 960 entries per bulk POST.
        # We split 1000 records into 2 batches: e.g. 500 and 500
        batch_size = 500
        batches = [all_records[i:i + batch_size] for i in range(0, len(all_records), batch_size)]
        total_batches = len(batches)

        print(f"\n[2/3] Uploading in {total_batches} batches to comply with ThingSpeak limits...")

        for idx, batch in enumerate(batches, start=1):
            success = upload_batch(channel_id, write_key, batch, idx, total_batches)
            if not success:
                print("\n[!] Upload encountered an issue. Please verify your Channel ID and Write API Key.")
                break

            # If there's another batch, wait 15 seconds to respect ThingSpeak's rate limiter
            if idx < total_batches:
                print("\nWaiting 16 seconds before next batch (ThingSpeak API cooldown)...")
                for s in range(16, 0, -1):
                    print(f"\rRemaining: {s}s ", end="", flush=True)
                    time.sleep(1)
                print()

        print("\n[3/3] Done! Check your ThingSpeak channel and your Water Quality dashboard.")

    else:
        print(f"\nStarting live stream mode (Ctrl+C to stop)...")
        print("Sending 1 reading every 15 seconds...")
        count = 0
        while count < TOTAL_RECORDS:
            count += 1
            ph = round(random.uniform(7.1, 7.6), 2)
            turbidity = round(random.uniform(1.0, 2.2), 2)
            tds = round(random.uniform(180, 260), 1)
            temp = round(random.uniform(23.0, 26.0), 1)

            url = f"https://api.thingspeak.com/update?api_key={write_key}&field1={ph}&field2={turbidity}&field3={tds}&field4={temp}"
            try:
                with urllib.request.urlopen(url, timeout=10) as resp:
                    entry_id = resp.read().decode("utf-8")
                    print(f"[{count}/{TOTAL_RECORDS}] Entry #{entry_id} -> pH: {ph}, Turbidity: {turbidity} NTU, TDS: {tds} ppm")
            except Exception as e:
                print(f"[{count}] Error sending data: {e}")

            time.sleep(15)

    print("\nAll operations finished.")
    input("\nPress Enter to exit...")


if __name__ == "__main__":
    main()
