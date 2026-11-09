#!/usr/bin/env python3
"""Browser test for Address Space Packer using Playwright.

Setup (once):
    python3 -m venv .venv-test && .venv-test/bin/pip install playwright && .venv-test/bin/playwright install chromium
Run:
    .venv-test/bin/python tests/playwright_test.py            # watch it in a real window, records video
    .venv-test/bin/python tests/playwright_test.py --headless

The subnet maths and gravity are re-implemented here with Python's `ipaddress` module as an independent
oracle: the bot predicts where each block should land and the game's reported subnet must match.
"""
import argparse, functools, http.server, ipaddress, math, pathlib, re, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / "test-artifacts"
W = H = 16
results = []


def check(cond, name, detail=""):
    results.append((bool(cond), name, detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))


# ---------- independent oracle ----------
def usable(prefix):
    return 2 ** (32 - prefix) - 2 if prefix <= 30 else 0


def best_prefix(hosts):
    size = 1 << (hosts + 2 - 1).bit_length()          # smallest power of two >= hosts + 2
    return 32 - int(math.log2(size))


def cell_dims(prefix):
    k = 32 - prefix
    return 2 ** math.ceil(k / 2), 2 ** (k // 2)


def morton(x, y):
    return sum(((x >> i) & 1) << (2 * i) | ((y >> i) & 1) << (2 * i + 1) for i in range(4))


def normalise(cells):
    mi, mj = min(c[0] for c in cells), min(c[1] for c in cells)
    return sorted([i - mi, j - mj] for i, j in cells)


rot_cw = lambda cells: normalise([(j, -i) for i, j in cells])
rot_ccw = lambda cells: normalise([(-j, i) for i, j in cells])
extent = lambda cells: (max(c[0] for c in cells) + 1, max(c[1] for c in cells) + 1)


def origins(piece, x=None, y=None):
    x = piece["x"] if x is None else x
    y = piece["y"] if y is None else y
    return [(x + i * piece["w"], y + j * piece["h"]) for i, j in piece["cells"]]


def fits(grid, piece, x, y):
    for cx, cy in origins(piece, x, y):
        if cx < 0 or cy < 0 or cx + piece["w"] > W or cy + piece["h"] > H:
            return False
        if any(grid[r][c] for r in range(cy, cy + piece["h"]) for c in range(cx, cx + piece["w"])):
            return False
    return True


def landing(grid, piece):
    y = piece["y"]
    while y - piece["h"] >= 0 and fits(grid, piece, piece["x"], y - piece["h"]):
        y -= piece["h"]
    return y


def cell_network(round_no, cx, cy, prefix):
    """Strict network for a cell, plus proof that the rectangle covers exactly the subnet's addresses."""
    w, h = cell_dims(prefix)
    base = int(ipaddress.ip_address(f"10.{round_no}.0.0"))
    net = ipaddress.ip_network((base + morton(cx, cy), prefix))            # raises if misaligned
    covered = sorted(base + morton(c, r) for r in range(cy, cy + h) for c in range(cx, cx + w))
    assert covered == list(range(int(net.network_address), int(net.network_address) + net.num_addresses)), f"{net} geometry mismatch"
    return net


class Server:
    def __enter__(self):
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        self.srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *a):
        self.srv.shutdown()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--pace", type=int, default=120, help="ms pause between key presses so a human can follow")
    args = ap.parse_args()
    ART.mkdir(exist_ok=True)

    with Server() as srv, sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        ctx = browser.new_context(viewport={"width": 1100, "height": 820}, record_video_dir=str(ART / "video"),
                                  record_video_size={"width": 1100, "height": 820})
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        base = f"http://127.0.0.1:{srv.port}/index.html"
        snap = lambda: page.evaluate("window.__asp.snapshot()")
        press = lambda k: (page.keyboard.press(k), page.wait_for_timeout(args.pace))
        text = lambda sel: page.locator(sel).inner_text()

        def find_seed(pred, limit=80):
            for sd in range(1, limit):
                page.goto(base + f"?seed={sd}&tick=60000")
                s0 = page.evaluate("window.__asp.snapshot()")
                if pred(s0["reqs"][0]): return sd
            return None

        # ===================== 1. Arcade controls =====================
        print("\n== Arcade: controls and rules ==")
        sd = find_seed(lambda r: r["shape"] == "single" and r["hosts"] >= 3)
        check(sd is not None, "found a seed that opens with a single-subnet request", str(sd))
        check(page.title() == "Address Space Packer", "page title")
        check(page.locator("#arcade").is_visible() and not page.locator("#pack").is_visible(), "Arcade is the default tab")
        press("Enter")
        check(text("#arcade-start") == "Pause", "Enter starts the game")
        s = snap(); pc = s["piece"]
        check((pc["prefix"], pc["x"]) == (28, 0) and pc["y"] == H - extent(pc["cells"])[1] * pc["h"], "piece spawns as /28 at top-left", str(pc))
        page.screenshot(path=str(ART / "01-start.png"))

        # grow / shrink: sizes, usable counts and cell shapes against the oracle
        for p in range(27, 23, -1):
            press("a")
            pc = snap()["piece"]
            check(f"/{p} gives {usable(p)} usable" in text("#a-piece") and (pc["w"], pc["h"]) == cell_dims(p), f"A grows to /{p}: {usable(p)} usable, cell {cell_dims(p)[0]}x{cell_dims(p)[1]}", str(pc))
        press("a"); check(snap()["piece"]["prefix"] == 24, "cannot grow past /24")
        for p in range(25, 31):
            press("s")
            pc = snap()["piece"]
            check((pc["w"], pc["h"]) == cell_dims(p), f"S shrinks to /{p}: cell {cell_dims(p)[0]}x{cell_dims(p)[1]}", str(pc))
        press("s"); check(snap()["piece"]["prefix"] == 30, "cannot shrink past /30")

        # horizontal movement steps by the cell width and stops at the walls
        for prefix in (29, 28):
            while snap()["piece"]["prefix"] > prefix: press("a")
            while snap()["piece"]["prefix"] < prefix: press("s")
            pc = snap()["piece"]; cols = extent(pc["cells"])[0]
            xs = []
            for _ in range(10):
                press("ArrowRight"); xs.append(snap()["piece"]["x"])
            check(all(x % pc["w"] == 0 for x in xs) and xs[-1] == W - cols * pc["w"], f"/{prefix} moves in steps of {pc['w']} and stops at the right wall", str(xs))
            for _ in range(10): press("ArrowLeft")
            check(snap()["piece"]["x"] == 0, f"/{prefix} stops at the left wall")

        # too-small block is refused
        s = snap(); req = s["reqs"][s["idx"]]
        small = next((p for p in range(30, 23, -1) if usable(p) < req["hosts"]), None)
        if small:
            while snap()["piece"]["prefix"] < small: press("s")
            while snap()["piece"]["prefix"] > small: press("a")
            before = snap(); press("Space"); after = snap()
            check(after["piece"] is not None and after["idx"] == before["idx"], "too-small block does not lock")
            msg = text("#a-msg")
            check(f"has {usable(small)} usable" in msg and f"needs {req['hosts']}" in msg, "refusal message quotes the right numbers", msg)
            check("err" in (page.locator("#a-piece").get_attribute("class") or ""), "UI flags the size as wrong")
            page.screenshot(path=str(ART / "02-too-small-refused.png"))
        else:
            print("SKIP too-small test (request needs <= 2 hosts)")
        press("p"); check(text("#arcade-start") == "Resume" and snap()["state"] == "paused", "P pauses")
        press("Enter"); check(snap()["state"] == "running", "Enter resumes")

        # ===================== 1b. Rotation =====================
        print("\n== Arcade: rotation ==")
        sd = find_seed(lambda r: r["shape"] in ("T", "L", "J", "S", "Z"))
        check(sd is not None, "found a seed whose first piece is an odd-shaped bundle", str(sd))
        press("Enter")
        s = snap(); pc = s["piece"]; req = s["reqs"][0]
        check(len(pc["cells"]) == len(req["cells"]) >= 4, f"{req['name']} is a {req['shape']} of {len(pc['cells'])} subnets", str(pc["cells"]))
        check(f"{req['hosts']} hosts each" in text("#a-req"), "panel says hosts apply to each block", text("#a-req"))
        start_cells = normalise(pc["cells"]); cur = start_cells; seen = {str(start_cells)}
        for turn in range(1, 5):
            press("ArrowUp")
            pc = snap()["piece"]; cur = rot_cw(cur)
            check(normalise(pc["cells"]) == cur, f"Up arrow rotation {turn} matches independent clockwise rotation", f"{normalise(pc['cells'])} vs {cur}")
            check(all(0 <= cx and cx + pc["w"] <= W and 0 <= cy and cy + pc["h"] <= H for cx, cy in origins(pc)), f"rotation {turn} stays inside the well")
            seen.add(str(normalise(pc["cells"])))
        check(normalise(snap()["piece"]["cells"]) == start_cells, "four clockwise turns restore the shape")
        check(len(seen) >= 2, "rotation actually changes the shape", str(len(seen)))
        press("z")
        check(normalise(snap()["piece"]["cells"]) == rot_ccw(start_cells), "Z rotates counter-clockwise")
        press("x"); check(normalise(snap()["piece"]["cells"]) == start_cells, "X rotates clockwise (undoes Z)")
        for _ in range(10): press("ArrowRight")
        press("ArrowUp")
        pc = snap()["piece"]
        check(all(0 <= cx and cx + pc["w"] <= W for cx, cy in origins(pc)), "rotating against the right wall kicks the piece back inside")
        page.screenshot(path=str(ART / "02b-rotated-bundle.png"))

        # ===================== 2. Bot plays full rounds; Python oracle checks every lock =====================
        def play_round(label):
            allocs = []
            while True:
                s = snap()
                if s["state"] in ("roundclear", "over") or s["piece"] is None:
                    return s
                req = s["reqs"][s["idx"]]; n = len(req["cells"])
                want = best_prefix(req["hosts"])
                check(want == 32 - int(math.log2(req["size"])), f"{label} {req['name']}: oracle size matches /{want}")
                while snap()["piece"]["prefix"] > want: press("a")
                while snap()["piece"]["prefix"] < want: press("s")
                # try the four rotations and every column, keep the lowest stack
                pick = None
                for rot in range(4):
                    pc = snap()["piece"]; grid = snap()["grid"]; cols, rows = extent(pc["cells"])
                    for x in range(0, W - cols * pc["w"] + 1, pc["w"]):
                        if not fits(grid, pc, x, pc["y"]): continue
                        ly = landing(grid, {**pc, "x": x})
                        key = (ly + rows * pc["h"], ly, x)
                        if pick is None or key < pick[0]: pick = (key, rot, x)
                    press("ArrowUp")
                if pick is None:
                    press("Space"); continue
                for _ in range(pick[1]): press("ArrowUp")
                pc = snap()["piece"]
                steps = (pick[2] - pc["x"]) // pc["w"]
                for _ in range(abs(steps)): press("ArrowRight" if steps > 0 else "ArrowLeft")
                # predict the result from the live state just before the drop
                s = snap(); pc = s["piece"]; grid = s["grid"]
                ly = landing(grid, pc)
                rows_dropped = pc["y"] - ly
                cells = [(cx, cy, k) for k, (cx, cy) in enumerate(origins(pc, pc["x"], ly))]
                nets = [(cell_network(s["round"], cx, cy, want), req["names"][k]) for cx, cy, k in cells]
                nets.sort(key=lambda t: int(t[0].network_address))
                before = s["score"]
                press("Space")
                s2 = snap()
                log = page.locator("#a-log li").all_inner_texts()
                got = log[-n:]
                exp = [f"{name}: {net}" for net, name in nets]
                check(got == exp, f"{label} {req['name']} ({req['hosts']} hosts{' each' if n > 1 else ''}, {req['shape']}) -> {', '.join(str(x[0]) for x in nets)}", f"{got} vs {exp}")
                bonus = 200 if s2["roundDone"] else 0
                check(s2["score"] - before == 100 * n + rows_dropped + bonus, f"{label} score +{100 * n + rows_dropped + bonus}", f"got +{s2['score'] - before}")
                check(usable(want) >= req["hosts"] and (want == 30 or usable(want + 1) < req["hosts"]), f"{label} /{want} is the smallest block for {req['hosts']} hosts")
                for net, _ in nets:
                    for other in allocs:
                        if net.overlaps(other): check(False, f"{label} no overlap", f"{net} vs {other}")
                    allocs.append(net)

        cleared_round = None; saw_bundle = False
        for seed in range(1, 13):
            print(f"\n== Arcade: bot plays seed {seed} (round 1) ==")
            page.goto(base + f"?seed={seed}&tick=60000")
            press("Enter")
            saw_bundle = saw_bundle or any(len(r["cells"]) > 1 for r in snap()["reqs"])
            s = play_round(f"seed{seed}/r1")
            if s["state"] == "roundclear":
                parent = ipaddress.ip_network("10.1.0.0/24")
                items = page.locator("#a-log li").all_inner_texts()
                nets = [ipaddress.ip_network(i.split(": ")[1].split(" ")[0]) for i in items]
                want_n = sum(len(r["cells"]) for r in s["reqs"])
                check(len(items) == want_n, "plan lists every block", f"{len(items)}/{want_n}")
                check(all(n.subnet_of(parent) for n in nets), "every block is inside 10.1.0.0/24")
                check(text("#arcade-start") == "Next round" and text("#a-left") == "0", "round clear shows Next round")
                page.screenshot(path=str(ART / "03-round-clear.png"))
                cleared_round = seed
                press("Enter")
                s = snap()
                check(s["round"] == 2 and text("#a-round") == "2", "Enter starts round 2")
                check(all(v == 0 for row in s["grid"] for v in row), "round 2 board is empty")
                print(f"\n== Arcade: bot plays seed {seed} (round 2) ==")
                s = play_round(f"seed{seed}/r2")
                page.screenshot(path=str(ART / "04-round-2.png"))
                break
            else:
                print(f"   seed {seed} ended in state {s['state']}, trying next")
        check(cleared_round is not None, "bot cleared at least one full round", str(cleared_round))
        check(saw_bundle, "bundles (odd-shaped pieces) appeared in the rounds played")

        # ===================== 3. Waste fills the well =====================
        print("\n== Arcade: oversized blocks end the game ==")
        page.goto(base + "?seed=3&tick=60000")
        press("Enter")
        guard = 0
        while snap()["state"] == "running" and guard < 20:
            guard += 1
            for _ in range(6): press("a")
            press("Space")
        s = snap()
        check(s["state"] == "over" and s["over"], "wasting space (huge blocks) ends the game")
        check(text("#arcade-start") == "Play again", "Play again offered")
        page.screenshot(path=str(ART / "05-game-over.png"))
        check("(oversized)" in text("#a-log"), "plan marks oversized blocks")

        # ===================== 4. Puzzle mode =====================
        print("\n== Puzzle mode ==")
        page.goto(base)
        page.click("#mode-pack")
        check(page.locator("#pack").is_visible() and page.locator("#map .cell").count() == 16, "Puzzle level 1: 16 cells")
        pick = lambda p, parent=24: page.locator(".prefix").nth(p - parent).click()   # buttons run from the parent prefix upward
        pick(25); page.locator("#map .cell").nth(1).click()
        m = text("#message")
        check("192.168.1.16 is not a valid /25 start" in m and "192.168.1.0 or 192.168.1.128" in m, "misaligned /25 rejected with correct boundaries", m)
        pick(27); page.locator("#map .cell").nth(0).click()
        check("A /27 has 30 usable addresses, but Sales needs 100" in text("#message"), "too-small /27 rejected for 100 hosts")
        pick(25); page.locator("#map .cell").nth(0).click()
        pick(26); page.locator("#map .cell").nth(8).click()
        pick(27); page.locator("#map .cell").nth(12).click()
        check(page.locator("#done").is_visible(), "level 1 completes")
        check(all("assigned to Sales" in (page.locator("#map .cell").nth(i).get_attribute("aria-label") or "") for i in range(8)), "Sales /25 covers 192.168.1.0-127")
        check("192.168.1.128, assigned to Engineering" in page.locator("#map .cell").nth(8).get_attribute("aria-label"), "Engineering starts at 192.168.1.128")
        page.screenshot(path=str(ART / "06-puzzle-complete.png"))
        page.locator("#levels button").nth(6).click()
        check("reserved by Legacy DMZ" in page.locator("#map .cell").nth(4).get_attribute("aria-label"), "level 7 shows reserved block at 10.50.0.64")
        pick(25, 23); page.locator("#map .cell").nth(0).click()
        check("overlaps Legacy DMZ" in text("#message"), "placing a /25 over a reserved /26 is refused")

        # ===================== 5. Drill =====================
        print("\n== Warm-up drill ==")
        page.click("#mode-drill")
        for i in range(10):
            q = text("#drill-q")
            if m := re.search(r"in a /(\d+)\?", q): ans = str(usable(int(m.group(1))))
            elif m := re.search(r"fits (\d+) hosts", q): ans = f"/{best_prefix(int(m.group(1)))}"
            else: ans = None; check(False, "parse drill question", q)
            if i == 0:
                wrong = next(b for b in page.locator("#drill-options button").all_inner_texts() if b != ans)
                page.locator("#drill-options button", has_text=re.compile(f"^{re.escape(wrong)}$")).click()
                check(f"The answer is {ans}" in text("#drill-feedback"), "wrong drill answer shows the correct one (matches Python)", q + " -> " + ans)
            else:
                page.locator("#drill-options button", has_text=re.compile(f"^{re.escape(ans)}$")).click()
                check(text("#drill-feedback") == "Correct.", f"drill Q{i + 1} correct by Python oracle", q)
            page.wait_for_timeout(1400)
        check("Finished: 9 out of 10" in text("#drill-q"), "drill score is 9/10 (one wrong on purpose)", text("#drill-q"))
        page.screenshot(path=str(ART / "07-drill.png"))

        check(not errors, "no console or page errors", "; ".join(errors[:3]))
        ctx.close(); browser.close()

    fails = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(fails)} passed, {len(fails)} failed. Video and screenshots: {ART}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
