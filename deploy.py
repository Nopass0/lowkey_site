#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deploy VPN servers to 46.226.166.226"""

import paramiko
import os
import sys
import time

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HOST = "46.226.166.226"
USER = "root"
PASS = "y5RmyJ4Q2JIL"

# VoidDB / backend env
VOIDDB_URL = "https://db.lowkey.su"
VOIDDB_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTczMjE5NTIwMH0.3Xl3IXKD_xPuHPLbQgBHECEP7GAzN8AK7nMVQIRqCNk"
BACKEND_URL = "https://lowkey.su/api"
BACKEND_SECRET = "lowkey_server_secret_2024"
SERVER_IP = "46.226.166.226"

BASE = "/opt/lowkey"

FILES = [
    ("jopa-server/bin/jopad", f"{BASE}/jopa-server/jopad"),
    ("jopa-server/ecosystem.config.js", f"{BASE}/jopa-server/ecosystem.config.js"),
    ("socks-server/bin/socks-server", f"{BASE}/socks-server/socks-server"),
    ("socks-server/ecosystem.config.js", f"{BASE}/socks-server/ecosystem.config.js"),
    ("pimpam-server/bin/pimpam-server", f"{BASE}/pimpam-server/pimpam-server"),
    ("pimpam-server/ecosystem.config.js", f"{BASE}/pimpam-server/ecosystem.config.js"),
]

SETUP_COMMANDS = [
    f"mkdir -p {BASE}/jopa-server {BASE}/socks-server {BASE}/pimpam-server",
    f"chmod +x {BASE}/jopa-server/jopad {BASE}/socks-server/socks-server {BASE}/pimpam-server/pimpam-server",
    # Check if pm2 installed
    "which pm2 || npm install -g pm2",
    # Stop existing processes
    f"pm2 delete jopa-server socks-server pimpam-server 2>/dev/null; true",
    # Start jopa-server
    f"""cd {BASE}/jopa-server && JOPA_PSK=lowkey_jopa_psk_2024 JOPA_PORT=7443 VOIDDB_URL={VOIDDB_URL} VOIDDB_TOKEN='{VOIDDB_TOKEN}' BACKEND_URL={BACKEND_URL} BACKEND_SECRET={BACKEND_SECRET} SERVER_ID=main SERVER_IP={SERVER_IP} pm2 start ./jopad --name jopa-server""",
    # Start socks-server
    f"""cd {BASE}/socks-server && SOCKS_PORT=1080 VOIDDB_URL={VOIDDB_URL} VOIDDB_TOKEN='{VOIDDB_TOKEN}' BACKEND_URL={BACKEND_URL} BACKEND_SECRET={BACKEND_SECRET} pm2 start ./socks-server --name socks-server""",
    # Start pimpam-server
    f"""cd {BASE}/pimpam-server && PIMPAM_PORT=8443 VOIDDB_URL={VOIDDB_URL} VOIDDB_TOKEN='{VOIDDB_TOKEN}' BACKEND_URL={BACKEND_URL} BACKEND_SECRET={BACKEND_SECRET} pm2 start ./pimpam-server --name pimpam-server""",
    # Save pm2 state
    "pm2 save",
    # Show status
    "pm2 list",
]

def run(client, cmd):
    print(f"\n$ {cmd[:120]}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out.strip())
    if err: print("[stderr]", err.strip())
    return out, err

def main():
    print(f"Connecting to {HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=30)
    print("Connected!")

    sftp = client.open_sftp()

    # Upload files
    base_dir = os.path.dirname(os.path.abspath(__file__))

    print("\n=== Creating directories ===")
    run(client, f"mkdir -p {BASE}/jopa-server {BASE}/socks-server {BASE}/pimpam-server")

    print("\n=== Uploading binaries ===")
    for local, remote in FILES:
        local_path = os.path.join(base_dir, local.replace("/", os.sep))
        print(f"  {local} -> {remote}")
        sftp.put(local_path, remote)

    sftp.close()

    print("\n=== Setting up services ===")
    for cmd in SETUP_COMMANDS:
        run(client, cmd)

    print("\n=== Checking ports ===")
    run(client, "ss -tlnp | grep -E '7443|1080|8443'")

    client.close()
    print("\n✓ Deployment complete!")

if __name__ == "__main__":
    main()
