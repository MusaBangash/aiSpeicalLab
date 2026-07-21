"""
STLab agent -- heartbeat + activity telemetry + on-demand screen viewing.

Threading model: Tkinter's mainloop must run on the main thread (not
guaranteed thread-safe otherwise), so it owns main(). The heartbeat loop
(unchanged cadence/meaning -- still 60s by default) and the new
screen-view poll loop (~2s) run as background daemon threads,
communicating with the Tkinter thread purely through `overlay_visible`, a
threading.Event -- no widget is ever touched from a non-Tk thread.
"""
import json
import os
import sys
import threading
import time

import requests

import activity
import lockdown
import overlay
import screen

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


def load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def send_heartbeat(config: dict, telemetry: dict):
    payload = {
        "hostname": config["hostname"],
        "studentEmail": telemetry["studentEmail"],
        "focusedApp": telemetry["focusedApp"],
        "windowTitle": telemetry["windowTitle"],
        "idleSeconds": telemetry["idleSeconds"],
    }
    try:
        resp = requests.post(
            f"{config['server_url']}/api/agent/heartbeat",
            json=payload,
            headers={"x-agent-key": config["api_key"]},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"[agent] heartbeat failed: {e}", file=sys.stderr)
        return None


def apply_lockdown(resp) -> None:
    try:
        if resp and resp.get("exam_lockdown"):
            lockdown.enter(resp["exam_url"])
        else:
            lockdown.exit()
    except NotImplementedError:
        pass  # lockdown.py is still a scaffold by design -- separate phase, not fatal
    except Exception as e:
        print(f"[agent] lockdown call failed: {e}", file=sys.stderr)


def heartbeat_loop(config: dict, stop_event: threading.Event) -> None:
    interval = config.get("heartbeat_seconds", 60)
    while not stop_event.is_set():
        try:
            telemetry = activity.collect()
            if telemetry is None:
                print("[agent] no student logged in -- skipping this tick")
            else:
                resp = send_heartbeat(config, telemetry)
                apply_lockdown(resp)
        except Exception as e:
            # Never let one bad tick kill an unattended lab-PC process.
            print(f"[agent] heartbeat tick failed: {e}", file=sys.stderr)
        stop_event.wait(interval)


def poll_screen_view_status(config: dict):
    try:
        resp = requests.get(
            f"{config['server_url']}/api/agent/screen-view/status",
            params={"hostname": config["hostname"]},
            headers={"x-agent-key": config["api_key"]},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"[agent] screen-view status poll failed: {e}", file=sys.stderr)
        return None


def upload_frame(config: dict, session_id: str, jpeg_bytes: bytes) -> None:
    try:
        resp = requests.post(
            f"{config['server_url']}/api/agent/screen-view/frame",
            data=jpeg_bytes,
            headers={
                "x-agent-key": config["api_key"],
                "x-session-id": session_id,
                "x-hostname": config["hostname"],
                "Content-Type": "image/jpeg",
            },
            timeout=5,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[agent] frame upload failed: {e}", file=sys.stderr)


def screen_view_loop(config: dict, overlay_visible: threading.Event, stop_event: threading.Event) -> None:
    interval = config.get("screen_view_poll_seconds", 2)
    while not stop_event.is_set():
        try:
            status = poll_screen_view_status(config)
            if status and status.get("active"):
                overlay_visible.set()
                # Never capture when nobody's logged in (lock screen) --
                # mirrors the heartbeat loop's own existing gate.
                if activity.collect() is not None:
                    upload_frame(config, status["sessionId"], screen.capture_jpeg())
            else:
                overlay_visible.clear()
        except Exception as e:
            print(f"[agent] screen-view tick failed: {e}", file=sys.stderr)
        stop_event.wait(interval)
    overlay_visible.clear()


def main() -> None:
    config = load_config()
    print(f"STLab agent starting -- hostname={config['hostname']}, server={config['server_url']}")

    stop_event = threading.Event()
    overlay_visible = threading.Event()

    threading.Thread(target=heartbeat_loop, args=(config, stop_event), daemon=True).start()
    threading.Thread(target=screen_view_loop, args=(config, overlay_visible, stop_event), daemon=True).start()

    try:
        overlay.run(overlay_visible)  # blocks -- Tkinter mainloop, main thread only
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()


if __name__ == "__main__":
    main()
