#!/usr/bin/env python3
"""Static checks for the site: word counts of the tool prose, internal links,
asset references, duplicate ids and basic HTML balance."""
import re
import pathlib
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
pages = ["index.html", "concrete/index.html", "seller-fee/index.html", "edpi/index.html",
         "trucking-profit/index.html", "gravel-mulch/index.html", "cobra-vs-aca/index.html",
         "ev-vs-gas/index.html", "stair-roof/index.html", "battery-runtime/index.html",
         "streamer-payout/index.html", "3d-print-cost/index.html", "exif-stripper/index.html",
         "about/index.html", "contact/index.html",
         "privacy-policy/index.html", "404.html"]
TOOL_PAGES = ("concrete/", "seller-fee/", "edpi/", "trucking-profit/", "gravel-mulch/",
              "cobra-vs-aca/", "ev-vs-gas/", "stair-roof/", "battery-runtime/",
              "streamer-payout/", "3d-print-cost/", "exif-stripper/")

fail = []


class Checker(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
            "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = []
        self.errors = []
        self.in_prose = False
        self.prose_depth = 0
        self.prose_text = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in self.VOID:
            self.stack.append(tag)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "section" and "prose" in (a.get("class") or ""):
            self.in_prose = True
            self.prose_depth = len(self.stack)
        if self.in_prose and tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1
        if tag in self.VOID:
            return
        if tag in self.stack:
            while self.stack and self.stack[-1] != tag:
                self.errors.append(f"unclosed <{self.stack.pop()}> before </{tag}>")
            if self.stack:
                self.stack.pop()
        else:
            self.errors.append(f"stray </{tag}>")
        if self.in_prose and len(self.stack) < self.prose_depth:
            self.in_prose = False

    def handle_data(self, data):
        if self.in_prose and not self.skip:
            self.prose_text.append(data)


for rel in pages:
    path = ROOT / rel
    if not path.exists():
        fail.append(f"missing page {rel}")
        continue
    html = path.read_text(encoding="utf-8")
    c = Checker()
    c.feed(html)
    for e in c.errors:
        fail.append(f"{rel}: {e}")
    if c.stack:
        fail.append(f"{rel}: unclosed tags at end {c.stack}")
    dupes = {i for i in c.ids if c.ids.count(i) > 1}
    if dupes:
        fail.append(f"{rel}: duplicate ids {sorted(dupes)}")

    # internal links and asset references
    for m in re.finditer(r'(?:href|src)="(/[^"#?]*)"', html):
        target = m.group(1)
        if target.startswith("/assets/") or target.endswith((".xml", ".txt", ".svg")):
            f = ROOT / target.lstrip("/")
            if not f.exists():
                fail.append(f"{rel}: missing file for {target}")
        elif target == "/":
            continue
        else:
            d = ROOT / target.strip("/")
            if not (d / "index.html").exists() and not d.exists():
                fail.append(f"{rel}: broken link {target}")

    words = len(re.findall(r"[A-Za-z0-9’'$%.,-]+", " ".join(c.prose_text)))
    if any(k in rel for k in TOOL_PAGES):
        status = "OK " if words >= 1000 else "LOW"
        print(f"{status} prose words {rel:<24} {words:>5}")
        if words < 1000:
            fail.append(f"{rel}: only {words} words of prose (needs 1000+)")
    else:
        print(f"    prose words {rel:<24} {words:>5}")

# required files
for f in ["sitemap.xml", "robots.txt", "favicon.svg", ".nojekyll",
          "assets/css/style.css", "assets/js/site.js",
          "assets/js/calc-concrete.js", "assets/js/calc-seller.js", "assets/js/calc-sens.js",
          "assets/js/calc-trucking.js", "assets/js/calc-gravel.js", "assets/js/calc-cobra.js",
          "assets/js/calc-ev.js", "assets/js/calc-stair.js", "assets/js/calc-battery.js",
          "assets/js/calc-streamer.js", "assets/js/calc-print3d.js", "assets/js/exif-scan.js"]:
    if not (ROOT / f).exists():
        fail.append(f"missing required file {f}")

print()
if fail:
    print(f"FAIL {len(fail)}")
    for f in fail:
        print("  x " + f)
    sys.exit(1)
print("All static checks passed.")
