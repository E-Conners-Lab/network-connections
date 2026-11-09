#!/usr/bin/env python3
"""Browser test for Network Connections using Playwright.

Setup (once):
    python3 -m venv .venv-test && .venv-test/bin/pip install playwright && .venv-test/bin/playwright install chromium
Run:
    .venv-test/bin/python tests/playwright_test.py            # watch it in a real window, records video
    .venv-test/bin/python tests/playwright_test.py --headless

The puzzles are read and validated here with a separate Python implementation, then every puzzle is played
through the real UI on a desktop screen and on phone-sized touch screens.
"""
import argparse, functools, http.server, json, pathlib, re, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / "test-artifacts"
EMOJI = ["\U0001F7E8", "\U0001F7E9", "\U0001F7E6", "\U0001F7EA"]
RGB = {0: "rgb(251, 191, 36)", 1: "rgb(52, 211, 153)", 2: "rgb(96, 165, 250)", 3: "rgb(167, 139, 250)"}   # status-LED palette
GREEN, RED = "rgb(52, 211, 153)", "rgb(251, 113, 133)"
results = []


def check(cond, name, detail=""):
    results.append((bool(cond), name, detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))


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


def share_text(p, guesses, won, mistakes):
    head = f"Network Connections #{p['id']} {p['title']}"
    outcome = f"Solved with {mistakes} mistake{'' if mistakes == 1 else 's'}" if won else "Not solved"
    return "\n".join([head, outcome] + ["".join(EMOJI[g] for g in row) for row in guesses])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--pace", type=int, default=120, help="ms pause after each tap so a human can follow")
    args = ap.parse_args()
    ART.mkdir(exist_ok=True)

    # ===================== 0. Puzzle data, validated independently in Python =====================
    print("\n== Puzzle data (Python check) ==")
    puzzles = json.loads((ROOT / "data" / "puzzles.json").read_text())["puzzles"]
    check(len(puzzles) == 8 and [p["id"] for p in puzzles] == list(range(1, 9)), "eight puzzles with ids 1..8")
    check(len({p["title"] for p in puzzles}) == 8, "puzzle titles are unique")
    for p in puzzles:
        items = [i for g in p["groups"] for i in g["items"]]
        ok = (len(p["groups"]) == 4 and all(len(g["items"]) == 4 for g in p["groups"]) and len(items) == 16
              and len({i.strip().lower() for i in items}) == 16 and all(i.strip() for i in items)
              and all(g["name"].strip() and len(g["why"]) >= 15 for g in p["groups"]))
        check(ok, f"puzzle {p['id']} {p['title']}: 4 groups of 4, 16 distinct items, names and reasons present")

    with Server() as srv, sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        base = f"http://127.0.0.1:{srv.port}/index.html"
        errors = []

        def new_page(ctx):
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append(m.text) if m.type in ("error", "warning") else None)
            pg.on("requestfailed", lambda r: errors.append("request failed: " + r.url))
            return pg

        def helpers(pg, touch=False):
            tile = lambda item: pg.locator("#grid .tile", has_text=re.compile(f"^{re.escape(item)}$"))
            def tap(loc):
                loc.tap() if touch else loc.click()
                pg.wait_for_timeout(args.pace if not touch else args.pace)
            def pick(items):
                for it in items: tap(tile(it))
            def snap(): return pg.evaluate("window.__nc.snapshot()")
            def goto(pid, seed=1):
                pg.goto(base + f"?puzzle={pid}&seed={seed}"); pg.wait_for_selector("#grid .tile")
            sel = lambda: pg.locator('#grid .tile[aria-pressed="true"]').count()
            used = lambda: pg.locator("#dots .dot.used").count()
            return tile, tap, pick, snap, goto, sel, used

        # ===================== 1. Desktop: rules =====================
        print("\n== Desktop: rules ==")
        ctx = browser.new_context(viewport={"width": 1000, "height": 900}, color_scheme="light", record_video_dir=str(ART / "video-desktop"),
                                  record_video_size={"width": 1000, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
        page = new_page(ctx)
        tile, tap, pick, snap, goto, sel, used = helpers(page)
        text = lambda s: page.locator(s).inner_text()
        P = puzzles[2]; G = P["groups"]                                   # Automation Toolbox
        goto(3)
        check(page.title() == "Network Connections", "page title")
        check("Find four groups of four" in text(".goal") and "Four mistakes" in text(".goal"), "goal is stated on screen", text(".goal"))
        check(page.locator("#picker .pill").count() == 8, "puzzle picker has 8 buttons")
        shown = page.locator("#grid .tile").all_inner_texts()
        check(len(shown) == 16 and sorted(shown) == sorted(i for g in G for i in g["items"]), "16 tiles, exactly this puzzle's items")
        check(page.locator("#dots .dot").count() == 4 and used() == 0, "four mistake dots, none used")
        check(page.locator("#submit").is_disabled(), "Submit is disabled with nothing selected")
        page.screenshot(path=str(ART / "01-start.png"))

        # selection rules
        pick([G[0]["items"][0], G[0]["items"][1], G[0]["items"][2], G[0]["items"][3], G[1]["items"][0]])
        check(sel() == 4, "a fifth tile cannot be selected")
        check(page.locator("#submit").is_enabled(), "Submit is enabled with four selected")
        tap(tile(G[0]["items"][3]))
        check(sel() == 3 and page.locator("#submit").is_disabled(), "tapping a selected tile deselects it")
        before = page.locator("#grid .tile").all_inner_texts()
        tap(page.locator("#shuffle"))
        after = page.locator("#grid .tile").all_inner_texts()
        check(sorted(before) == sorted(after) and sel() == 3, "Shuffle keeps the same tiles and the selection", f"{before == after}")
        tap(page.locator("#deselect"))
        check(sel() == 0, "Deselect all clears the selection")

        # wrong, one away, duplicate
        pick([G[0]["items"][0], G[0]["items"][1], G[1]["items"][0], G[1]["items"][1]]); tap(page.locator("#submit"))
        check(text("#msg") == "Not quite." and used() == 1 and sel() == 4, "2+2 guess: 'Not quite', one dot used, selection kept", text("#msg"))
        dots = page.locator("#dots .dot")
        check(dots.nth(0).evaluate("e => getComputedStyle(e).backgroundColor") == RED and dots.nth(1).evaluate("e => getComputedStyle(e).backgroundColor") == GREEN, "link-health LED turns red when used, others stay green")
        check(page.locator("#grid.bad, #grid.shake").count() == 1, "wrong guess triggers the shake / red flash")
        tap(page.locator("#deselect"))
        pick([G[2]["items"][0], G[2]["items"][1], G[2]["items"][2], G[3]["items"][0]]); tap(page.locator("#submit"))
        check(text("#msg") == "One away!" and used() == 2, "3+1 guess says 'One away!' and costs a dot", text("#msg"))
        tap(page.locator("#deselect"))
        pick([G[0]["items"][1], G[1]["items"][1], G[0]["items"][0], G[1]["items"][0]]); tap(page.locator("#submit"))
        check(text("#msg") == "Already guessed that one." and used() == 2, "repeating a guess (in any order) is free")
        tap(page.locator("#deselect"))
        pick([G[0]["items"][0], G[1]["items"][0], G[2]["items"][0], G[3]["items"][0]]); tap(page.locator("#submit"))
        check(text("#msg") == "Not quite." and used() == 3, "1+1+1+1 guess is a plain mistake")
        page.screenshot(path=str(ART / "02-mistakes.png"))
        guesses = [[0, 0, 1, 1], [2, 2, 2, 3], [0, 1, 2, 3]]              # for the share text

        # correct groups, colours, order
        solve_order = [3, 1, 0, 2]
        for k, gi in enumerate(solve_order):
            tap(page.locator("#deselect")) if sel() else None
            pick(G[gi]["items"]); tap(page.locator("#submit"))
            guesses.append([gi] * 4)
            b = page.locator("#solved .banner").nth(k)
            check(b.get_attribute("data-group") == G[gi]["name"] and b.inner_text().count(G[gi]["items"][0]) == 1, f"group '{G[gi]['name']}' shown as a banner in position {k + 1}")
            check(b.evaluate("e => getComputedStyle(e).borderLeftColor") == RGB[gi], f"banner colour matches difficulty ({['yellow', 'green', 'blue', 'purple'][gi]})")
            check(b.locator("svg.ico path, svg.ico circle, svg.ico rect").count() > 0, f"banner for '{G[gi]['name']}' has an icon ({G[gi]['icon']})")
            nodes_up = page.locator("#topo .node.up").count(); links_up = page.locator("#topo .link.up").count()
            solved_set = set(solve_order[:k + 1])
            check(nodes_up == k + 1 and all(page.locator(f"#topo .node.n{i}").get_attribute("class").count("up") == (i in solved_set) for i in range(4)), f"topology: node for the solved group lights up ({k + 1}/4 nodes)")
            exp_links = sum(1 for i in range(3) if i in solved_set and i + 1 in solved_set)
            check(links_up == exp_links and f"{k + 1}/4" in text("#links"), f"topology: {exp_links} links up, counter reads {k + 1}/4", text("#links"))
            check(page.locator("#grid .tile").count() == 16 - 4 * (k + 1), f"{16 - 4 * (k + 1)} tiles remain")
        check(snap()["won"] and page.locator("#result").is_visible(), "solving four groups wins and shows the result card")
        check(page.locator(".burst .packet").count() >= 30, "win triggers the packet burst")
        check(page.locator("#topo .node.up").count() == 4 and page.locator("#topo .link.up").count() == 3, "topology fully lit after a win")
        check("Solved with 3 mistakes" in text("#r-title"), "result title reports 3 mistakes", text("#r-title"))
        why = page.locator("#r-why li").all_inner_texts()
        check(len(why) == 4 and all(g["name"] in w and g["why"] in w for g, w in zip(G, why)), "every group's reason is shown")
        exp = share_text(P, guesses, True, 3)
        check(text("#r-share") == exp, "share text matches the independent emoji grid", repr(text("#r-share")))
        tap(page.locator("#copy"))
        clip = page.evaluate("navigator.clipboard.readText()")
        check(clip == exp and "Copied" in text("#copy-note"), "Copy result puts the share text on the clipboard")
        check(page.locator("#submit").is_disabled() and page.locator("#shuffle").is_disabled(), "buttons are disabled after the puzzle ends")
        page.screenshot(path=str(ART / "03-solved.png"))

        # losing
        print("\n== Desktop: losing ==")
        goto(1, 3)
        G1 = puzzles[0]["groups"]
        wrong = [[(0, 0), (0, 1), (1, 0), (1, 1)], [(0, 2), (0, 3), (2, 0), (2, 1)], [(1, 2), (1, 3), (3, 0), (3, 1)], [(2, 2), (2, 3), (3, 2), (3, 3)]]
        lost_guesses = []
        for gs in wrong:
            tap(page.locator("#deselect")) if sel() else None
            pick([G1[a]["items"][b] for a, b in gs]); tap(page.locator("#submit")); lost_guesses.append([a for a, _ in gs])
        s = snap()
        check(s["lost"] and not s["won"] and used() == 4, "four mistakes lose the puzzle")
        check(page.locator("#solved .banner.missed").count() == 4 and page.locator("#grid .tile").count() == 0, "all four groups are revealed and the tiles are gone")
        check([b.get_attribute("data-group") for b in page.locator("#solved .banner").all()] == [g["name"] for g in G1], "revealed groups appear in difficulty order")
        check("Out of mistakes" in text("#msg") and "Not this time" in text("#r-title"), "loss message and result title", text("#msg"))
        check(text("#r-share") == share_text(puzzles[0], lost_guesses, False, 4), "lost share text matches the independent grid")
        page.screenshot(path=str(ART / "04-lost.png"))

        # every puzzle through the UI, then persistence
        print("\n== Desktop: all eight puzzles ==")
        goto(1)
        for p in puzzles:
            page.locator("#picker .pill").nth(p["id"] - 1).click(); page.wait_for_selector("#grid .tile")
            for g in p["groups"]:
                pick(g["items"]); tap(page.locator("#submit"))
            check(snap()["won"] and "Perfect" in text("#r-title") and snap()["id"] == p["id"], f"puzzle {p['id']} {p['title']}: solved through the UI with no mistakes")
        check(page.locator("#picker .pill .mark").count() == 8, "picker shows a mark on all eight puzzles")
        page.reload(); page.wait_for_selector("#grid .tile")
        check(page.locator("#picker .pill .mark").count() == 8, "results survive a reload (localStorage)")
        check(page.locator('#picker .pill[aria-label*="solved"]').count() == 8, "picker labels say 'solved' for screen readers")

        # keyboard
        print("\n== Desktop: keyboard ==")
        goto(4)
        page.keyboard.press("Tab")
        focus_ok = False
        for _ in range(12):
            if page.evaluate("document.activeElement.classList.contains('tile')"): focus_ok = True; break
            page.keyboard.press("Tab")
        check(focus_ok, "Tab reaches the tiles")
        first = page.evaluate("document.activeElement.dataset.item")
        page.keyboard.press("Space")
        check(sel() == 1, "Space selects the focused tile")
        check(page.evaluate("document.activeElement.dataset.item") == first, "keyboard focus stays on the tile after it is selected")
        for _ in range(3): page.keyboard.press("Tab"); page.keyboard.press("Space")
        check(sel() == 4 and page.locator("#submit").is_enabled(), "four tiles can be chosen with the keyboard alone")
        ctx.close()

        # ===================== 2. Phone screens =====================
        for name, vw, vh in (("iPhone-size 390x844", 390, 844), ("small phone 320x568", 320, 568)):
            print(f"\n== Phone: {name} ==")
            ctx = browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme="light",
                                      record_video_dir=str(ART / f"video-phone-{vw}"), record_video_size={"width": vw, "height": vh})
            page = new_page(ctx)
            tile, tap, pick, snap, goto, sel, used = helpers(page, touch=True)
            text = lambda s: page.locator(s).inner_text()
            for pid in (1, 3, 5, 6, 7, 8):
                goto(pid)
                fits = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                check(fits, f"{name} puzzle {pid}: no horizontal scrolling")
                clipped = page.evaluate("[...document.querySelectorAll('#grid .tile')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)")
                check(not clipped, f"{name} puzzle {pid}: no tile text is cut off", str(clipped))
                split = page.evaluate("""() => [...document.querySelectorAll('#grid .tile')].filter(e => {
                    if (/\\s/.test(e.textContent.trim())) return false;            // multi-word tiles may wrap between words
                    const r = document.createRange(); r.selectNodeContents(e); return r.getClientRects().length > 1; }).map(e => e.textContent)""")
                check(not split, f"{name} puzzle {pid}: single-word tiles are never split across lines", str(split))
                small = page.evaluate("[...document.querySelectorAll('#grid .tile, .buttons button, .pill')].filter(e => e.getClientRects().length && (e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44)).map(e => e.textContent)")
                check(not small, f"{name} puzzle {pid}: every tile and button is at least 44px", str(small))
            goto(1)
            check(page.evaluate("document.documentElement.scrollHeight <= window.innerHeight * 1.6"), f"{name}: the board needs little scrolling")
            page.screenshot(path=str(ART / f"05-phone-{vw}-start.png"))
            G1 = puzzles[0]["groups"]
            pick([G1[0]["items"][0], G1[0]["items"][1], G1[1]["items"][0], G1[1]["items"][1]]); tap(page.locator("#submit"))
            check(text("#msg") == "Not quite." and used() == 1, f"{name}: a wrong guess by tapping costs a dot")
            tap(page.locator("#deselect"))
            for g in G1:
                pick(g["items"]); tap(page.locator("#submit"))
            check(snap()["won"] and "Solved with 1 mistake" in text("#r-title"), f"{name}: puzzle 1 solved with taps only")
            check(text("#r-share") == share_text(puzzles[0], [[0, 0, 1, 1], [0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3]], True, 1), f"{name}: share text is right")
            check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"{name}: result card fits the screen")
            page.screenshot(path=str(ART / f"06-phone-{vw}-solved.png"))
            ctx.close()

        # themes, contrast, reduced motion
        print("\n== Themes, contrast and motion ==")
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, color_scheme="light")
        page = new_page(ctx)
        page.goto(base + "?puzzle=2&seed=1"); page.wait_for_selector("#grid .tile")
        bg = lambda: page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()")
        check(page.evaluate("document.documentElement.dataset.theme") == "dark" and bg() == "#070b14", "dark is the default theme, even when the device prefers light")
        page.screenshot(path=str(ART / "07-dark.png"))
        CONTRAST = """(pairs) => pairs.map(([f, b]) => {
            const rgb = (v) => { const e = document.createElement('i'); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c.match(/[\\d.]+/g).slice(0, 3).map(Number); };
            const lum = (c) => { const [r, g, b] = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
            const L1 = lum(rgb(f)), L2 = lum(rgb(b)); return [f, b, (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)]; })"""
        PAIRS = [["--ink", "--panel2"], ["--ink", "--bg"], ["--ink", "--panel"], ["--muted", "--bg"], ["--muted", "--panel"], ["--muted", "--panel2"],
                 ["--accent-ink", "--accent"], ["--accent", "--bg"], ["--danger", "--bg"], ["--ok", "--bg"]]
        for theme in ("dark", "light"):
            if theme == "light":
                page.tap("#theme"); page.wait_for_timeout(150)
                check(page.evaluate("document.documentElement.dataset.theme") == "light" and bg() == "#eef3f9", "theme button switches to light")
                check("dark" in (page.get_attribute("#theme", "aria-label") or ""), "theme button label updates for screen readers")
                page.screenshot(path=str(ART / "08-light.png"))
            low = [f"{a} on {b}: {r:.1f}" for a, b, r in page.evaluate(CONTRAST, PAIRS) if r < 4.5]
            check(not low, f"{theme} theme: all text and accent colours reach 4.5:1 contrast", "; ".join(low))
        page.reload(); page.wait_for_selector("#grid .tile")
        check(page.evaluate("document.documentElement.dataset.theme") == "light", "chosen theme survives a reload")
        page.tap("#theme"); check(page.evaluate("document.documentElement.dataset.theme") == "dark", "theme button switches back to dark")
        ctx.close()

        ctx = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        page = new_page(ctx); page.goto(base + "?puzzle=1&seed=1"); page.wait_for_selector("#grid .tile")
        for g in puzzles[0]["groups"]:
            for it in g["items"]: page.locator("#grid .tile", has_text=re.compile(f"^{re.escape(it)}$")).click()
            page.click("#submit")
        check(page.evaluate("window.__nc.snapshot().won") and page.locator(".burst").count() == 0, "reduced motion: puzzle can be won and no confetti burst is shown")
        check(page.evaluate("getComputedStyle(document.querySelector('#solved .banner')).animationName") == "none", "reduced motion: banner slide-in animation is off")
        ctx.close()

        check(not errors, "no console errors, warnings or failed requests", "; ".join(errors[:3]))
        browser.close()

    fails = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(fails)} passed, {len(fails)} failed. Video and screenshots: {ART}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
