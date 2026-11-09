# Address Space Packer

Pack the address space. Waste nothing. A subnetting / VLSM puzzle game for the NAF AC6 workshop.

You get a parent block (for example 192.168.1.0/24) and a list of requests ("Sales needs 100 hosts").
Pick the smallest prefix that fits each request, then place it on the address map. Blocks must start on a
multiple of their own size, so the order you plan in matters. Eight levels run from a simple /24 split to a
/20 campus build, with point-to-point links (/30 and RFC 3021 /31) and a brownfield level with blocks already in use.
A short warm-up drill covers usable-host counts and prefix sizing.

## Run it

```
python3 -m http.server 8000
```

Then open http://localhost:8000. No install, no network, no API key.

## Tests

```
python3 tests/run.py   # subnet maths and level solvability, in headless Chrome
python3 tests/e2e.py   # drives the real UI in headless Chrome
```

Both need Google Chrome at the default macOS path; edit the `chrome` variable for other platforms.

## Spec

See `specs/` (constitution, spec, plan) and `ARCADE.md` for build details.
