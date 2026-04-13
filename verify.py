#!/usr/bin/env python3
import paramiko, sys, io
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST, USER, PASS = "46.226.166.226", "root", "y5RmyJ4Q2JIL"
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

def run(cmd):
    print(f"\n$ {cmd}")
    _, out, err = client.exec_command(cmd, timeout=30)
    o = out.read().decode('utf-8', errors='replace').strip()
    e = err.read().decode('utf-8', errors='replace').strip()
    if o: print(o)
    if e and 'err' in e.lower(): print("[e]", e)

run("ss -ulnp | grep -E '7443'")
run("ss -tlnp | grep -E '1080|8443'")
run("pm2 list")
run("ufw status 2>/dev/null | head -20 || iptables -L INPUT -n | head -20")

client.close()
