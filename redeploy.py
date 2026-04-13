#!/usr/bin/env python3
import paramiko, sys, io, os
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST, USER, PASS = "46.226.166.226", "root", "y5RmyJ4Q2JIL"
VOIDDB_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTczMjE5NTIwMH0.3Xl3IXKD_xPuHPLbQgBHECEP7GAzN8AK7nMVQIRqCNk"
BASE = "/opt/lowkey"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)
print("Connected!")

def run(cmd):
    print(f"\n$ {cmd[:100]}")
    _, out, err = client.exec_command(cmd, timeout=60)
    o = out.read().decode('utf-8', errors='replace').strip()
    e = err.read().decode('utf-8', errors='replace').strip()
    if o: print(o)
    if e: print("[e]", e)
    return o

sftp = client.open_sftp()

# Upload fixed binaries
for local, remote in [
    ("jopa-server/bin/jopad", f"{BASE}/jopa-server/jopad"),
    ("pimpam-server/bin/pimpam-server", f"{BASE}/pimpam-server/pimpam-server"),
]:
    lp = os.path.join(BASE_DIR, local.replace("/", os.sep))
    print(f"  upload {local}")
    sftp.put(lp, remote)

sftp.close()

run(f"chmod +x {BASE}/jopa-server/jopad {BASE}/pimpam-server/pimpam-server")
run("pm2 delete jopa-server pimpam-server 2>/dev/null; true")

run(f"""cd {BASE}/jopa-server && JOPA_PSK=lowkey_jopa_psk_2024 JOPA_PORT=7443 VOIDDB_URL=https://db.lowkey.su VOIDDB_TOKEN='{VOIDDB_TOKEN}' BACKEND_URL=https://lowkey.su/api BACKEND_SECRET=lowkey_server_secret_2024 SERVER_ID=main SERVER_IP=46.226.166.226 pm2 start ./jopad --name jopa-server""")

run(f"""cd {BASE}/pimpam-server && PIMPAM_PORT=8443 VOIDDB_URL=https://db.lowkey.su VOIDDB_TOKEN='{VOIDDB_TOKEN}' BACKEND_URL=https://lowkey.su/api BACKEND_SECRET=lowkey_server_secret_2024 SERVER_ID=main SERVER_IP=46.226.166.226 pm2 start ./pimpam-server --name pimpam-server""")

import time; time.sleep(3)

run("pm2 list")
run("pm2 logs jopa-server --lines 5 --nostream 2>&1 | tail -10")
run("pm2 logs pimpam-server --lines 5 --nostream 2>&1 | tail -10")
run("ss -tlnp | grep -E '7443|1080|8443'")
run("pm2 save")

client.close()
print("\nDone!")
