#!/usr/bin/env python3
"""Runs the real site JavaScript (calc-*.js + tests/cases.js) in quickjs,
so the calculation logic is verified without Node.js.

Usage: python3 tests/run_quickjs.py
"""
import pathlib
import sys

try:
    import quickjs
except ImportError:
    sys.exit("quickjs is not installed. Run: pip3 install quickjs")

ROOT = pathlib.Path(__file__).resolve().parent.parent

parts = []
for name, var in [("calc-concrete.js", "ConcreteCalc"), ("calc-seller.js", "SellerCalc"),
                  ("calc-sens.js", "SensCalc"), ("calc-trucking.js", "TruckingCalc"),
                  ("calc-gravel.js", "GravelCalc"), ("calc-cobra.js", "CobraCalc"),
                  ("calc-ev.js", "EvCalc"), ("calc-stair.js", "StairCalc"),
                  ("calc-battery.js", "BatteryCalc"), ("calc-streamer.js", "StreamerCalc"),
                  ("calc-print3d.js", "Print3DCalc"), ("exif-scan.js", "ExifScan")]:
    src = (ROOT / "assets/js" / name).read_text(encoding="utf-8")
    parts.append("var module = {exports: {}};\n" + src + f"\nvar {var} = module.exports;\n")

cases = (ROOT / "tests/cases.js").read_text(encoding="utf-8").replace(
    "if (typeof module === 'object' && module.exports) module.exports = { runAll: runAll };", ""
)
parts.append(cases)
parts.append("""
var result = runAll(ConcreteCalc, SellerCalc, SensCalc, TruckingCalc, GravelCalc, CobraCalc, EvCalc, StairCalc, BatteryCalc, StreamerCalc, Print3DCalc, ExifScan);
JSON.stringify({pass: result.pass, fails: result.fails});
""")

ctx = quickjs.Context()
out = ctx.eval("".join(parts))
import json
data = json.loads(out)
print(f"PASS {data['pass']}  FAIL {len(data['fails'])}")
if data["fails"]:
    for f in data["fails"]:
        print("  x " + f)
    sys.exit(1)
print("All calculation checks passed.")
