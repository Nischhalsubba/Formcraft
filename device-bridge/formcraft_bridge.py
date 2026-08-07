#!/usr/bin/env python3
"""Formcraft LAN bridge for ZKTeco attendance readers.

This process is intentionally independent from the Netlify-hosted frontend.
It uses a workspace-scoped bridge token plus the public Supabase publishable key.
No Supabase service-role credential is required or supported here.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import platform
import signal
import socket
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from zk import ZK

VERSION = "1.0.0"
NPT = ZoneInfo("Asia/Kathmandu")
PUNCH_LABELS = {
    0: "Check in",
    1: "Check out",
    2: "Break out",
    3: "Break in",
    4: "Overtime in",
    5: "Overtime out",
}


def iso_utc(value: datetime | None = None) -> str:
    dt = value or datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=NPT)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def json_default(value: Any):
    if isinstance(value, datetime):
        return iso_utc(value)
    raise TypeError(f"Cannot serialize {type(value).__name__}")


class RPCError(RuntimeError):
    pass


class SupabaseRPC:
    def __init__(self, base_url: str, publishable_key: str, bridge_id: str, bridge_token: str, timeout: int = 35):
        self.base_url = base_url.rstrip("/")
        self.publishable_key = publishable_key
        self.bridge_id = bridge_id
        self.bridge_token = bridge_token
        self.timeout = timeout

    def call(self, name: str, payload: dict[str, Any] | None = None) -> Any:
        body = dict(payload or {})
        body.setdefault("target_bridge", self.bridge_id)
        body.setdefault("bridge_token", self.bridge_token)
        request = urllib.request.Request(
            f"{self.base_url}/rest/v1/rpc/{name}",
            data=json.dumps(body, default=json_default).encode("utf-8"),
            method="POST",
            headers={
                "apikey": self.publishable_key,
                "Authorization": f"Bearer {self.publishable_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                detail = json.loads(raw)
                message = detail.get("message") or detail.get("hint") or raw
            except Exception:
                message = raw
            raise RPCError(f"{name}: HTTP {exc.code}: {message}") from exc
        except urllib.error.URLError as exc:
            raise RPCError(f"{name}: {exc.reason}") from exc


class LocalStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.backup_dir = self.root / "backups"
        self.backup_dir.mkdir(exist_ok=True)
        self.path = self.root / "bridge-state.json"
        self._lock = threading.RLock()
        self.data = self._load()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"device_secrets": {}, "schedule_times": [], "last_schedule_runs": {}, "last_device_state": {}, "auto_attend_rules": [], "last_auto_attend_runs": {}}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            logging.getLogger("formcraft.bridge").exception("Could not read local bridge state; starting with an empty local state")
            return {"device_secrets": {}, "schedule_times": [], "last_schedule_runs": {}, "last_device_state": {}, "auto_attend_rules": [], "last_auto_attend_runs": {}}

    def save(self) -> None:
        with self._lock:
            temp = self.path.with_suffix(".tmp")
            temp.write_text(json.dumps(self.data, indent=2, sort_keys=True), encoding="utf-8")
            try:
                os.chmod(temp, 0o600)
            except OSError:
                pass
            temp.replace(self.path)
            try:
                os.chmod(self.path, 0o600)
            except OSError:
                pass

    def secret(self, device_id: str) -> str:
        return str(self.data.setdefault("device_secrets", {}).get(device_id, ""))

    def set_secret(self, device_id: str, secret: str) -> None:
        with self._lock:
            self.data.setdefault("device_secrets", {})[device_id] = str(secret or "")
            self.save()

    def schedule(self) -> list[str]:
        return sorted({str(item) for item in self.data.setdefault("schedule_times", []) if item})

    def set_schedule(self, times: list[str]) -> None:
        clean = []
        for value in times:
            text = str(value).strip()
            if len(text) == 5 and text[2] == ":" and text[:2].isdigit() and text[3:].isdigit():
                hour, minute = map(int, text.split(":"))
                if 0 <= hour <= 23 and 0 <= minute <= 59:
                    clean.append(text)
        with self._lock:
            self.data["schedule_times"] = sorted(set(clean))
            self.save()

    def auto_attend_rules(self) -> list[dict[str, Any]]:
        return [dict(item) for item in self.data.setdefault("auto_attend_rules", []) if isinstance(item, dict)]

    def set_auto_attend_rules(self, rules: list[dict[str, Any]]) -> None:
        clean = []
        for item in rules:
            if not isinstance(item, dict):
                continue
            user_id = str(item.get("userId") or "").strip()
            device_ids = [str(value) for value in (item.get("deviceIds") or []) if str(value)]
            if not user_id or not device_ids:
                continue
            clean.append({
                "id": str(item.get("id") or f"auto-{user_id}"),
                "active": bool(item.get("active", True)),
                "employeeId": str(item.get("employeeId") or ""),
                "employeeName": str(item.get("employeeName") or ""),
                "userId": user_id,
                "deviceIds": device_ids,
                "deviceUids": dict(item.get("deviceUids") or {}),
                "checkinStart": str(item.get("checkinStart") or "08:57"),
                "checkinEnd": str(item.get("checkinEnd") or "08:59"),
                "checkinSchedule": str(item.get("checkinSchedule") or "08:56"),
                "checkoutStart": str(item.get("checkoutStart") or "17:19"),
                "checkoutEnd": str(item.get("checkoutEnd") or "17:27"),
                "checkoutSchedule": str(item.get("checkoutSchedule") or "17:18"),
                "days": [int(value) for value in (item.get("days") or [0, 1, 2, 3, 4]) if str(value).isdigit() and 0 <= int(value) <= 6],
                "sourceTag": str(item.get("sourceTag") or "auto_attend"),
            })
        with self._lock:
            self.data["auto_attend_rules"] = clean
            self.save()

    def state_for(self, device_id: str) -> dict[str, Any]:
        return dict(self.data.setdefault("last_device_state", {}).get(device_id, {}))

    def update_device_state(self, device_id: str, **values: Any) -> None:
        with self._lock:
            row = self.data.setdefault("last_device_state", {}).setdefault(device_id, {})
            row.update(values)
            self.save()


@dataclass(slots=True)
class Device:
    id: str
    name: str
    ip_address: str
    port: int = 4370
    model: str = ""
    force_udp: bool = False
    connection_timeout: int = 10
    active: bool = True

    @classmethod
    def from_cloud(cls, row: dict[str, Any]) -> "Device":
        return cls(
            id=str(row["id"]),
            name=str(row.get("name") or "ZKTeco"),
            ip_address=str(row.get("ip_address") or ""),
            port=int(row.get("port") or 4370),
            model=str(row.get("model") or ""),
            force_udp=bool(row.get("force_udp")),
            connection_timeout=max(3, int(row.get("connection_timeout") or 10)),
            active=bool(row.get("active", True)),
        )


class ReaderSession:
    def __init__(self, device: Device, secret: str, bulk: bool = False):
        password = int(secret) if str(secret).isdigit() else 0
        timeout = max(device.connection_timeout * 4, 60) if bulk else device.connection_timeout
        self.device = device
        self.zk = ZK(
            device.ip_address,
            port=device.port,
            timeout=timeout,
            password=password,
            ommit_ping=True,
            force_udp=device.force_udp,
        )
        self.conn = None

    def __enter__(self):
        self.conn = self.zk.connect()
        return self.conn

    def __exit__(self, exc_type, exc, tb):
        if self.conn is not None:
            try:
                self.conn.enable_device()
            except Exception:
                pass
            try:
                self.conn.disconnect()
            except Exception:
                pass
        self.conn = None


class DeviceOps:
    def __init__(self, store: LocalStore):
        self.store = store

    def _secret(self, device: Device) -> str:
        return self.store.secret(device.id)

    def test(self, device: Device) -> dict[str, Any]:
        started = time.monotonic()
        with ReaderSession(device, self._secret(device)) as conn:
            result = {
                "ok": True,
                "latency_ms": round((time.monotonic() - started) * 1000),
                "name": device.name,
                "model": device.model,
            }
            for method, key in [
                ("get_firmware_version", "firmware"),
                ("get_serialnumber", "serial_number"),
                ("get_device_name", "device_name"),
                ("get_platform", "platform"),
            ]:
                try:
                    fn = getattr(conn, method, None)
                    if callable(fn):
                        result[key] = str(fn() or "")
                except Exception:
                    pass
            return result

    @staticmethod
    def user_row(user: Any, fingerprint_count: int = 0) -> dict[str, Any]:
        uid = int(getattr(user, "uid", 0) or 0)
        user_id = str(getattr(user, "user_id", "") or uid)
        return {
            "uid": uid,
            "user_id": user_id,
            "name": str(getattr(user, "name", "") or ""),
            "privilege": int(getattr(user, "privilege", 0) or 0),
            "card": str(getattr(user, "card", "") or ""),
            "fingerprint_count": int(fingerprint_count),
        }

    @staticmethod
    def punch_row(attendance: Any, user_names: dict[str, str]) -> dict[str, Any]:
        uid = int(getattr(attendance, "uid", 0) or 0)
        user_id = str(getattr(attendance, "user_id", "") or uid)
        stamp = getattr(attendance, "timestamp", None)
        if isinstance(stamp, datetime) and stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=NPT)
        punch = getattr(attendance, "punch", None)
        punch_code = int(punch) if punch is not None else None
        return {
            "uid": uid,
            "user_id": user_id,
            "name": user_names.get(user_id, ""),
            "punched_at": iso_utc(stamp),
            "punch_code": punch_code,
            "punch_label": PUNCH_LABELS.get(punch_code, f"Code {punch_code}" if punch_code is not None else ""),
            "source": "device",
            "metadata": {"status": getattr(attendance, "status", None)},
        }

    def read_users(self, device: Device, include_templates: bool = False) -> tuple[list[dict[str, Any]], dict[int, list[dict[str, Any]]]]:
        template_map: dict[int, list[dict[str, Any]]] = {}
        with ReaderSession(device, self._secret(device), bulk=True) as conn:
            users = conn.get_users() or []
            if include_templates:
                try:
                    for template in conn.get_templates() or []:
                        uid = int(getattr(template, "uid", 0) or 0)
                        raw = getattr(template, "template", b"") or b""
                        template_map.setdefault(uid, []).append({
                            "fid": int(getattr(template, "fid", 0) or 0),
                            "valid": int(getattr(template, "valid", 1) or 1),
                            "template": base64.b64encode(raw).decode("ascii"),
                        })
                except Exception as exc:
                    logging.getLogger("formcraft.bridge").warning("%s: fingerprint templates could not be read: %s", device.name, exc)
            rows = [self.user_row(user, len(template_map.get(int(getattr(user, "uid", 0) or 0), []))) for user in users]
            return rows, template_map

    def pull(self, device: Device) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        with ReaderSession(device, self._secret(device), bulk=True) as conn:
            disabled = False
            try:
                try:
                    conn.disable_device()
                    disabled = True
                except Exception:
                    pass
                raw_users = conn.get_users() or []
                names = {str(getattr(user, "user_id", "") or getattr(user, "uid", "")): str(getattr(user, "name", "") or "") for user in raw_users}
                users = [self.user_row(user) for user in raw_users]
                punches = [self.punch_row(item, names) for item in (conn.get_attendance() or []) if getattr(item, "timestamp", None)]
                return users, punches
            finally:
                if disabled:
                    try:
                        conn.enable_device()
                    except Exception:
                        pass

    def backup(self, device: Device) -> dict[str, Any]:
        users, templates = self.read_users(device, include_templates=True)
        for row in users:
            row["fingerprints"] = templates.get(int(row["uid"]), [])
        payload = {
            "version": 1,
            "created_at": iso_utc(),
            "device": {"id": device.id, "name": device.name, "ip_address": device.ip_address, "port": device.port},
            "user_count": len(users),
            "users": users,
        }
        safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in device.name).strip("-") or "device"
        path = self.store.backup_dir / f"{safe}-{datetime.now(NPT).strftime('%Y%m%d-%H%M%S')}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        return {"ok": True, "path": str(path), "user_count": len(users), "fingerprint_count": sum(len(row.get("fingerprints", [])) for row in users)}

    def sync_user(self, device: Device, payload: dict[str, Any]) -> dict[str, Any]:
        user_id = str(payload.get("user_id") or payload.get("device_user_id") or "").strip()
        if not user_id:
            raise ValueError("sync-user requires user_id")
        name = str(payload.get("name") or "").strip()
        privilege = int(payload.get("privilege") or 0)
        card = int(payload.get("card") or 0)
        with ReaderSession(device, self._secret(device), bulk=True) as conn:
            users = conn.get_users() or []
            existing = next((u for u in users if str(getattr(u, "user_id", "")) == user_id), None)
            if existing:
                uid = int(getattr(existing, "uid", 0) or 0)
                same = str(getattr(existing, "name", "") or "") == name and int(getattr(existing, "privilege", 0) or 0) == privilege and int(getattr(existing, "card", 0) or 0) == card
                if same:
                    return {"ok": True, "action": "noop", "uid": uid}
                action = "updated"
            else:
                uid = max((int(getattr(user, "uid", 0) or 0) for user in users), default=0) + 1
                action = "created"
            conn.set_user(uid=uid, name=name, privilege=privilege, user_id=user_id, card=card)
            return {"ok": True, "action": action, "uid": uid}

    def delete_user(self, device: Device, payload: dict[str, Any]) -> dict[str, Any]:
        target_uid = payload.get("uid")
        target_user_id = str(payload.get("user_id") or payload.get("device_user_id") or "")
        with ReaderSession(device, self._secret(device), bulk=True) as conn:
            if target_uid is None:
                for user in conn.get_users() or []:
                    if str(getattr(user, "user_id", "")) == target_user_id:
                        target_uid = int(getattr(user, "uid", 0) or 0)
                        break
            if target_uid is None:
                return {"ok": False, "message": "User not found on device"}
            try:
                conn.delete_user(int(target_uid))
            except Exception:
                fallback = getattr(conn, "delete_user_by_uid", None)
                if not callable(fallback):
                    raise
                fallback(int(target_uid))
            return {"ok": True, "uid": int(target_uid)}

    def migrate(self, source: Device, target: Device, uids: list[int] | None = None) -> dict[str, Any]:
        source_users, templates = self.read_users(source, include_templates=True)
        wanted = set(int(value) for value in uids) if uids else None
        source_users = [row for row in source_users if wanted is None or int(row["uid"]) in wanted]
        results = []
        success = 0
        failed = 0
        with ReaderSession(target, self._secret(target), bulk=True) as conn:
            existing = conn.get_users() or []
            by_user_id = {str(getattr(user, "user_id", "")): user for user in existing}
            next_uid = max((int(getattr(user, "uid", 0) or 0) for user in existing), default=0)
            for source_user in source_users:
                user_id = str(source_user["user_id"])
                current = by_user_id.get(user_id)
                target_uid = int(getattr(current, "uid", 0) or 0) if current else next_uid + 1
                if not current:
                    next_uid = target_uid
                try:
                    conn.set_user(
                        uid=target_uid,
                        name=source_user["name"],
                        privilege=int(source_user["privilege"]),
                        user_id=user_id,
                        card=int(source_user.get("card") or 0),
                    )
                    fp_rows = templates.get(int(source_user["uid"]), [])
                    fp_saved = 0
                    if fp_rows:
                        try:
                            from zk.finger import Finger
                            from zk.user import User
                            fingers = [Finger(target_uid, int(fp["fid"]), int(fp.get("valid", 1)), base64.b64decode(fp["template"])) for fp in fp_rows]
                            target_user = User(uid=target_uid, name=source_user["name"], privilege=int(source_user["privilege"]), password="", group_id="", user_id=user_id, card=int(source_user.get("card") or 0))
                            conn.save_user_template(target_user, fingers)
                            fp_saved = len(fingers)
                        except Exception as exc:
                            logging.getLogger("formcraft.bridge").warning("Fingerprint migration failed for %s: %s", user_id, exc)
                    success += 1
                    results.append({"ok": True, "user_id": user_id, "uid": target_uid, "action": "updated" if current else "created", "fingerprints": fp_saved})
                except Exception as exc:
                    failed += 1
                    results.append({"ok": False, "user_id": user_id, "message": str(exc)})
        return {"ok": failed == 0, "total": len(source_users), "succeeded": success, "failed": failed, "results": results}


class Bridge:
    def __init__(self, rpc: SupabaseRPC, store: LocalStore, poll_seconds: int = 10):
        self.rpc = rpc
        self.store = store
        self.ops = DeviceOps(store)
        self.poll_seconds = max(5, poll_seconds)
        self.devices: dict[str, Device] = {}
        self.stop_event = threading.Event()
        self.pull_lock = threading.Lock()
        self.log = logging.getLogger("formcraft.bridge")
        self.last_config_at = 0.0
        self.last_heartbeat_at = 0.0

    def stop(self, *_args) -> None:
        self.stop_event.set()

    def refresh_config(self) -> None:
        data = self.rpc.call("hrms_bridge_pull_config") or {}
        self.devices = {str(row["id"]): Device.from_cloud(row) for row in (data.get("devices") or [])}
        self.last_config_at = time.monotonic()

    def heartbeat(self) -> None:
        states = []
        for device in self.devices.values():
            row = self.store.state_for(device.id)
            states.append({"id": device.id, "reachable": bool(row.get("reachable")), "last_error": str(row.get("last_error") or "")})
        self.rpc.call(
            "hrms_bridge_heartbeat",
            {
                "bridge_hostname": socket.gethostname(),
                "bridge_platform": platform.platform(),
                "bridge_version": VERSION,
                "device_states": states,
            },
        )
        self.last_heartbeat_at = time.monotonic()

    def device(self, device_id: str | None) -> Device:
        if not device_id:
            raise ValueError("Device is not present in the current bridge configuration")
        if device_id not in self.devices:
            self.refresh_config()
        if device_id not in self.devices:
            raise ValueError("Device is not present in the current bridge configuration")
        return self.devices[device_id]

    def start_pull(self, device: Device) -> str:
        result = self.rpc.call(
            "hrms_bridge_start_pull",
            {"target_device": device.id, "pull_started_at": iso_utc(), "pull_metadata": {"bridge_version": VERSION}},
        )
        if isinstance(result, str):
            return result
        raise RPCError("hrms_bridge_start_pull returned no session ID")

    def finish_pull(self, session_id: str, status: str, pulled: int = 0, inserted: int = 0, error: str = "", error_detail: str = "", metadata: dict[str, Any] | None = None) -> None:
        self.rpc.call(
            "hrms_bridge_finish_pull",
            {
                "target_session": session_id,
                "pull_status": status,
                "pulled_count": pulled,
                "inserted_count": inserted,
                "pull_error": error,
                "pull_error_detail": error_detail,
                "pull_metadata": metadata or {},
            },
        )

    def pull_device(self, device: Device, from_date: str = "", to_date: str = "") -> dict[str, Any]:
        if not device.active:
            return {"ok": False, "message": "Device is inactive"}
        if not self.pull_lock.acquire(blocking=False):
            return {"ok": False, "message": "Another device pull is already running"}
        session_id = ""
        try:
            session_id = self.start_pull(device)
            self.log.info("Pulling %s (%s:%s)", device.name, device.ip_address, device.port)
            users, punches = self.ops.pull(device)
            if from_date or to_date:
                filtered = []
                for row in punches:
                    try:
                        dt = datetime.fromisoformat(str(row.get("punched_at", "")).replace("Z", "+00:00")).astimezone(NPT)
                        day = dt.date().isoformat()
                    except Exception:
                        continue
                    if from_date and day < from_date:
                        continue
                    if to_date and day > to_date:
                        continue
                    filtered.append(row)
                punches = filtered
            self.rpc.call("hrms_bridge_ingest_users", {"target_device": device.id, "users_payload": users})
            inserted = 0
            for offset in range(0, len(punches), 500):
                batch = punches[offset: offset + 500]
                inserted += int(self.rpc.call("hrms_bridge_ingest_punches", {"target_device": device.id, "punches_payload": batch}) or 0)
            self.finish_pull(session_id, "succeeded", len(punches), inserted, metadata={"users": len(users)})
            self.store.update_device_state(device.id, reachable=True, last_error="", last_pull_at=iso_utc(), last_pull_count=len(punches))
            self.log.info("%s pull complete: %s punches, %s new", device.name, len(punches), inserted)
            return {"ok": True, "users": len(users), "punches": len(punches), "inserted": inserted, "session_id": session_id}
        except Exception as exc:
            detail = traceback.format_exc()
            self.log.error("%s pull failed: %s", device.name, exc)
            self.store.update_device_state(device.id, reachable=False, last_error=str(exc), last_pull_at=iso_utc())
            if session_id:
                try:
                    self.finish_pull(session_id, "failed", error=str(exc), error_detail=detail)
                except Exception:
                    self.log.exception("Could not close failed pull session %s", session_id)
            return {"ok": False, "message": str(exc), "error_detail": detail}
        finally:
            self.pull_lock.release()

    def pull_all(self) -> dict[str, Any]:
        results = []
        for device in self.devices.values():
            if device.active:
                results.append({"device_id": device.id, "device": device.name, **self.pull_device(device)})
        return {"ok": all(row.get("ok") for row in results) if results else True, "results": results}

    def execute_command(self, command: dict[str, Any]) -> dict[str, Any]:
        name = str(command.get("command") or "")
        device_id = str(command.get("device_id") or "") or None
        payload = command.get("payload") or {}
        if name == "refresh-config":
            self.refresh_config()
            return {"ok": True, "devices": len(self.devices)}
        if name == "set-schedule":
            self.store.set_schedule(list(payload.get("times") or []))
            return {"ok": True, "times": self.store.schedule(), "timezone": "Asia/Kathmandu"}
        if name == "set-auto-attend-rules":
            self.store.set_auto_attend_rules(list(payload.get("rules") or []))
            return {"ok": True, "rules": len(self.store.auto_attend_rules()), "timezone": "Asia/Kathmandu"}
        if name == "set-secret":
            device = self.device(device_id)
            self.store.set_secret(device.id, str(payload.get("secret") or ""))
            return {"ok": True, "device_id": device.id, "configured": True}
        if name == "pull-all":
            return self.pull_all()
        if name == "migrate-users":
            source = self.device(str(payload.get("sourceDeviceId") or ""))
            target = self.device(str(payload.get("targetDeviceId") or ""))
            uids = [int(value) for value in (payload.get("uids") or [])]
            return self.ops.migrate(source, target, uids or None)
        device = self.device(device_id)
        if name == "test":
            return self.ops.test(device)
        if name == "pull":
            return self.pull_device(device)
        if name == "pull-month":
            return self.pull_device(device, str(payload.get("fromDate") or ""), str(payload.get("toDate") or ""))
        if name == "backup":
            return self.ops.backup(device)
        if name == "sync-user":
            return self.ops.sync_user(device, payload)
        if name == "delete-user":
            return self.ops.delete_user(device, payload)
        raise ValueError(f"Unsupported command: {name}")

    def poll_commands(self) -> None:
        commands = self.rpc.call("hrms_bridge_pull_commands", {"max_commands": 20}) or []
        for command in commands:
            command_id = str(command.get("id") or "")
            if not command_id:
                continue
            try:
                result = self.execute_command(command)
                ok = bool(result.get("ok", True))
                self.rpc.call(
                    "hrms_bridge_ack_command",
                    {
                        "target_command": command_id,
                        "command_status": "succeeded" if ok else "failed",
                        "command_result": result,
                        "command_error": "" if ok else str(result.get("message") or "Command failed"),
                    },
                )
            except Exception as exc:
                self.log.exception("Command %s (%s) failed", command_id, command.get("command"))
                try:
                    self.rpc.call(
                        "hrms_bridge_ack_command",
                        {
                            "target_command": command_id,
                            "command_status": "failed",
                            "command_result": {},
                            "command_error": str(exc),
                        },
                    )
                except Exception:
                    self.log.exception("Could not acknowledge failed command %s", command_id)

    @staticmethod
    def _window_timestamp(day: datetime, start_text: str, end_text: str) -> datetime:
        def parse(value: str) -> tuple[int, int]:
            parts = str(value or "00:00").split(":")
            return int(parts[0]), int(parts[1])
        sh, sm = parse(start_text)
        eh, em = parse(end_text)
        start = day.replace(hour=sh, minute=sm, second=0, microsecond=0)
        end = day.replace(hour=eh, minute=em, second=0, microsecond=0)
        if end < start:
            end += timedelta(days=1)
        return start + (end - start) / 2

    def run_auto_attendance(self) -> None:
        now = datetime.now(NPT)
        current = now.strftime("%H:%M")
        today = now.date().isoformat()
        runs = self.store.data.setdefault("last_auto_attend_runs", {})
        changed = False
        for rule in self.store.auto_attend_rules():
            if not rule.get("active", True) or now.weekday() not in set(rule.get("days") or []):
                continue
            actions = (
                ("checkin", rule.get("checkinSchedule"), rule.get("checkinStart"), rule.get("checkinEnd"), 0, "Auto check-in"),
                ("checkout", rule.get("checkoutSchedule"), rule.get("checkoutStart"), rule.get("checkoutEnd"), 1, "Auto check-out"),
            )
            for action, schedule, window_start, window_end, punch_code, label in actions:
                if current != str(schedule or ""):
                    continue
                key = f"{today}|{rule.get('id')}|{action}"
                if runs.get(key):
                    continue
                punched_npt = self._window_timestamp(now, str(window_start), str(window_end))
                inserted = 0
                for device_id in rule.get("deviceIds") or []:
                    if str(device_id) not in self.devices:
                        continue
                    uid_map = rule.get("deviceUids") or {}
                    uid = uid_map.get(str(device_id))
                    row = {
                        "uid": uid,
                        "user_id": str(rule.get("userId") or ""),
                        "name": str(rule.get("employeeName") or ""),
                        "punched_at": punched_npt.astimezone(UTC).isoformat(),
                        "punch_code": punch_code,
                        "punch_label": label,
                        "source": str(rule.get("sourceTag") or "auto_attend"),
                        "metadata": {"auto_attend_rule_id": rule.get("id"), "action": action, "generated_by": "formcraft-bridge"},
                    }
                    inserted += int(self.rpc.call("hrms_bridge_ingest_punches", {"target_device": str(device_id), "punches_payload": [row]}) or 0)
                runs[key] = iso_utc()
                changed = True
                self.log.info("Automatic attendance %s for %s queued into %d device stream(s), %d new row(s)", action, rule.get("userId"), len(rule.get("deviceIds") or []), inserted)
        if changed:
            for stale in list(runs):
                if not stale.startswith(today):
                    runs.pop(stale, None)
            self.store.save()

    def run_schedule(self) -> None:
        now = datetime.now(NPT)
        key_date = now.date().isoformat()
        current = now.strftime("%H:%M")
        if current not in self.store.schedule():
            return
        runs = self.store.data.setdefault("last_schedule_runs", {})
        key = f"{key_date}|{current}"
        if runs.get(key):
            return
        runs[key] = iso_utc()
        for stale in list(runs):
            if not stale.startswith(key_date):
                runs.pop(stale, None)
        self.store.save()
        self.log.info("Scheduled pull %s NPT", current)
        self.pull_all()

    def run(self) -> None:
        self.log.info("Formcraft ZKTeco bridge %s starting", VERSION)
        while not self.stop_event.is_set():
            started = time.monotonic()
            try:
                if not self.devices or started - self.last_config_at >= 30:
                    self.refresh_config()
                self.poll_commands()
                self.run_schedule()
                self.run_auto_attendance()
                if started - self.last_heartbeat_at >= 60:
                    self.heartbeat()
            except Exception as exc:
                self.log.warning("Bridge loop degraded: %s", exc)
            elapsed = time.monotonic() - started
            self.stop_event.wait(max(1.0, self.poll_seconds - min(self.poll_seconds - 1, elapsed)))
        self.log.info("Formcraft ZKTeco bridge stopped")


def configure_logging(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("formcraft.bridge")
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    file_handler = RotatingFileHandler(root / "bridge.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.handlers.clear()
    logger.addHandler(console)
    logger.addHandler(file_handler)



def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('\"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def main() -> int:
    env_path = Path(os.environ.get("FORMCRAFT_BRIDGE_ENV", ".env")).expanduser()
    load_env_file(env_path)
    root = Path(os.environ.get("FORMCRAFT_BRIDGE_HOME", str(Path.home() / ".formcraft-bridge"))).expanduser()
    configure_logging(root)
    rpc = SupabaseRPC(
        required("FORMCRAFT_SUPABASE_URL"),
        required("FORMCRAFT_SUPABASE_PUBLISHABLE_KEY"),
        required("FORMCRAFT_BRIDGE_ID"),
        required("FORMCRAFT_BRIDGE_TOKEN"),
    )
    store = LocalStore(root)
    bridge = Bridge(rpc, store, int(os.environ.get("FORMCRAFT_BRIDGE_POLL_SECONDS", "10")))
    signal.signal(signal.SIGINT, bridge.stop)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, bridge.stop)
    bridge.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
