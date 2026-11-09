#!/usr/bin/env python3
"""Run the browser-based logic tests in headless Chrome. Usage: python3 tests/run.py"""
import http.server, socketserver, subprocess, sys, threading, re, functools, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
handler.log_message = lambda *a, **k: None
with socketserver.TCPServer(("127.0.0.1", 0), handler) as srv:
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    out = subprocess.run([chrome, "--headless=new", "--disable-gpu", "--virtual-time-budget=5000",
                          "--dump-dom", f"http://127.0.0.1:{port}/tests/index.html"],
                         capture_output=True, text=True, timeout=60).stdout
    srv.shutdown()
m = re.search(r'RESULT pass=(\d+) fail=(\d+)([^<]*)', out)
if not m:
    print("No result found"); sys.exit(2)
print(m.group(0).strip())
sys.exit(1 if int(m.group(2)) else 0)
