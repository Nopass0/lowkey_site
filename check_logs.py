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
    o = out.read().decode('utf-8', errors='replace')
    e = err.read().decode('utf-8', errors='replace')
    if o: print(o.strip())
    if e: print("[e]", e.strip())

run("pm2 logs jopa-server --lines 30 --nostream")
run("pm2 logs pimpam-server --lines 30 --nostream")
run("pm2 logs socks-server --lines 10 --nostream")

client.close()
