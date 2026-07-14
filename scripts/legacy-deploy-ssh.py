#!/usr/bin/env python3
"""Tiny paramiko SSH helper. Usage: python .deploy_ssh.py <host> "<cmd>"
Password from env DEPLOY_PW."""
import os, sys, paramiko

host, cmd = sys.argv[1], sys.argv[2]
user = os.environ.get("DEPLOY_USER", "ubuntu")
pw = os.environ["DEPLOY_PW"]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=20, allow_agent=False, look_for_keys=False)
chan = c.get_transport().open_session()
chan.get_pty()
chan.exec_command(cmd)
buf = b""
while True:
    if chan.recv_ready():
        sys.stdout.buffer.write(chan.recv(65536)); sys.stdout.flush()
    if chan.exit_status_ready() and not chan.recv_ready():
        break
while chan.recv_ready():
    sys.stdout.buffer.write(chan.recv(65536))
sys.stdout.flush()
status = chan.recv_exit_status()
c.close()
sys.exit(status)
