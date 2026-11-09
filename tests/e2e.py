#!/usr/bin/env python3
"""Drive the real UI in headless Chrome. Usage: python3 tests/e2e.py"""
import http.server, socketserver, subprocess, threading, functools, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(H, directory=str(root))) as s:
    port = s.server_address[1]
    threading.Thread(target=s.serve_forever, daemon=True).start()
    out = subprocess.run([chrome, "--headless=new", "--disable-gpu", "--virtual-time-budget=8000", "--dump-dom",
                          f"http://127.0.0.1:{port}/tests/e2e.html"], capture_output=True, text=True, timeout=60).stdout
    s.shutdown()
m = re.search(r'E2E\n.*?E2E_FAILS=(\d+)', out, re.S)
print(m.group(0) if m else "no result")
sys.exit(0 if m and m.group(1) == "0" else 1)
