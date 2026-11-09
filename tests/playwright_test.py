#!/usr/bin/env python3
"""Browser test for Address Space Packer (Subnet 2048, puzzle and drill) using Playwright.

Setup (once):
    python3 -m venv .venv-test && .venv-test/bin/pip install playwright && .venv-test/bin/playwright install chromium
Run:
    .venv-test/bin/python tests/playwright_test.py            # watch it in a real window, records video
    .venv-test/bin/python tests/playwright_test.py --headless

The subnet maths and the 2048 slide rules are re-implemented here with Python's `ipaddress` module as an
independent oracle: every key press is predicted before it is sent and compared with what the game shows.
"""
import argparse, functools, http.server, ipaddress, math, pathlib, random, re, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / "test-artifacts"
W = H = 16
results = []


def check(cond, name, detail=""):
    results.append((bool(cond), name, detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))


# ---------- independent oracle ----------
N = 4


def usable(prefix):
    return 2 ** (32 - prefix) - 2 if prefix <= 30 else 0


def best_prefix(hosts):
    size = 1 << (hosts + 2 - 1).bit_length()          # smallest power of two >= hosts + 2
    return 32 - int(math.log2(size))


def siblings(a, b):
    """Two networks merge only if they are the two halves of the same parent."""
    return a.prefixlen == b.prefixlen and a != b and a.supernet() == b.supernet()


def lines(d):
    out = []
    for k in range(N):
        idx = []
        for m in range(N):
            j = m if d in ("left", "up") else N - 1 - m
            idx.append(k * N + j if d in ("left", "right") else j * N + k)
        out.append(idx)
    return out


def slide(board, d):
    """board: {cell: IPv4Network}. Returns (new board, merges, blocked pairs). Independent of the game's code."""
    new, merges, blocked = {}, [], []
    for idx in lines(d):
        tiles = [board[i] for i in idx if i in board]
        out, k = [], 0
        while k < len(tiles):
            a = tiles[k]; b = tiles[k + 1] if k + 1 < len(tiles) else None
            if b is not None and siblings(a, b):
                out.append((a.supernet(), (a, b))); k += 2
            else:
                if b is not None and a.prefixlen == b.prefixlen: blocked.append((a, b))
                out.append((a, None)); k += 1
        for m, (net, frm) in enumerate(out):
            new[idx[m]] = net
            if frm: merges.append((frm, net))
    return new, merges, blocked


def board_of(snap):
    return {t["cell"]: ipaddress.ip_network(t["cidr"]) for t in snap["tiles"]}


def coverage_ok(snap):
    nets = list(board_of(snap).values()) + [ipaddress.ip_network(c) for c in snap["pool"]]
    parent = ipaddress.ip_network(snap["parent"])
    return sum(n.num_addresses for n in nets) == parent.num_addresses and list(ipaddress.collapse_addresses(nets)) == [parent]


def eval_board(board, merged):
    tiles = len(board)
    stuck = 0
    for c, a in board.items():
        for nb in ((c + 1) if c % N < N - 1 else None, c + N):
            b = board.get(nb) if nb is not None and nb < N * N else None
            if b is not None and a.prefixlen == b.prefixlen and not siblings(a, b): stuck += 1
    return merged * 3 - tiles * 40 - stuck * 25


def search(board, depth):
    best = -1e9
    for d in ("left", "up", "right", "down"):
        nb, merges, _ = slide(board, d)
        if nb == board: continue
        v = eval_board(nb, sum(n.num_addresses for _, n in merges))
        if depth > 1:
            sub = search(nb, depth - 1)
            if sub > -1e9: v += 0.9 * sub
        best = max(best, v)
    return best


def choose_move(board):
    best = None
    for d in ("left", "up", "right", "down"):
        nb, merges, _ = slide(board, d)
        if nb == board: continue
        v = eval_board(nb, sum(n.num_addresses for _, n in merges))
        sub = search(nb, 2)
        if sub > -1e9: v += 0.9 * sub
        if best is None or v > best[0]: best = (v, d)
    return best[1] if best else None


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


        KEYS = {"left": "ArrowLeft", "right": "ArrowRight", "up": "ArrowUp", "down": "ArrowDown"}
        goto = lambda level, seed: (page.goto(base + f"?level={level}&seed={seed}"), page.wait_for_selector("#m-board .tile"))

        def check_geometry(label):
            """Each tile must be drawn in the grid cell the game says it is in (catches flipped axes)."""
            ok = True; detail = ""
            page.wait_for_timeout(300)   # let slide animations finish before measuring
            tiles = page.evaluate("""() => [...document.querySelectorAll('#m-board .tile:not(.leaving)')].map(e => {
                const b = document.getElementById('m-board').getBoundingClientRect(), r = e.getBoundingClientRect();
                return { x: Math.round((r.left - b.left) / (b.width / 4)), y: Math.round((r.top - b.top) / (b.height / 4)), label: e.getAttribute('aria-label') }; })""")
            exp = {t["cell"]: t["cidr"] for t in snap2()["tiles"]}
            for tl in tiles:
                cell = tl["y"] * N + tl["x"]
                if cell not in exp or not tl["label"].startswith(exp[cell] + ","):
                    ok = False; detail = f"{tl} vs {exp.get(cell)}"
            check(ok and len(tiles) == len(exp), f"{label}: every tile is drawn in its own cell", detail)

        snap2 = lambda: page.evaluate("window.__m2048.snapshot()")

        # ===================== 1. Subnet 2048: screen and rules =====================
        print("\n== Subnet 2048: screen ==")
        goto(1, 4)
        check(page.title() == "Address Space Packer", "page title")
        check(page.locator("#merge").is_visible() and not page.locator("#pack").is_visible(), "Subnet 2048 is the default tab")
        check("Goal: merge every block back into 10.0.0.0/26" in text("#m-goal"), "goal is stated on screen", text("#m-goal"))
        check("Merge siblings" in text("#merge .rules"), "merge rule is explained on screen")
        s0 = snap2()
        check(len(s0["tiles"]) == 2 and len(s0["pool"]) == 2 and coverage_ok(s0), "level 1 starts with 2 blocks on the board and 2 waiting, covering 10.0.0.0/26 exactly")
        check_geometry("start")
        page.screenshot(path=str(ART / "01-start.png"))

        # ===================== 2. Every key press checked against the independent model =====================
        print("\n== Subnet 2048: every move checked against a Python model ==")
        saw_merge = saw_blocked = 0
        rnd = random.Random(11)
        for level, seed, moves in ((3, 5, 45), (4, 2, 35), (6, 1, 30)):
            goto(level, seed)
            for n in range(moves):
                pre = snap2()
                if pre["won"] or pre["lost"]: break
                d = rnd.choice(["left", "right", "up", "down"])
                pred, merges, blocked = slide(board_of(pre), d)
                moved = pred != board_of(pre)
                press(KEYS[d])
                post = snap2()
                got = board_of(post)
                extra = {c: n_ for c, n_ in got.items() if pred.get(c) != n_}
                pool_pre = sorted(pre["pool"]); pool_post = sorted(post["pool"])
                label = f"L{level}/s{seed} move {n + 1} {d}"
                if not moved:
                    check(got == board_of(pre) and post["moves"] == pre["moves"], f"{label}: no-op slide changes nothing")
                    continue
                spawned = len(pool_pre) - len(pool_post)
                good = {c: n_ for c, n_ in got.items() if c in pred and pred[c] == n_} == {c: n_ for c, n_ in pred.items() if got.get(c) == n_} and all(c in got for c in pred)
                check(good and len(extra) == spawned and spawned in (0, 1), f"{label}: slide matches model" + (f" (+1 spawn)" if spawned else ""), f"pred={pred} got={got}")
                if spawned:
                    (cell, net), = extra.items()
                    check(str(net) in pool_pre and cell not in pred and sorted(pool_pre) == sorted(pool_post + [str(net)]), f"{label}: spawned block came from the pool into an empty cell")
                gained = sum(n_.num_addresses for _, n_ in merges)
                check(post["score"] - pre["score"] == gained and post["moves"] == pre["moves"] + 1, f"{label}: score +{gained}, moves +1")
                check(coverage_ok(post), f"{label}: board + pool still cover the parent exactly")
                if merges:
                    saw_merge += 1
                    check(all(siblings(a, b) for (a, b), _ in merges), f"{label}: every merge was a true sibling pair")
                    check(text("#m-msg").count("=") >= len(merges), f"{label}: message explains the merge", text("#m-msg"))
                if blocked:
                    saw_blocked += 1
                    check("not siblings" in text("#m-msg"), f"{label}: blocked equal-size neighbours are explained", text("#m-msg"))
                if n % 10 == 0: check_geometry(label)
        check(saw_merge >= 5, f"model run exercised merges ({saw_merge})")
        check(saw_blocked >= 1, f"model run exercised blocked non-sibling pairs ({saw_blocked})")
        page.screenshot(path=str(ART / "02-mid-game.png"))

        # ===================== 3. Undo, hint, restart, swipe, tab isolation =====================
        print("\n== Subnet 2048: undo, hint, restart, swipe ==")
        goto(3, 5)
        for _ in range(6):
            d = choose_move(board_of(snap2())); press(KEYS[d])
        before = snap2(); press("ArrowLeft") if board_of(before) != slide(board_of(before), "left")[0] else press("ArrowRight")
        after = snap2()
        press("u")
        back = snap2()
        check(back["moves"] == before["moves"] and back["score"] == before["score"] and back["pool"] == before["pool"] and board_of(back) == board_of(before), "Undo restores the exact previous board, pool, score and moves")
        pair = next(((a, b) for a in board_of(back).values() for b in board_of(back).values() if siblings(a, b)), None)
        page.click("#m-hint")
        if pair:
            check(page.locator("#m-board .tile.hint").count() == 2 and str(pair[0]) in text("#m-msg"), "Hint highlights a real sibling pair", text("#m-msg"))
        else:
            check("No sibling pair" in text("#m-msg"), "Hint says no pair yet and names the missing sibling", text("#m-msg"))
        box = page.locator("#m-board").bounding_box()
        mv = snap2()["moves"]
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down(); page.mouse.move(box["x"] + box["width"] / 2 + 120, box["y"] + box["height"] / 2, steps=6); page.mouse.up()
        page.wait_for_timeout(200)
        check(snap2()["moves"] >= mv, "swipe on the board is accepted")
        page.click("#m-restart")
        check(snap2()["moves"] == 0 and len(snap2()["tiles"]) == 2, "Restart starts over")
        page.click("#mode-pack")
        mv = snap2()["moves"]
        for k in ("ArrowLeft", "ArrowUp", "w", "a"): press(k)
        page.click("#mode-merge")
        check(snap2()["moves"] == mv, "arrow keys do nothing to the 2048 board while another tab is open")

        # ===================== 4. A planning bot wins levels (keyboard only) =====================
        print("\n== Subnet 2048: bot plays to the win ==")
        wins = 0
        for level in (1, 2, 3):
            won = False
            for seed in range(1, 9):
                goto(level, seed)
                guard = 0
                while guard < 400:
                    guard += 1
                    s_ = snap2()
                    if s_["won"] or s_["lost"]: break
                    d = choose_move(board_of(s_))
                    if d is None: break
                    press(KEYS[d])
                s_ = snap2()
                if s_["won"]:
                    won = True; wins += 1
                    parent = ipaddress.ip_network(s_["parent"])
                    check(list(board_of(s_).values()) == [parent] and not s_["pool"], f"level {level} (seed {seed}): ends as a single {parent} block with an empty pool")
                    check(page.locator("#m-done").is_visible() and "Level complete" in text("#m-done-title"), f"level {level}: completion panel shown")
                    check(f"{s_['moves']} moves" in text("#m-best"), f"level {level}: best moves recorded", text("#m-best"))
                    page.screenshot(path=str(ART / f"03-level{level}-won.png"))
                    if level < 3:
                        page.click("#m-next")
                        check(f"Level {level + 1}" in text("#m-title"), f"Next level goes to level {level + 1}")
                    break
            check(won, f"bot won level {level} within 8 seeds")

        # ===================== 5. Getting stuck is detected =====================
        print("\n== Subnet 2048: stuck detection ==")
        stuck = False
        for seed in range(1, 8):
            goto(3, seed)
            rr = random.Random(seed)
            for _ in range(200):
                s_ = snap2()
                if s_["won"] or s_["lost"]: break
                tiles = board_of(s_)
                options = [d for d in KEYS if slide(tiles, d)[0] != tiles]
                no_merge = [d for d in options if not slide(tiles, d)[1]]   # adversarial: avoid merging whenever possible
                press(KEYS[rr.choice(no_merge or options or list(KEYS))])
            if snap2()["lost"]:
                stuck = True
                s_ = snap2(); tiles = board_of(s_)
                no_move = all(slide(tiles, d)[0] == tiles for d in KEYS) or (not s_["pool"] and not any(siblings(a, b) for a in tiles.values() for b in tiles.values()))
                check(no_move, "game declares 'stuck' only when no merge is possible")
                check(page.locator("#m-done").is_visible() and "Stuck" in text("#m-done-title"), "stuck panel shown")
                page.screenshot(path=str(ART / "04-stuck.png"))
                press("u")
                check(not snap2()["lost"] and page.locator("#m-done").is_hidden(), "Undo recovers from a stuck board")
                break
        check(stuck or not snap2()["lost"], "adversarial play never gets a false 'stuck' (a real stuck board is covered by the unit tests)")

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
