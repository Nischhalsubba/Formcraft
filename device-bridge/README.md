# Formcraft ZKTeco Device Bridge

The Formcraft Device Bridge is an optional LAN-side companion for the Netlify-hosted Formcraft application. It connects to ZKTeco readers on the office network and synchronizes device users, attendance punches, pull diagnostics, and device commands through Supabase.

The hosted app does not connect directly to private IP addresses. If the bridge is stopped or the office network is unavailable, Formcraft continues to operate normally; only biometric device synchronization is unavailable.

## Security model

- The bridge uses the same public Supabase URL and publishable key as the hosted app.
- It also uses a high-entropy, workspace-scoped bridge token created from Formcraft Attendance > Devices.
- It does **not** use a Supabase service-role key.
- ZKTeco communication keys are stored only in the bridge's local `bridge-state.json`, with restrictive file permissions where the operating system supports them.
- A communication key sent from the hosted UI is carried in a short-lived command. The database function clears that command payload after the bridge acknowledges it.
- Fingerprint templates used for backup or migration stay on the LAN bridge. They are not uploaded to the hosted Formcraft app.

## Prerequisites

- Python 3.10 or newer
- Network access from this machine to the ZKTeco readers, normally TCP/UDP port 4370
- The additive Supabase migration `supabase/migrations/20260807170000_hrms_zkteco_bridge.sql` applied to the Formcraft project
- A bridge ID and one-time bridge token created in the hosted Formcraft UI

## Install

```bash
cd device-bridge
python -m venv .venv
```

Linux/macOS:

```bash
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and add the Supabase URL, publishable key, bridge ID, and bridge token shown once by Formcraft.

Start the bridge:

```bash
python formcraft_bridge.py
```

## Device workflow

1. In hosted Formcraft, open **Attendance > Devices**.
2. Create a bridge credential and configure `.env` on the LAN bridge machine.
3. Start the bridge.
4. Add each ZKTeco device from the hosted UI. IP, port, protocol mode, timeout, and model are stored in the tenant-safe cloud configuration.
5. Use **Set connection secret** to send a device Comm Key to the bridge. The secret is retained only on the bridge machine.
6. Use **Test**, **Pull**, **Backup**, or **Migrate users** from the hosted UI.
7. Use **Attendance > Schedule** to define one or more Nepal-time pull times.
8. Use **Sync bridge punches** to materialize new raw bridge punches into the existing Formcraft Attendance records. Reports and payroll then use those same Attendance records.

## Supported bridge commands

| Command | Behavior |
|---|---|
| `test` | Connects to a reader and returns basic reader/firmware information when available |
| `pull` | Pulls users and attendance from one reader, deduplicates raw rows in Supabase, and records a pull session |
| `pull-month` | Pulls one historical AD range derived from a selected BS month for a reader |
| `pull-all` | Pulls every active reader assigned to this bridge |
| `backup` | Writes a local JSON backup containing users and available fingerprint templates |
| `migrate-users` | Copies selected or all users and available fingerprint templates directly between two LAN readers |
| `sync-user` | Creates or updates a user on one reader by device user ID |
| `delete-user` | Removes a user from one reader |
| `set-secret` | Stores the device communication key locally on the bridge |
| `set-schedule` | Replaces the local Nepal-time automatic pull schedule |
| `set-auto-attend-rules` | Replaces locally evaluated automatic-attendance rules from the hosted Attendance UI |
| `refresh-config` | Reloads device configuration from Formcraft |

## Automatic pulls

Schedule times are stored locally after the hosted UI queues a `set-schedule` command. The bridge evaluates schedules in `Asia/Kathmandu` and runs each configured HH:MM slot at most once per Nepal calendar date.

Manual and scheduled pulls share the same single-pull lock so a slow reader cannot accidentally cause overlapping device sessions.

## Automatic attendance rules

Formcraft can optionally queue automatic-attendance rules from **Attendance > Auto attendance**. The bridge evaluates these rules in `Asia/Kathmandu` and submits generated check-in/check-out punches to the same tenant-safe raw-punch RPC. Generated punches are explicitly stored with `source=auto_attend` plus rule/action metadata, so they remain distinguishable from physical biometric swipes in Formcraft audit and Attendance materialization.

The bridge records each rule/action/date execution locally and will not intentionally submit the same automatic event twice for one Nepal calendar day. It does not backfill a missed automatic-attendance window after a sleeping or powered-off PC wakes up. That conservative behavior avoids silently fabricating historical punches.

## Logs and backups

The bridge home defaults to:

- Linux/macOS: `~/.formcraft-bridge`
- Windows: the current user's home directory under `.formcraft-bridge`

It contains:

- `bridge.log`, rotated at roughly 5 MB with five retained files
- `bridge-state.json`, local communication keys, schedule, and last device state
- `backups/`, local device backup JSON files

Change the location with `FORMCRAFT_BRIDGE_HOME`.

## Linux systemd example

Create `/etc/systemd/system/formcraft-device-bridge.service`:

```ini
[Unit]
Description=Formcraft ZKTeco Device Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=formcraft
WorkingDirectory=/opt/formcraft/device-bridge
ExecStart=/opt/formcraft/device-bridge/.venv/bin/python /opt/formcraft/device-bridge/formcraft_bridge.py
Restart=on-failure
RestartSec=5
Environment=FORMCRAFT_BRIDGE_ENV=/opt/formcraft/device-bridge/.env

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now formcraft-device-bridge
sudo systemctl status formcraft-device-bridge
```

## Windows startup

The bridge can be run at login with Task Scheduler. Point the task to:

```text
C:\path\to\Formcraft\device-bridge\.venv\Scripts\python.exe
```

with arguments:

```text
C:\path\to\Formcraft\device-bridge\formcraft_bridge.py
```

and set the working directory to `device-bridge` so `.env` is loaded automatically.

## Failure isolation

The bridge is deliberately not part of the Netlify runtime. A failed reader, a lost LAN route, an expired bridge token, or a stopped bridge does not block authentication, Projects, Tasks, CRM, Files, Invoices, Finance, Employees, Time Off, Payroll records, or any other existing Formcraft feature. The HRMS UI shows device synchronization as degraded while the rest of the application remains available.

